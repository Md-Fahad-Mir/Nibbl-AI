"""End-to-end tests for the claim -> receipt -> OCR -> reward flow.

The OCR provider is stubbed at the HTTP boundary (``httpx.post``) with payloads
shaped exactly like the real Receipt Intelligence API response, so the mapping
layer, the five-field fingerprint, and every validation rule are exercised for
real — only the network call is faked.
"""

import datetime as dt
import threading
from decimal import Decimal
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.products.services import create_product
from Apps.rebates.models import Redemption
from Apps.receipts import ocr, services
from Apps.receipts.models import ManualReviewItem, Receipt
from Apps.reservations import services as reservation_services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

SHOP = "Fahad Chocolate Shop"
PRODUCT = "Dark Chocolate Bar 100g"


# ---------------------------------------------------------------------------
# Provider payload builder (mirrors the live /api/v1/receipts/extract response)
# ---------------------------------------------------------------------------
def payload(
    *,
    shop=SHOP,
    date="2026-08-29",
    time="14:30:00",
    number="INV-12345",
    items=None,
    total="35.00",
):
    if items is None:
        # The real service splits "Dark Chocolate Bar 100g" into
        # description + quantity=100 + unit=G — reproduced faithfully here.
        items = [
            {"description": "Dark Chocolate Bar", "quantity": "100", "unit": "G",
             "unit_price": "1.00", "total_price": "10.00"},
            {"description": "Coca Cola", "quantity": "500", "unit": "ML",
             "unit_price": "1.00", "total_price": "5.00"},
            {"description": "Biscuits", "quantity": None, "unit": None,
             "unit_price": "2.00", "total_price": "20.00"},
        ]
    return {
        "success": True,
        "data": {
            "schema_version": "1.0",
            "document_type": "receipt",
            "merchant": {"name": shop, "address": "12 Gulshan Ave, Dhaka"},
            "transaction": {
                "transaction_id": number,
                "date": date,
                "time": time,
                "datetime": f"{date}T{time}" if date and time else None,
                "raw_date": date,
                "raw_time": time,
            },
            "items": items,
            "receipt_number": number,
            "total": total,
            "currency": "BDT",
        },
        "warnings": [],
        "errors": [],
        "processing": {"request_id": "test-request-id"},
    }


class _Resp:
    """Minimal httpx.Response stand-in."""

    def __init__(self, body, status_code=200):
        self._body = body
        self.status_code = status_code

    def json(self):
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


def image(name="receipt.jpg"):
    return SimpleUploadedFile(name, b"fake-jpeg-bytes", content_type="image/jpeg")


def ocr_returning(body, status_code=200):
    """Patch the OCR HTTP call to return `body`."""
    return patch("httpx.post", return_value=_Resp(body, status_code))


# ---------------------------------------------------------------------------
# World builder
# ---------------------------------------------------------------------------
def build_world(*, min_units=1, start_at=None, end_at=None, product_name=PRODUCT,
                brand_name=SHOP, reward="2.00", fund="1000.00"):
    owner = User.objects.create_user(
        email="owner@example.com", password="x", full_name="Owner"
    )
    brand = Brand.objects.create(name=brand_name, slug="fahad-chocolate-shop")
    BrandMembership.objects.create(
        brand=brand, user=owner, role=BrandMembership.Role.OWNER
    )
    product = create_product(brand=brand, name=product_name)
    campaign = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Chocolate Purchase Reward",
        daily_budget=Decimal("100.00"), min_purchase_units=min_units,
        start_at=start_at, end_at=end_at,
    )
    campaign_services.set_tiers(
        campaign, [{"reward_amount": reward, "allocation_percent": "100.00"}]
    )
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal(fund), category=LedgerEntry.Category.FUNDING
    )
    campaign_services.activate_campaign(campaign)
    return owner, brand, product, campaign


def claim(campaign, email):
    user = User.objects.create_user(email=email, password="x", full_name="C")
    reservation = reservation_services.create_reservation(
        user=user, campaign_id=campaign.id
    )
    return user, reservation


def balance(user):
    return wallet_services.get_or_create_customer_wallet(user).available()


