"""End-to-end tests for the claim -> receipt -> OCR -> reward flow.

The OCR provider is stubbed at the HTTP boundary (``httpx.post``) with payloads
shaped exactly like the real Receipt Intelligence API response, so the mapping
layer, the full-data fingerprint, and every validation rule are exercised for
real — only the network call is faked.

Pure unit coverage of the canonicalization/hashing engine itself (key order,
whitespace, money formats, excluded fields, ...) lives in
``test_fingerprint.py``, next to this file — it needs no database and runs
fast; the tests here focus on how fingerprinting behaves as part of the full
upload flow (duplicate detection, manual review routing, reward issuance).
"""

import datetime as dt
import threading
from decimal import Decimal
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TransactionTestCase, override_settings
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
        for identity_hash in (
            receipt.merchant_hash,
            receipt.purchase_date_hash,
            receipt.purchase_time_hash,
            receipt.product_description_hash,
        ):
            self.assertIsNotNone(identity_hash)
            self.assertEqual(len(identity_hash), 64)
        self.assertEqual(receipt.matched_product_id, product.id)

        # The exact canonicalized structure that was hashed is kept for audit.
        ocr_result = receipt.ocr_result
        self.assertTrue(ocr_result.canonical_data)
        self.assertIn("merchant", ocr_result.canonical_data)
        self.assertNotIn("confidence", ocr_result.canonical_data)

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

    def test_receipt_number_and_total_do_not_affect_duplicate_identity(self):
        """The identity hashes are merchant + date + time + claimed product
        only (spec: never SKU, price, quantity, tax, payment, or the receipt
        number). Two submissions differing *only* in receipt_number/total are
        therefore the same identity — a duplicate — not two different
        receipts as the old full-payload hash would have treated them."""
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        with ocr_returning(payload(number="INV-12345")):
            services.upload_receipt(user=u1, reservation_id=r1.id, image=image())

        with ocr_returning(payload(number="INV-12346", total="99.00")):
            with self.assertRaises(services.DuplicateReceipt):
                services.upload_receipt(user=u2, reservation_id=r2.id, image=image())

        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(balance(u2), Decimal("0.00"))


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
# SKU-first product matching (spec §6/§7 preferred order: SKU before text)
# ---------------------------------------------------------------------------
class SkuMatchingTests(APITestCase):
    def test_sku_match_wins_even_when_the_printed_description_would_not_match(self):
        """The OCR description is nothing like the product's name/aliases,
        but the SKU is an exact match — SKU must be checked first and win,
        per the preferred matching order."""
        _, brand, product, campaign = build_world(product_name="Dark Chocolate Bar 100g")
        product.sku = "SKU-DCB-100"
        product.save(update_fields=["sku"])
        user, reservation = claim(campaign, "a@example.com")

        body = payload(items=[
            {"description": "MISC ITEM 4821", "sku": "SKU-DCB-100",
             "quantity": "1", "unit": None, "unit_price": "1.00", "total_price": "1.00"},
        ])
        with ocr_returning(body):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )

        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(receipt.matched_product_id, product.id)
        self.assertEqual(Redemption.objects.count(), 1)

    def test_sku_match_is_case_insensitive(self):
        _, brand, product, campaign = build_world(product_name="Dark Chocolate Bar 100g")
        product.sku = "SKU-DCB-100"
        product.save(update_fields=["sku"])
        user, reservation = claim(campaign, "a@example.com")

        body = payload(items=[
            {"description": "MISC ITEM", "sku": "sku-dcb-100",
             "quantity": "1", "unit": None, "unit_price": "1.00", "total_price": "1.00"},
        ])
        with ocr_returning(body):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        self.assertEqual(receipt.matched_product_id, product.id)

    def test_wrong_sku_falls_back_to_text_matching(self):
        """A SKU that matches nothing in this brand's library must not block
        the existing text/alias fallback from still finding the product."""
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")

        body = payload(items=[
            {"description": "Dark Chocolate Bar", "sku": "NOT-A-REAL-SKU",
             "quantity": "100", "unit": "G", "unit_price": "1.00", "total_price": "10.00"},
        ])
        with ocr_returning(body):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(receipt.matched_product_id, product.id)


