from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.products.selectors import match_product
from Apps.products.services import create_product
from Apps.receipts import services
from Apps.receipts.models import FraudFlag, ManualReviewItem, Receipt
from Apps.reservations import services as reservation_services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry
from Apps.common.testing import RECEIPT_META, receipt_meta


def _world(*, min_units=1, product_name="Cola 12oz"):
    owner = User.objects.create_user(
        email="owner@example.com", password="x", full_name="Owner"
    )
    brand = Brand.objects.create(name="Acme", slug="acme")
    BrandMembership.objects.create(
        brand=brand, user=owner, role=BrandMembership.Role.OWNER
    )
    product = create_product(brand=brand, name=product_name)
    campaign = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Deal",
        daily_budget=Decimal("100.00"), min_purchase_units=min_units,
    )
    campaign_services.set_tiers(
        campaign, [{"reward_amount": "5.00", "allocation_percent": "100.00"}]
    )
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal("1000.00"),
        category=LedgerEntry.Category.FUNDING,
    )
    campaign_services.activate_campaign(campaign)
    return owner, brand, product, campaign


def _claim(campaign, email):
    user = User.objects.create_user(email=email, password="x", full_name="U")
    reservation = reservation_services.create_reservation(
        user=user, campaign_id=campaign.id
    )
    return user, reservation


class UploadAutoVerifyTests(APITestCase):
    def test_matching_receipt_auto_verifies(self):
        _, brand, product, campaign = _world()
        user, reservation = _claim(campaign, "c@example.com")
        receipt = services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META, merchant="Acme",
            items=[{"description": "Cola 12oz", "quantity": 1}],
        )
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertTrue(receipt.matched)
        self.assertEqual(receipt.matched_units, 1)
        self.assertFalse(ManualReviewItem.objects.exists())

    def test_unmatched_receipt_routes_to_manual_review(self):
        _, brand, product, campaign = _world()
        user, reservation = _claim(campaign, "c@example.com")
        receipt = services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "Mystery Snack", "quantity": 1}],
        )
        self.assertEqual(receipt.status, Receipt.Status.PENDING)
        self.assertTrue(
            ManualReviewItem.objects.filter(receipt=receipt, status="open").exists()
        )
        self.assertTrue(
            FraudFlag.objects.filter(
                receipt=receipt, reason=FraudFlag.Reason.NO_MATCH
            ).exists()
        )

    def test_insufficient_units_routes_to_review(self):
        _, brand, product, campaign = _world(min_units=2)
        user, reservation = _claim(campaign, "c@example.com")
        receipt = services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "Cola 12oz", "quantity": 1}],  # need 2
        )
        self.assertEqual(receipt.status, Receipt.Status.PENDING)


class DuplicateTests(APITestCase):
    def test_duplicate_receipt_is_rejected(self):
        _, brand, product, campaign = _world()
        u1, r1 = _claim(campaign, "a@example.com")
        u2, r2 = _claim(campaign, "b@example.com")
        items = [{"description": "Cola 12oz", "quantity": 1}]
        meta = dict(merchant="Acme", total=Decimal("9.99"), items=items)

        first = services.upload_receipt(user=u1, reservation_id=r1.id, **RECEIPT_META, **meta)
        self.assertEqual(first.status, Receipt.Status.VERIFIED)

        # The same physical receipt is refused outright (HTTP 409) rather than
        # being stored as a rejected record — u2's claim stays open so they can
        # still submit their own receipt.
        with self.assertRaises(services.DuplicateReceipt):
            services.upload_receipt(user=u2, reservation_id=r2.id, **RECEIPT_META, **meta)

        self.assertEqual(Receipt.objects.count(), 1)
        r2.refresh_from_db()
        self.assertEqual(r2.status, Reservation.Status.ACTIVE)

    def test_one_receipt_per_reservation(self):
        _, brand, product, campaign = _world()
        user, reservation = _claim(campaign, "c@example.com")
        services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "Cola 12oz", "quantity": 1}],
        )
        from Apps.receipts.services import ReceiptError

        with self.assertRaises(ReceiptError):
            services.upload_receipt(
                user=user, reservation_id=reservation.id, **RECEIPT_META,
                items=[{"description": "Cola 12oz", "quantity": 1}],
            )