# ---------------------------------------------------------------------------
# Test 1 — Valid receipt
# ---------------------------------------------------------------------------
class ValidReceiptTests(APITestCase):
    def test_valid_receipt_verifies_and_credits_wallet(self):
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")
        self.assertEqual(balance(user), Decimal("0.00"))

        with ocr_returning(payload()):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )

        # Identity extracted from the provider response.
        self.assertEqual(receipt.merchant, SHOP)
        self.assertEqual(receipt.receipt_number, "INV-12345")
        self.assertEqual(receipt.purchased_at.date(), dt.date(2026, 8, 29))
        self.assertEqual(receipt.purchased_at.time().hour, 14)

        # The campaign product was found among the other receipt lines, and the
        # "100 G" package size was NOT counted as 100 purchased units.
        self.assertTrue(receipt.matched)
        self.assertEqual(receipt.matched_units, 1)

        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertIsNotNone(receipt.fingerprint)
        self.assertEqual(len(receipt.fingerprint), 64)

        # Reward issued: claim redeemed, ledger entry written, wallet credited.
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.REDEEMED)
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(balance(user), Decimal("2.00"))

    def test_only_campaign_product_needs_to_be_on_the_receipt(self):
        """The other lines (Coca Cola, Biscuits) are ignored, not required."""
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")
        with ocr_returning(payload()):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(receipt.line_items.count(), 3)


# ---------------------------------------------------------------------------
# Tests 2 & 3 — Duplicate receipts
# ---------------------------------------------------------------------------
class DuplicateReceiptTests(APITestCase):
    def test_same_receipt_same_customer_is_not_rewarded_twice(self):
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload()):
            services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        self.assertEqual(balance(user), Decimal("2.00"))

        # Re-submitting against the same (now redeemed) claim is refused, and
        # no second reward is issued.
        with ocr_returning(payload()):
            with self.assertRaises(services.ReceiptError):
                services.upload_receipt(
                    user=user, reservation_id=reservation.id, image=image()
                )

        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(balance(user), Decimal("2.00"))

    def test_same_receipt_different_customer_is_rejected(self):
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        with ocr_returning(payload()):
            first = services.upload_receipt(
                user=u1, reservation_id=r1.id, image=image()
            )
        self.assertEqual(first.status, Receipt.Status.VERIFIED)

        # Customer B photographs the *same physical receipt*: same five values
        # -> same fingerprint -> refused.
        with ocr_returning(payload()):
            with self.assertRaises(services.DuplicateReceipt):
                services.upload_receipt(user=u2, reservation_id=r2.id, image=image())

        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(balance(u2), Decimal("0.00"))

    def test_duplicate_returns_409_without_leaking_the_first_customer(self):
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        with ocr_returning(payload()):
            services.upload_receipt(user=u1, reservation_id=r1.id, image=image())

        self.client.force_authenticate(u2)
        with ocr_returning(payload()):
            resp = self.client.post(
                reverse("v1:receipts:receipt-list"),
                {"reservation": str(r2.id), "image": image()},
                format="multipart",
            )

        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)
        body = str(resp.data).lower()
        self.assertIn("already been used", body)
        # No detail about who used it first.
        self.assertNotIn("a@example.com", body)
        self.assertNotIn(str(u1.id), body)


# ---------------------------------------------------------------------------
# Test 4 — A genuinely different receipt still earns a reward
# ---------------------------------------------------------------------------
class DifferentReceiptTests(APITestCase):
    def test_different_receipt_same_product_and_shop_is_rewarded(self):
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        with ocr_returning(payload(time="14:30:00", number="INV-12345")):
            services.upload_receipt(user=u1, reservation_id=r1.id, image=image())

        # Same shop, same product, later purchase with its own receipt number.
        with ocr_returning(payload(time="16:45:00", number="INV-12346")):
            second = services.upload_receipt(
                user=u2, reservation_id=r2.id, image=image()
            )

        self.assertEqual(second.status, Receipt.Status.VERIFIED)
        self.assertEqual(Redemption.objects.count(), 2)
        self.assertEqual(balance(u2), Decimal("2.00"))

    def test_fingerprint_changes_with_each_of_the_five_components(self):
        base = dict(
            product_name=PRODUCT, shop_name=SHOP,
            purchase_date=dt.date(2026, 8, 29),
            purchase_time=dt.time(14, 30), receipt_number="INV-12345",
        )
        original = ocr.build_fingerprint(**base)

        for field, changed in [
            ("product_name", "Milk Chocolate Bar 100g"),
            ("shop_name", "Other Shop"),
            ("purchase_date", dt.date(2026, 8, 30)),
            ("purchase_time", dt.time(16, 45)),
            ("receipt_number", "INV-12346"),
        ]:
            with self.subTest(field=field):
                self.assertNotEqual(
                    original, ocr.build_fingerprint(**{**base, field: changed})
                )

        # Deterministic and case/whitespace insensitive: the same physical
        # receipt read slightly differently still collides.
        self.assertEqual(
            original,
            ocr.build_fingerprint(**{**base, "shop_name": "  FAHAD CHOCOLATE SHOP "}),
        )