# ---------------------------------------------------------------------------
# Test 6 — No brand/shop verification: only the product match decides
# ---------------------------------------------------------------------------
# Brand/shop matching was deliberately removed from verification. A receipt
# is verified purely on whether the claimed product is found among the
# OCR-extracted items — the merchant name is recorded (Receipt.merchant) but
# never checked against the campaign's brand.
class NoShopVerificationTests(APITestCase):
    def test_receipt_from_a_different_shop_still_verifies_and_pays(self):
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(shop="Some Other Grocery")):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )

        # The mismatched merchant name is still recorded, informationally —
        # it just never blocks verification.
        self.assertEqual(receipt.merchant, "Some Other Grocery")
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(balance(user), Decimal("2.00"))

    def test_receipt_with_no_merchant_name_at_all_still_verifies_and_pays(self):
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(shop="")):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )

        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(Redemption.objects.count(), 1)


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
# Test 8 — Missing receipt number / missing date-time (spec §5, §13 Tests 5-6)
# ---------------------------------------------------------------------------
# The identity hashes never depend on receipt_number at all — it plays no
# part in merchant/date/time/product-description hashing. A missing
# receipt_number therefore never blocks identity or auto-reward on its own
# (RECEIPT_ALLOW_MISSING_NUMBER is retired: see core/settings/base.py).
# A missing purchase date still routes to manual review, but for its own
# reason (the campaign purchase-window check in Apps.receipts.services can't
# evaluate an unreadable date) — independent of identity hashing.
class MissingFieldsTests(APITestCase):
    def test_missing_receipt_number_can_still_verify_and_pay(self):
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(number=None)):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )

        # Merchant + date/time + the claimed product were still readable, so
        # every identity hash is built — receipt_number never participates.
        self.assertIsNotNone(receipt.merchant_hash)
        self.assertIsNotNone(receipt.purchase_date_hash)
        self.assertIsNotNone(receipt.purchase_time_hash)
        self.assertIsNotNone(receipt.product_description_hash)
        self.assertEqual(receipt.receipt_number, "")
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(balance(user), Decimal("2.00"))

    def test_two_numberless_receipts_that_differ_do_not_collide(self):
        """Two genuinely different purchases, neither with a receipt number,
        must not be mistaken for one another — they differ in purchase time,
        which does participate in the identity (unlike receipt_number)."""
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        with ocr_returning(payload(number=None, time="14:30:00")):
            first = services.upload_receipt(user=u1, reservation_id=r1.id, image=image())
        with ocr_returning(payload(number=None, time="16:45:00")):
            second = services.upload_receipt(user=u2, reservation_id=r2.id, image=image())

        self.assertNotEqual(first.purchase_time_hash, second.purchase_time_hash)
        self.assertEqual(Redemption.objects.count(), 2)

    def test_two_numberless_receipts_that_are_identical_are_flagged_duplicate(self):
        """The flip side: if nothing at all distinguishes them (both missing
        a number, everything else identical), they genuinely are the same
        receipt and must be caught as a duplicate — not waved through just
        because the number is absent."""
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        with ocr_returning(payload(number=None)):
            services.upload_receipt(user=u1, reservation_id=r1.id, image=image())
        with ocr_returning(payload(number=None)):
            with self.assertRaises(services.DuplicateReceipt):
                services.upload_receipt(user=u2, reservation_id=r2.id, image=image())

        self.assertEqual(Redemption.objects.count(), 1)

    def test_missing_date_still_reads_merchant_but_goes_to_manual_review(self):
        """No date/time is readable at all — merchant and product are still
        hashed, but the campaign's purchase-window check can't evaluate a
        date it doesn't have, so this routes to manual review. Without a
        readable date the receipt also can't be auto-deduplicated or later
        approved at all (Apps.receipts.services._assert_single_use) — see
        test_single_use_receipt.SingleUseThroughManualApprovalTests
        .test_a_missing_purchase_date_blocks_approval_even_with_a_known_merchant."""
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(date=None, time=None)):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )

        self.assertIsNotNone(receipt.merchant_hash)
        self.assertIsNone(receipt.purchase_date_hash)
        self.assertIsNone(receipt.purchase_time_hash)
        self.assertEqual(receipt.status, Receipt.Status.PENDING)
        self.assertIn("Purchase date", receipt.decision_reason)
        self.assertTrue(ManualReviewItem.objects.filter(receipt=receipt).exists())
        self.assertEqual(Redemption.objects.count(), 0)
        self.assertEqual(balance(user), Decimal("0.00"))

    def test_entirely_unreadable_receipt_gets_no_identity_and_no_collision(self):
        """When OCR returns essentially nothing usable, no identity hash can
        be built at all (same graceful-degradation posture as before) — and
        two such unrelated receipts must not collide with each other under a
        shared NULL/empty identity."""
        _, brand, product, campaign = build_world()
        u1, r1 = claim(campaign, "a@example.com")
        u2, r2 = claim(campaign, "b@example.com")

        blank = {
            "success": True,
            "data": {"merchant": {}, "transaction": {}, "items": [],
                     "receipt_number": None, "total": None},
            "warnings": [], "errors": [], "processing": {"request_id": "x"},
        }
        with ocr_returning(blank):
            r1_receipt = services.upload_receipt(user=u1, reservation_id=r1.id, image=image())
        with ocr_returning(blank):
            r2_receipt = services.upload_receipt(user=u2, reservation_id=r2.id, image=image())

        self.assertIsNone(r1_receipt.merchant_hash)
        self.assertIsNone(r2_receipt.merchant_hash)
        self.assertEqual(
            Receipt.objects.filter(merchant_hash__isnull=True).count(), 2
        )


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

    def test_sku_is_read_from_each_item(self):
        body = payload(items=[
            {"description": "Dark Chocolate Bar", "sku": "SKU-1", "quantity": "1",
             "unit": None, "unit_price": "1.00", "total_price": "1.00"},
            {"description": "Coca Cola", "sku": None, "quantity": "1",
             "unit": None, "unit_price": "1.00", "total_price": "1.00"},
        ])
        items = ocr.map_payload(body).items
        self.assertEqual(items[0].sku, "SKU-1")
        self.assertEqual(items[1].sku, "")

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


