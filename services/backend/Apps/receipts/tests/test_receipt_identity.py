"""Duplicate fingerprint + quantity allocation (Master #19)."""

import importlib
from decimal import Decimal

from django.apps import apps
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.testing import RECEIPT_META, go_live
from Apps.products.services import create_product
from Apps.rebates.models import Redemption
from Apps.receipts import services
from Apps.receipts.models import ManualReviewItem, Receipt, ReceiptIdentity, ReceiptUnitAllocation
from Apps.reservations import services as reservation_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

MERCHANT = "Acme Mart"


class _World(APITestCase):
    def setUp(self):
        self.brand = Brand.objects.create(name="Acme", slug="acme")
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="O")
        self.product = create_product(brand=self.brand, name="Cola 12oz", category="Drinks")
        wallet_services.credit(
            wallet=wallet_services.get_or_create_brand_wallet(self.brand),
            amount=Decimal("500"), category=LedgerEntry.Category.FUNDING,
        )
        self.campaigns = [self.make_campaign(f"Deal {i}") for i in range(3)]
        self.shopper = User.objects.create_user(email="s@x.com", password="x", full_name="S")

    def make_campaign(self, name):
        campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[self.product.id], name=name,
            deal_type=Campaign.DealType.FREE, max_rebate=Decimal("5.00"),
            desired_redemptions=10, estimated_redemption_rate=Decimal("100"),
        )
        go_live(campaign)
        return campaign

    def upload(self, user, campaign, *, quantity=1, number="INV-1", register="", description="Cola 12oz"):
        reservation = reservation_services.create_reservation(user=user, campaign_id=campaign.id)
        return services.upload_receipt(
            user=user, reservation_id=reservation.id, purchased_at=RECEIPT_META["purchased_at"],
            receipt_number=number, register_number=register, merchant=MERCHANT,
            items=[{"description": description, "quantity": quantity, "unit_price": "2.00"}],
        )


class QuantityAllocationTests(_World):
    def test_quantity_two_funds_two_claims_never_a_third(self):
        first = self.upload(self.shopper, self.campaigns[0], quantity=2)
        second = self.upload(self.shopper, self.campaigns[1], quantity=2)
        self.assertEqual((first.status, second.status), (Receipt.Status.VERIFIED, Receipt.Status.VERIFIED))
        self.assertEqual(first.identity_id, second.identity_id)  # one physical receipt
        with self.assertRaises(services.DuplicateReceipt):
            self.upload(self.shopper, self.campaigns[2], quantity=2)
        # Each redemption records the line + unit it used.
        units = ReceiptUnitAllocation.objects.order_by("unit_index")
        self.assertEqual([(u.receipt_id, u.unit_index) for u in units], [(first.id, 1), (second.id, 2)])
        self.assertTrue(all(u.line_item_id for u in units))
        self.assertEqual(Redemption.objects.count(), 2)

    def test_manual_review_selection_allocates_the_unit(self):
        receipt = self.upload(self.shopper, self.campaigns[0], description="CLA 12 OZ")  # → manual review
        item = ManualReviewItem.objects.get(receipt=receipt)
        services.approve_review(
            item=item, reviewer=self.owner,
            lines=[{"line_item": receipt.line_items.get().id}], product_id=self.product.id,
        )
        self.assertEqual(ReceiptUnitAllocation.objects.get().receipt_id, receipt.id)
        # The same receipt again: unrecognised wording → manual review, and
        # the brand can't credit the already-used unit a second time.
        again = self.upload(self.shopper, self.campaigns[1], description="CLA 12 OZ")
        self.assertEqual(again.status, Receipt.Status.PENDING)
        with self.assertRaises(services.DuplicateReceipt):
            services.approve_review(
                item=ManualReviewItem.objects.get(receipt=again), reviewer=self.owner,
                lines=[{"line_item": again.line_items.get().id}], product_id=self.product.id,
            )

    def test_rejected_receipt_frees_its_units(self):
        receipt = self.upload(self.shopper, self.campaigns[0], description="CLA 12 OZ")
        item = ManualReviewItem.objects.get(receipt=receipt)
        services.decline_review(item=item, reviewer=self.owner, reason_code="item_not_found")
        self.assertFalse(ReceiptUnitAllocation.objects.exists())
        again = self.upload(self.shopper, self.campaigns[1])
        self.assertEqual(again.status, Receipt.Status.VERIFIED)


class OneAccountTests(_World):
    def test_another_account_cannot_use_the_receipt(self):
        self.upload(self.shopper, self.campaigns[0])
        other = User.objects.create_user(email="z@x.com", password="x", full_name="Z")
        with self.assertRaisesMessage(services.DuplicateReceipt, "another account"):
            self.upload(other, self.campaigns[1])

    def test_other_account_allowed_once_every_earlier_upload_was_rejected(self):
        receipt = self.upload(self.shopper, self.campaigns[0], description="CLA 12 OZ")
        services.decline_review(
            item=ManualReviewItem.objects.get(receipt=receipt), reviewer=self.owner, reason_code="item_not_found"
        )
        other = User.objects.create_user(email="z@x.com", password="x", full_name="Z")
        mine = self.upload(other, self.campaigns[1])
        self.assertEqual(mine.status, Receipt.Status.VERIFIED)
        self.assertEqual(ReceiptIdentity.objects.get().owner, other)

    def test_different_register_is_a_different_receipt(self):
        self.upload(self.shopper, self.campaigns[0], number="", register="3")
        other = User.objects.create_user(email="z@x.com", password="x", full_name="Z")
        receipt = self.upload(other, self.campaigns[1], number="", register="7")
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        self.assertEqual(ReceiptIdentity.objects.count(), 2)

    def test_unidentifiable_receipt_gets_no_identity(self):
        reservation = reservation_services.create_reservation(user=self.shopper, campaign_id=self.campaigns[0].id)
        receipt = services.upload_receipt(
            user=self.shopper, reservation_id=reservation.id, purchased_at=RECEIPT_META["purchased_at"],
            items=[{"description": "Cola 12oz", "quantity": 1, "unit_price": "2.00"}],
        )  # no merchant
        self.assertIsNone(receipt.identity_id)


class BackfillTests(_World):
    def test_existing_receipts_get_identity_and_units(self):
        receipt = self.upload(self.shopper, self.campaigns[0])
        ReceiptUnitAllocation.objects.all().delete()
        Receipt.objects.update(identity=None)
        ReceiptIdentity.objects.all().delete()

        migration = importlib.import_module("Apps.receipts.migrations.0007_backfill_receipt_identities")
        migration.forwards(apps, None)

        receipt.refresh_from_db()
        self.assertIsNotNone(receipt.identity_id)
        self.assertEqual(ReceiptUnitAllocation.objects.get().receipt_id, receipt.id)
        with self.assertRaises(services.DuplicateReceipt):  # the old receipt can't be reused
            self.upload(self.shopper, self.campaigns[1])