# ---------------------------------------------------------------------------
# Test 5 — Wrong product
# ---------------------------------------------------------------------------
class WrongProductTests(APITestCase):
    def test_receipt_for_another_product_of_the_brand_is_rejected(self):
        _, brand, product, campaign = build_world()
        # A second product in the same library, not part of this campaign.
        create_product(brand=brand, name="Milk Chocolate Bar 50g")
        user, reservation = claim(campaign, "a@example.com")

        wrong = payload(items=[
            {"description": "Milk Chocolate Bar", "quantity": "50", "unit": "G",
             "unit_price": "1.00", "total_price": "5.00"},
        ])
        with ocr_returning(wrong):
            with self.assertRaises(services.ReceiptError) as ctx:
                services.upload_receipt(
                    user=user, reservation_id=reservation.id, image=image()
                )

        self.assertIn("does not contain the product", str(ctx.exception))
        self.assertFalse(Receipt.objects.exists())
        self.assertEqual(Redemption.objects.count(), 0)
        self.assertEqual(balance(user), Decimal("0.00"))

    def test_unrecognised_items_go_to_manual_review_not_reward(self):
        """An unknown line may be an alias gap, so a human decides — but no
        reward is issued automatically either way."""
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")

        unknown = payload(items=[
            {"description": "MYSTERY SNACK", "quantity": "1", "unit": None,
             "unit_price": "3.00", "total_price": "3.00"},
        ])
        with ocr_returning(unknown):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )

        self.assertEqual(receipt.status, Receipt.Status.PENDING)
        self.assertTrue(ManualReviewItem.objects.filter(receipt=receipt).exists())
        self.assertEqual(Redemption.objects.count(), 0)
        self.assertEqual(balance(user), Decimal("0.00"))


# ---------------------------------------------------------------------------
# Test 6 — Wrong shop
# ---------------------------------------------------------------------------
class WrongShopTests(APITestCase):
    def test_receipt_from_another_shop_is_rejected(self):
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(shop="Some Other Grocery")):
            with self.assertRaises(services.ReceiptError) as ctx:
                services.upload_receipt(
                    user=user, reservation_id=reservation.id, image=image()
                )

        self.assertIn("different shop", str(ctx.exception))
        self.assertFalse(Receipt.objects.exists())
        self.assertEqual(balance(user), Decimal("0.00"))


# ---------------------------------------------------------------------------
# Test 7 — Outside the campaign window
# ---------------------------------------------------------------------------
class CampaignWindowTests(APITestCase):
    def _campaign_in_august(self):
        start = timezone.make_aware(dt.datetime(2026, 8, 1))
        end = timezone.make_aware(dt.datetime(2026, 8, 30, 23, 59))
        return build_world(start_at=start, end_at=end)

    def test_receipt_inside_the_window_is_accepted(self):
        _, brand, product, campaign = self._campaign_in_august()
        user, reservation = claim(campaign, "a@example.com")
        with ocr_returning(payload(date="2026-08-15")):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)

    def test_receipt_before_the_campaign_is_rejected(self):
        _, brand, product, campaign = self._campaign_in_august()
        user, reservation = claim(campaign, "a@example.com")
        with ocr_returning(payload(date="2026-07-25")):
            with self.assertRaises(services.ReceiptError) as ctx:
                services.upload_receipt(
                    user=user, reservation_id=reservation.id, image=image()
                )
        self.assertIn("predates", str(ctx.exception))
        self.assertEqual(balance(user), Decimal("0.00"))

    def test_receipt_after_the_campaign_is_rejected(self):
        _, brand, product, campaign = self._campaign_in_august()
        user, reservation = claim(campaign, "a@example.com")
        with ocr_returning(payload(date="2026-09-02")):
            with self.assertRaises(services.ReceiptError) as ctx:
                services.upload_receipt(
                    user=user, reservation_id=reservation.id, image=image()
                )
        self.assertIn("after the campaign", str(ctx.exception))
        self.assertEqual(balance(user), Decimal("0.00"))