class ManualReviewApiTests(APITestCase):
    def setUp(self):
        self.owner, self.brand, self.product, self.campaign = _world()
        self.user, self.reservation = _claim(self.campaign, "c@example.com")
        # Unmatched -> goes to review queue.
        self.receipt = services.upload_receipt(
            user=self.user, reservation_id=self.reservation.id, **RECEIPT_META,
            items=[{"description": "CLA 12 OZ", "quantity": 1}],
        )
        self.item = ManualReviewItem.objects.get(receipt=self.receipt)

    def test_brand_sees_queue(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.get(
            reverse("v1:receipts:review-queue", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)

    def test_approve_verifies_receipt(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.post(
            reverse("v1:receipts:review-approve", args=[self.brand.id, self.item.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.receipt.refresh_from_db()
        self.item.refresh_from_db()
        self.assertEqual(self.receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(self.item.status, ManualReviewItem.Status.RESOLVED)

    def test_decline_requires_reason_and_rejects(self):
        self.client.force_authenticate(self.owner)
        no_reason = self.client.post(
            reverse("v1:receipts:review-decline", args=[self.brand.id, self.item.id]),
            {},
            format="json",
        )
        self.assertEqual(no_reason.status_code, status.HTTP_400_BAD_REQUEST)

        resp = self.client.post(
            reverse("v1:receipts:review-decline", args=[self.brand.id, self.item.id]),
            {"reason": "Receipt illegible"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.receipt.refresh_from_db()
        self.assertEqual(self.receipt.status, Receipt.Status.REJECTED)
        self.assertEqual(self.receipt.decision_reason, "Receipt illegible")

    def test_add_alias_inline_improves_future_matching(self):
        # Before: "CLA 12 OZ" doesn't match the product.
        self.assertIsNone(match_product(brand=self.brand, text="CLA 12 OZ"))
        line_item = self.receipt.line_items.first()

        self.client.force_authenticate(self.owner)
        resp = self.client.post(
            reverse("v1:receipts:review-add-alias", args=[self.brand.id, self.item.id]),
            {"line_item": str(line_item.id), "product": str(self.product.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # After: the same text now resolves to the product.
        self.assertEqual(
            match_product(brand=self.brand, text="CLA 12 OZ"), self.product
        )

    def test_non_member_cannot_access_queue(self):
        outsider = User.objects.create_user(
            email="out@example.com", password="x", full_name="Out"
        )
        self.client.force_authenticate(outsider)
        resp = self.client.get(
            reverse("v1:receipts:review-queue", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class FlagUserTests(APITestCase):
    def test_brand_can_flag_user(self):
        owner, brand, product, campaign = _world()
        target, _ = _claim(campaign, "suspect@example.com")
        self.client.force_authenticate(owner)
        resp = self.client.post(
            reverse("v1:receipts:flag-user", args=[brand.id]),
            {"user": str(target.id), "reason": "manual", "detail": "Suspicious"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            FraudFlag.objects.filter(
                user=target, brand=brand, reason=FraudFlag.Reason.MANUAL
            ).exists()
        )


class ReceiptHistoryTests(APITestCase):
    def test_user_sees_only_own_receipts(self):
        owner, brand, product, campaign = _world()
        u1, r1 = _claim(campaign, "a@example.com")
        services.upload_receipt(
            user=u1, reservation_id=r1.id, **RECEIPT_META,
            items=[{"description": "Cola 12oz", "quantity": 1}],
        )
        other = User.objects.create_user(
            email="other@example.com", password="x", full_name="Other"
        )
        self.client.force_authenticate(other)
        resp = self.client.get(reverse("v1:receipts:receipt-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Paginated envelope: {count, next, previous, results}
        self.assertEqual(resp.data["count"], 0)
        self.assertEqual(resp.data["results"], [])