# ---------------------------------------------------------------------------
# Merchant restriction (opt-in per campaign; blank = no restriction)
# ---------------------------------------------------------------------------
# Campaign.allowed_merchants is blank by default and on every campaign that
# existed before this field was added — NoShopVerificationTests above proves
# that default keeps the platform's "any shop" model. These tests cover a
# campaign that opts in.
class MerchantRestrictionTests(APITestCase):
    def test_merchant_matching_the_restriction_is_accepted(self):
        _, brand, product, campaign = build_world()
        campaign.allowed_merchants = "Fahad Chocolate Shop, Corner Store"
        campaign.save(update_fields=["allowed_merchants"])
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(shop=SHOP)):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)

    def test_merchant_not_matching_the_restriction_is_rejected(self):
        _, brand, product, campaign = build_world()
        campaign.allowed_merchants = "Walmart, Target"
        campaign.save(update_fields=["allowed_merchants"])
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(shop="Some Other Grocery")):
            with self.assertRaises(services.ReceiptError) as ctx:
                services.upload_receipt(
                    user=user, reservation_id=reservation.id, image=image()
                )
        self.assertIn("not from a merchant accepted", str(ctx.exception))
        self.assertFalse(Receipt.objects.exists())
        self.assertEqual(balance(user), Decimal("0.00"))

    def test_unreadable_merchant_with_a_restriction_goes_to_manual_review(self):
        """A restriction is configured but OCR couldn't read a merchant at
        all — a limit of the scan, not proof of ineligibility, so this is a
        soft note (manual review), not a hard rejection."""
        _, brand, product, campaign = build_world()
        campaign.allowed_merchants = "Walmart"
        campaign.save(update_fields=["allowed_merchants"])
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(shop="")):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        self.assertEqual(receipt.status, Receipt.Status.PENDING)
        self.assertIn("Merchant could not be read", receipt.decision_reason)
        self.assertEqual(Redemption.objects.count(), 0)


