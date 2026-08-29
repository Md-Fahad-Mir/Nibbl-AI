from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.products.services import create_product
from Apps.rebates.models import Redemption, RewardIssuance
from Apps.receipts import services as receipt_services
from Apps.receipts.models import ManualReviewItem, Receipt
from Apps.reservations import services as reservation_services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry
from Apps.common.testing import RECEIPT_META, receipt_meta


def _world(*, reward="5.00", plan_slug="starter", fund="1000.00"):
    owner = User.objects.create_user(
        email="owner@example.com", password="x", full_name="Owner"
    )
    plan = Plan.objects.get(slug=plan_slug)  # starter = 20% rebate fee
    brand = Brand.objects.create(name="Acme", slug="acme", plan=plan)
    BrandMembership.objects.create(
        brand=brand, user=owner, role=BrandMembership.Role.OWNER
    )
    product = create_product(brand=brand, name="Cola 12oz")
    campaign = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Deal", daily_budget=Decimal("100.00"),
    )
    campaign_services.set_tiers(
        campaign, [{"reward_amount": reward, "allocation_percent": "100.00"}]
    )
    brand_wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=brand_wallet, amount=Decimal(fund),
        category=LedgerEntry.Category.FUNDING,
    )
    campaign_services.activate_campaign(campaign)
    return owner, brand, product, campaign, brand_wallet


def _claim(campaign, email="c@example.com"):
    user = User.objects.create_user(email=email, password="x", full_name="U")
    reservation = reservation_services.create_reservation(
        user=user, campaign_id=campaign.id
    )
    return user, reservation