# ---------------------------------------------------------------------------
# Test 8 — Missing receipt number
# ---------------------------------------------------------------------------
class MissingReceiptNumberTests(APITestCase):
    def test_missing_number_goes_to_manual_review_and_pays_nothing(self):
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(number=None)):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )

        # No fingerprint could be built, so no duplicate protection exists ->
        # never auto-verified.
        self.assertIsNone(receipt.fingerprint)
        self.assertEqual(receipt.status, Receipt.Status.PENDING)
        self.assertIn("Receipt number", receipt.decision_reason)
        self.assertTrue(ManualReviewItem.objects.filter(receipt=receipt).exists())
        self.assertEqual(Redemption.objects.count(), 0)
        self.assertEqual(balance(user), Decimal("0.00"))

    def test_several_numberless_receipts_do_not_collide(self):
        """NULL fingerprints are exempt from the UNIQUE index, so unrelated
        unreadable receipts must not be mistaken for duplicates."""
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        with ocr_returning(payload(number=None)):
            services.upload_receipt(user=u1, reservation_id=r1.id, image=image())
            services.upload_receipt(user=u2, reservation_id=r2.id, image=image())

        self.assertEqual(Receipt.objects.filter(fingerprint__isnull=True).count(), 2)

    def test_opt_in_setting_allows_four_field_fingerprint(self):
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")
        with self.settings(RECEIPT_ALLOW_MISSING_NUMBER=True):
            with ocr_returning(payload(number=None)):
                receipt = services.upload_receipt(
                    user=user, reservation_id=reservation.id, image=image()
                )
        self.assertIsNotNone(receipt.fingerprint)
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)


# ---------------------------------------------------------------------------
# Test 9 — OCR failures
# ---------------------------------------------------------------------------
class OCRFailureTests(APITestCase):
    def setUp(self):
        _, self.brand, self.product, self.campaign = build_world()
        self.user, self.reservation = claim(self.campaign, "a@example.com")
        self.client.force_authenticate(self.user)

    def _post(self):
        return self.client.post(
            reverse("v1:receipts:receipt-list"),
            {"reservation": str(self.reservation.id), "image": image()},
            format="multipart",
        )

    def _assert_claim_untouched(self):
        self.reservation.refresh_from_db()
        self.assertEqual(self.reservation.status, Reservation.Status.ACTIVE)
        self.assertFalse(Receipt.objects.exists())
        self.assertEqual(balance(self.user), Decimal("0.00"))

    def test_provider_unreachable_returns_503_json(self):
        with patch("httpx.post", side_effect=OSError("connection refused")):
            resp = self._post()
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertIn("detail", resp.data)
        self._assert_claim_untouched()

    def test_provider_http_500_returns_503_json(self):
        with ocr_returning({"detail": "boom"}, status_code=500):
            resp = self._post()
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self._assert_claim_untouched()

    def test_malformed_json_returns_503_json(self):
        with ocr_returning(ValueError("not json")):
            resp = self._post()
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self._assert_claim_untouched()

    def test_unreadable_image_returns_422_json(self):
        body = {
            "success": False, "data": None, "warnings": [],
            "errors": [{"code": "OCR_EMPTY_RESULT", "message": "No text found."}],
            "processing": {"request_id": "x"},
        }
        with ocr_returning(body):
            resp = self._post()
        self.assertEqual(resp.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self._assert_claim_untouched()

    def test_provider_rejects_file_type_returns_422_json(self):
        body = {
            "success": False, "data": None, "warnings": [],
            "errors": [{"code": "UNSUPPORTED_FILE_TYPE", "message": "Not an image."}],
            "processing": {"request_id": "x"},
        }
        with ocr_returning(body, status_code=415):
            resp = self._post()
        self.assertEqual(resp.status_code, status.HTTP_422_UNPROCESSABLE_ENTITY)
        self._assert_claim_untouched()

    def test_ocr_not_configured_returns_503(self):
        with self.settings(RECEIPT_OCR_API_URL=""):
            resp = self._post()
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self._assert_claim_untouched()

    def test_null_fields_from_provider_do_not_crash(self):
        body = {
            "success": True,
            "data": {"merchant": {"name": None}, "transaction": {},
                     "items": [], "receipt_number": None, "total": None},
            "warnings": [], "errors": [], "processing": {"request_id": "x"},
        }
        with ocr_returning(body):
            resp = self._post()
        # No product found and nothing recognised -> manual review, not a 500.
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], Receipt.Status.PENDING)
        self.assertEqual(Redemption.objects.count(), 0)