# ---------------------------------------------------------------------------
# Multiple products on one receipt / duplicate product claim
# ---------------------------------------------------------------------------
class MultipleProductsOnOneReceiptTests(APITestCase):
    """A receipt can list several campaign-eligible products. Each distinct
    product may fund its own separate claim off the same physical receipt,
    but the same product cannot be claimed twice off it — the dedup key is
    (receipt identity, claimed product), not the receipt alone."""

    def _two_campaigns(self):
        """Dark Chocolate Bar and Coca Cola both appear on the default
        payload() -- one campaign per product, same brand."""
        _, brand, choc, choc_campaign = build_world()
        cola = create_product(brand=brand, name="Coca Cola")
        cola_campaign = campaign_services.create_campaign(
            brand=brand, product_ids=[cola.id], name="Cola Reward",
            daily_budget=Decimal("100.00"), min_purchase_units=1,
        )
        campaign_services.set_tiers(
            cola_campaign, [{"reward_amount": "1.50", "allocation_percent": "100.00"}]
        )
        campaign_services.activate_campaign(cola_campaign)
        return brand, choc_campaign, cola_campaign

    def test_two_distinct_products_on_the_same_receipt_each_fund_a_reward(self):
        brand, choc_campaign, cola_campaign = self._two_campaigns()
        u1, r1 = claim(choc_campaign, "a@example.com")
        u2, r2 = claim(cola_campaign, "b@example.com")

        with ocr_returning(payload()):
            choc_receipt = services.upload_receipt(
                user=u1, reservation_id=r1.id, image=image()
            )
        with ocr_returning(payload()):
            cola_receipt = services.upload_receipt(
                user=u2, reservation_id=r2.id, image=image()
            )

        self.assertEqual(choc_receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(cola_receipt.status, Receipt.Status.VERIFIED)
        # Same physical receipt: the merchant/date/time identity matches...
        self.assertEqual(choc_receipt.merchant_hash, cola_receipt.merchant_hash)
        self.assertEqual(choc_receipt.purchase_date_hash, cola_receipt.purchase_date_hash)
        self.assertEqual(choc_receipt.purchase_time_hash, cola_receipt.purchase_time_hash)
        # ...but the claimed product differs, so both are funded.
        self.assertNotEqual(
            choc_receipt.product_description_hash, cola_receipt.product_description_hash
        )
        self.assertEqual(Redemption.objects.count(), 2)
        self.assertEqual(balance(u1), Decimal("2.00"))
        self.assertEqual(balance(u2), Decimal("1.50"))

    def test_the_same_product_claimed_twice_off_the_same_receipt_is_blocked(self):
        brand, choc_campaign, _cola_campaign = self._two_campaigns()
        u1, r1 = claim(choc_campaign, "a@example.com")
        u2, r2 = claim(choc_campaign, "b@example.com")

        with ocr_returning(payload()):
            services.upload_receipt(user=u1, reservation_id=r1.id, image=image())
        with ocr_returning(payload()):
            with self.assertRaises(services.DuplicateReceipt):
                services.upload_receipt(user=u2, reservation_id=r2.id, image=image())

        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(balance(u2), Decimal("0.00"))


# ---------------------------------------------------------------------------
# Product-description matching
# ---------------------------------------------------------------------------
class ProductDescriptionMatchingTests(APITestCase):
    """The claimed product is identified by the specific receipt line's
    description hash, not the receipt as a whole."""

    def test_claimed_product_hash_matches_only_its_own_line_not_others(self):
        _, brand, product, campaign = build_world()
        user, reservation = claim(campaign, "a@example.com")
        with ocr_returning(payload()):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        choc_line = receipt.line_items.get(description="Dark Chocolate Bar")
        cola_line = receipt.line_items.get(description="Coca Cola")

        self.assertEqual(receipt.product_description_hash, choc_line.description_hash)
        self.assertNotEqual(receipt.product_description_hash, cola_line.description_hash)

    def test_normalized_product_name_hash_equals_matching_description_hash(self):
        """hash_text(name) == hash_text(description) whenever normalize_text
        would already consider them the same string — the exact-name path
        Apps.products.selectors.match_product falls back to when no alias
        exists."""
        self.assertEqual(ocr.hash_text("Coca Cola"), ocr.hash_text("COCA   cola"))
        self.assertEqual(ocr.hash_text("Coca Cola"), ocr.hash_text("  coca cola  "))
        self.assertNotEqual(ocr.hash_text("Coca Cola"), ocr.hash_text("Pepsi"))
        self.assertIsNone(ocr.hash_text(""))
        self.assertIsNone(ocr.hash_text(None))


# ---------------------------------------------------------------------------
# Campaign datetime validation (integration with the new identity hashes)
# ---------------------------------------------------------------------------
# Unit coverage of the window comparison itself lives in CampaignWindowTests
# above (unchanged by this feature); these confirm the same extracted
# date/time that feeds that check is what gets hashed.
class CampaignDatetimeValidationTests(APITestCase):
    def _bounded_campaign(self):
        start = timezone.make_aware(dt.datetime(2026, 8, 1))
        end = timezone.make_aware(dt.datetime(2026, 8, 30, 23, 59))
        return build_world(start_at=start, end_at=end)

    def test_purchase_datetime_used_for_the_window_check_matches_the_hashed_values(self):
        _, brand, product, campaign = self._bounded_campaign()
        user, reservation = claim(campaign, "a@example.com")

        with ocr_returning(payload(date="2026-08-15", time="09:00:00")):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(receipt.purchase_date_hash, ocr.hash_date(dt.date(2026, 8, 15)))
        self.assertEqual(receipt.purchase_time_hash, ocr.hash_time(dt.time(9, 0)))

    def test_boundary_instant_exactly_at_campaign_end_is_accepted(self):
        _, brand, product, campaign = self._bounded_campaign()
        user, reservation = claim(campaign, "a@example.com")
        with ocr_returning(payload(date="2026-08-30", time="23:59:00")):
            receipt = services.upload_receipt(
                user=user, reservation_id=reservation.id, image=image()
            )
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)