class HappyPathTests(APITestCase):
    def test_matching_receipt_issues_reward_with_fee(self):
        owner, brand, product, campaign, brand_wallet = _world(reward="5.00")
        user, reservation = _claim(campaign)

        receipt = receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "Cola 12oz", "quantity": 1}],
        )
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)

        redemption = Redemption.objects.get()
        self.assertEqual(redemption.reward_amount, Decimal("5.00"))
        self.assertEqual(redemption.fee_amount, Decimal("1.00"))  # 20% of 5
        self.assertEqual(redemption.status, Redemption.Status.ISSUED)

        # Reservation redeemed, hold captured.
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.REDEEMED)
        self.assertEqual(reservation.hold.status, Hold.Status.CAPTURED)

        # Customer credited the reward.
        customer_wallet = wallet_services.get_or_create_customer_wallet(user)
        self.assertEqual(customer_wallet.balance, Decimal("5.00"))

        # Brand debited reward + fee; no remaining hold.
        brand_wallet.refresh_from_db()
        self.assertEqual(brand_wallet.balance, Decimal("994.00"))  # 1000 - 5 - 1
        self.assertEqual(brand_wallet.held_amount(), Decimal("0.00"))

        # Ledger linkage recorded.
        issuance = RewardIssuance.objects.get()
        self.assertIsNotNone(issuance.brand_reward_entry)
        self.assertIsNotNone(issuance.customer_credit_entry)
        self.assertIsNotNone(issuance.brand_fee_entry)

    def test_full_api_flow_then_history(self):
        owner, brand, product, campaign, _ = _world()
        user, reservation = _claim(campaign)
        receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "Cola 12oz", "quantity": 1}],
        )
        self.client.force_authenticate(user)
        listing = self.client.get(reverse("v1:rebates:redemption-list"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        # Paginated envelope: {count, next, previous, results}
        self.assertEqual(listing.data["count"], 1)
        self.assertEqual(len(listing.data["results"]), 1)

        # Brand history (tenant-scoped).
        self.client.force_authenticate(owner)
        brand_hist = self.client.get(
            reverse("v1:rebates:brand-redemption-list", args=[brand.id])
        )
        self.assertEqual(len(brand_hist.data), 1)


class ManualApprovalTests(APITestCase):
    def test_manual_approve_issues_reward(self):
        owner, brand, product, campaign, brand_wallet = _world(reward="5.00")
        user, reservation = _claim(campaign)
        # Unmatched description -> manual review, no reward yet.
        receipt = receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "CLA 12 OZ", "quantity": 1}],
        )
        self.assertEqual(receipt.status, Receipt.Status.PENDING)
        self.assertFalse(Redemption.objects.exists())

        item = ManualReviewItem.objects.get(receipt=receipt)
        self.client.force_authenticate(owner)
        resp = self.client.post(
            reverse("v1:receipts:review-approve", args=[brand.id, item.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(Redemption.objects.filter(reservation=reservation).exists())


class RejectionAndDuplicateTests(APITestCase):
    def test_decline_releases_hold_and_rejects_reservation(self):
        owner, brand, product, campaign, brand_wallet = _world(reward="5.00")
        user, reservation = _claim(campaign)
        receipt = receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "Unknown Item", "quantity": 1}],
        )
        item = ManualReviewItem.objects.get(receipt=receipt)

        # A hold is currently escrowed.
        brand_wallet.refresh_from_db()
        self.assertEqual(brand_wallet.held_amount(), Decimal("5.00"))

        self.client.force_authenticate(owner)
        resp = self.client.post(
            reverse("v1:receipts:review-decline", args=[brand.id, item.id]),
            {"reason": "Illegible"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Hold released; reservation rejected; no redemption.
        brand_wallet.refresh_from_db()
        self.assertEqual(brand_wallet.held_amount(), Decimal("0.00"))
        self.assertEqual(brand_wallet.available(), Decimal("1000.00"))
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.REJECTED)
        self.assertFalse(Redemption.objects.exists())

    def test_duplicate_is_refused_and_claim_stays_open(self):
        owner, brand, product, campaign, brand_wallet = _world(reward="5.00")
        u1, r1 = _claim(campaign, "a@example.com")
        u2, r2 = _claim(campaign, "b@example.com")
        meta = dict(merchant="Acme", total=Decimal("9.99"),
                    items=[{"description": "Cola 12oz", "quantity": 1}])

        receipt_services.upload_receipt(user=u1, reservation_id=r1.id, **RECEIPT_META, **meta)
        with self.assertRaises(receipt_services.DuplicateReceipt):
            receipt_services.upload_receipt(user=u2, reservation_id=r2.id, **RECEIPT_META, **meta)

        # u1's matching receipt auto-verified (hold captured, reward issued).
        # u2's duplicate never became a receipt, so exactly one reward exists
        # and u2's claim is still open for a receipt of their own.
        r1.refresh_from_db()
        r2.refresh_from_db()
        self.assertEqual(r1.status, Reservation.Status.REDEEMED)
        self.assertEqual(r2.status, Reservation.Status.ACTIVE)
        self.assertEqual(Redemption.objects.count(), 1)
        brand_wallet.refresh_from_db()
        # Only u2's still-active claim holds escrow; u1's was captured.
        self.assertEqual(brand_wallet.held_amount(), Decimal("5.00"))


class NoDoubleIssueTests(APITestCase):
    def test_issue_reward_is_idempotent(self):
        owner, brand, product, campaign, brand_wallet = _world(reward="5.00")
        user, reservation = _claim(campaign)
        receipt = receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "Cola 12oz", "quantity": 1}],
        )
        # Already issued once via auto-verify. Calling again must not double-issue.
        from Apps.rebates.services import issue_reward

        issue_reward(receipt)
        issue_reward(receipt)
        self.assertEqual(Redemption.objects.filter(reservation=reservation).count(), 1)

        customer_wallet = wallet_services.get_or_create_customer_wallet(user)
        self.assertEqual(customer_wallet.balance, Decimal("5.00"))


class NoFeePlanTests(APITestCase):
    def test_zero_fee_when_plan_fee_is_zero(self):
        owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner"
        )
        # Brand with no plan -> no processing fee.
        brand = Brand.objects.create(name="Acme", slug="acme", plan=None)
        BrandMembership.objects.create(
            brand=brand, user=owner, role=BrandMembership.Role.OWNER
        )
        product = create_product(brand=brand, name="Cola 12oz")
        campaign = campaign_services.create_campaign(
            brand=brand, product_ids=[product.id], name="Deal",
            daily_budget=Decimal("100.00"),
        )
        campaign_services.set_tiers(
            campaign, [{"reward_amount": "5.00", "allocation_percent": "100.00"}]
        )
        bw = wallet_services.get_or_create_brand_wallet(brand)
        wallet_services.credit(
            wallet=bw, amount=Decimal("100.00"), category=LedgerEntry.Category.FUNDING
        )
        campaign_services.activate_campaign(campaign)

        user, reservation = _claim(campaign)
        receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "Cola 12oz", "quantity": 1}],
        )
        redemption = Redemption.objects.get()
        self.assertEqual(redemption.fee_amount, Decimal("0.00"))
        bw.refresh_from_db()
        self.assertEqual(bw.balance, Decimal("95.00"))  # 100 - 5, no fee