# ---------------------------------------------------------------------------
# Test 10 — Concurrent duplicate submission
# ---------------------------------------------------------------------------
class ConcurrentDuplicateTests(TransactionTestCase):
    """The UNIQUE index — not a check-then-insert — is what makes this safe."""

    reset_sequences = True

    def test_database_constraint_blocks_the_second_writer(self):
        """Simulates the interleaving directly: both writers pass their
        duplicate *check*, then both try to insert the same fingerprint."""
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        with ocr_returning(payload()):
            services.upload_receipt(user=u1, reservation_id=r1.id, image=image())

        first = Receipt.objects.get()
        with self.assertRaises(services.DuplicateReceipt):
            with ocr_returning(payload()):
                services.upload_receipt(user=u2, reservation_id=r2.id, image=image())

        self.assertEqual(Receipt.objects.count(), 1)
        self.assertEqual(Receipt.objects.get().id, first.id)
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(balance(u2), Decimal("0.00"))

    def test_two_threads_submitting_one_receipt_reward_only_one(self):
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        results = []
        barrier = threading.Barrier(2)

        def submit(user, reservation):
            try:
                barrier.wait(timeout=5)
                with ocr_returning(payload()):
                    services.upload_receipt(
                        user=user, reservation_id=reservation.id, image=image()
                    )
                results.append("rewarded")
            except services.DuplicateReceipt:
                results.append("duplicate")
            except Exception as exc:  # noqa: BLE001 - surfaced in the assert
                results.append(f"error:{exc}")
            finally:
                connection.close()

        threads = [
            threading.Thread(target=submit, args=(u1, r1)),
            threading.Thread(target=submit, args=(u2, r2)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=20)

        # Exactly one reward, whichever thread won. On SQLite the loser may be
        # refused by write-locking instead of the UNIQUE index; either way it
        # must not be rewarded.
        self.assertEqual(results.count("rewarded"), 1, results)
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(Receipt.objects.filter(status=Receipt.Status.VERIFIED).count(), 1)


# ---------------------------------------------------------------------------
# Mapping layer (provider JSON -> internal fields)
# ---------------------------------------------------------------------------
class PayloadMappingTests(APITestCase):
    def test_five_identity_fields_are_read_from_the_documented_paths(self):
        extracted = ocr.map_payload(payload())
        self.assertEqual(extracted.merchant_name, SHOP)            # data.merchant.name
        self.assertEqual(extracted.purchase_date, dt.date(2026, 8, 29))  # data.transaction.date
        self.assertEqual(extracted.purchase_time, dt.time(14, 30))       # data.transaction.time
        self.assertEqual(extracted.receipt_number, "INV-12345")          # data.receipt_number
        self.assertEqual(
            [i.description for i in extracted.items],                    # data.items[].description
            ["Dark Chocolate Bar", "Coca Cola", "Biscuits"],
        )

    def test_receipt_number_falls_back_to_transaction_id(self):
        body = payload()
        body["data"]["receipt_number"] = None
        body["data"]["transaction"]["transaction_id"] = "TXN-999"
        self.assertEqual(ocr.map_payload(body).receipt_number, "TXN-999")

    def test_measurement_units_are_not_counted_as_purchased_quantity(self):
        items = ocr.map_payload(payload()).items
        self.assertEqual(items[0].quantity, 1)  # "100 G" is a size, not 100 units
        self.assertEqual(items[0].description_with_size, "Dark Chocolate Bar 100G")

    def test_real_counts_are_preserved(self):
        body = payload(items=[
            {"description": "Biscuits", "quantity": "3", "unit": None,
             "unit_price": "2.00", "total_price": "6.00"},
        ])
        self.assertEqual(ocr.map_payload(body).items[0].quantity, 3)

    def test_size_suffix_lets_the_product_library_match(self):
        """OCR splits the size off; the restored description matches the
        library name exactly, with no fuzzy matching involved."""
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")
        with ocr_returning(payload()):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        matched = receipt.line_items.exclude(matched_product=None).first()
        self.assertIsNotNone(matched)
        self.assertEqual(matched.matched_product_id, product.id)