# ---------------------------------------------------------------------------
# AI service integration
# ---------------------------------------------------------------------------
# The AI service is deployed and versioned independently
# (https://api.joinnibbl.com/ai in production); nothing here touches its
# code, API, or deployment — only how the backend is configured to call it
# (RECEIPT_OCR_API_URL / RECEIPT_OCR_API_KEY / RECEIPT_OCR_EXTRACT_PATH).
class AIServiceIntegrationTests(APITestCase):
    @override_settings(
        RECEIPT_OCR_API_URL="https://api.joinnibbl.com/ai",
        RECEIPT_OCR_API_KEY="prod-shared-secret",
    )
    def test_extract_request_targets_the_public_ai_service_url(self):
        captured = {}

        def fake_post(url, **kwargs):
            captured["url"] = url
            captured["headers"] = kwargs.get("headers")
            return _Resp(payload())

        with patch("httpx.post", side_effect=fake_post):
            ocr.extract_receipt(image())

        self.assertEqual(
            captured["url"], "https://api.joinnibbl.com/ai/api/v1/receipts/extract"
        )
        self.assertEqual(captured["headers"]["X-API-Key"], "prod-shared-secret")

    @override_settings(RECEIPT_OCR_API_URL="https://api.joinnibbl.com/ai/")
    def test_trailing_slash_on_the_configured_url_does_not_double_up(self):
        captured = {}

        def fake_post(url, **kwargs):
            captured["url"] = url
            return _Resp(payload())

        with patch("httpx.post", side_effect=fake_post):
            ocr.extract_receipt(image())

        self.assertEqual(
            captured["url"], "https://api.joinnibbl.com/ai/api/v1/receipts/extract"
        )

    @override_settings(RECEIPT_OCR_API_URL="")
    def test_blank_url_is_treated_as_not_configured(self):
        self.assertFalse(ocr.is_configured())
        with self.assertRaises(ocr.OCRUnavailable):
            ocr.extract_receipt(image())
