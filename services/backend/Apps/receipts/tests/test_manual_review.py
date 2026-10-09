"""Manual-review decisions (Master #21) and seven-day auto-approval (#22)."""

import datetime as dt
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.models import AuditLog
from Apps.common.testing import go_live, receipt_meta
from Apps.products.models import ProductAlias
from Apps.products.services import create_product
from Apps.rebates.models import Redemption
from Apps.receipts import services
from Apps.receipts.models import ManualReviewItem, Receipt
from Apps.reservations import services as reservation_services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

O = ManualReviewItem.Outcome


class _World(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="owner@x.com", password="x", full_name="O")
        self.brand = Brand.objects.create(name="Acme", slug="acme")
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        self.product = create_product(brand=self.brand, name="Sea Salt Chips", category="Chips")
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("1000.00"), category=LedgerEntry.Category.FUNDING)
        self.campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[self.product.id], name="BOGO",
            deal_type=Campaign.DealType.BOGO_FREE, max_rebate=Decimal("5.00"),
            desired_redemptions=50, estimated_redemption_rate=Decimal("100"),
        )
        go_live(self.campaign)
        self.n = 0

    def claim_and_upload(self, items, number=None):
        self.n += 1
        user = User.objects.create_user(email=f"s{self.n}@x.com", password="x", full_name="S")
        reservation = reservation_services.create_reservation(user=user, campaign_id=self.campaign.id)
        receipt = services.upload_receipt(
            user=user, reservation_id=reservation.id, **receipt_meta(number or f"INV-{self.n}"), items=items,
        )
        return reservation, receipt

    def unmatched(self, number=None, price="4.98"):
        """Two units of an unrecognised wording → manual review."""
        reservation, receipt = self.claim_and_upload(
            [{"description": "SS CHIPS 5OZ", "quantity": 2, "unit_price": price}], number
        )
        self.assertEqual(receipt.status, Receipt.Status.PENDING)
        return reservation, receipt, ManualReviewItem.objects.get(receipt=receipt)

    def url(self, name, item):
        return reverse(f"v1:receipts:{name}", args=[self.brand.id, item.id])

    def selection(self, receipt, **line):
        return {"lines": [{"line_item": str(receipt.line_items.get().id), **line}],
                "product": str(self.product.id)}


class ReviewDecisionTests(_World):
    def test_select_lines_pays_calculated_reward_and_returns_the_rest(self):
        reservation, receipt, item = self.unmatched()
        self.client.force_authenticate(self.owner)
        preview = self.client.post(self.url("review-preview", item), self.selection(receipt), format="json")
        self.assertEqual(preview.data, {"reward": "4.98"})  # lower unit, under the $5 cap
        item.refresh_from_db()
        self.assertEqual(item.status, ManualReviewItem.Status.OPEN)  # preview decides nothing

        resp = self.client.post(self.url("review-approve", item), self.selection(receipt), format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        item.refresh_from_db()
        self.assertEqual((item.outcome, item.calculated_reward), (O.BRAND_APPROVED, Decimal("4.98")))
        self.assertEqual(Redemption.objects.get().reward_amount, Decimal("4.98"))
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.held_amount(), Decimal("0.00"))
        # Mapping applies to this receipt only — no alias unless asked.
        self.assertFalse(ProductAlias.objects.exists())

    def test_reward_is_capped_and_corrections_are_audited(self):
        _, receipt, item = self.unmatched(price=None)
        self.client.force_authenticate(self.owner)
        missing = self.client.post(self.url("review-approve", item), self.selection(receipt), format="json")
        self.assertEqual(missing.status_code, 400)
        self.assertIn("Enter the price", missing.data["detail"])

        resp = self.client.post(
            self.url("review-approve", item), self.selection(receipt, unit_price="7.50"), format="json"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Redemption.objects.get().reward_amount, Decimal("5.00"))  # capped
        log = AuditLog.objects.get(target_type="receipt_line_item")
        self.assertEqual((log.metadata["before"]["unit_price"], log.metadata["after"]["unit_price"]), (None, "7.50"))

    def test_quantity_and_product_are_validated(self):
        _, receipt, item = self.unmatched()
        self.client.force_authenticate(self.owner)
        one = self.client.post(self.url("review-approve", item), self.selection(receipt, quantity=1), format="json")
        self.assertIn("needs 2 qualifying unit", one.data["detail"])
        other = create_product(brand=self.brand, name="Cola", category="Drinks")
        body = self.selection(receipt)
        body["product"] = str(other.id)
        wrong = self.client.post(self.url("review-approve", item), body, format="json")
        self.assertIn("eligible products", wrong.data["detail"])
        no_selection = self.client.post(self.url("review-approve", item), {}, format="json")
        self.assertEqual(no_selection.status_code, 400)  # can't calculate without lines
        self.assertFalse(Redemption.objects.exists())

    def test_reject_with_standard_reason(self):
        reservation, receipt, item = self.unmatched()
        self.client.force_authenticate(self.owner)
        bad = self.client.post(self.url("review-decline", item), {"reason_code": "nope"}, format="json")
        self.assertEqual(bad.status_code, 400)
        resp = self.client.post(
            self.url("review-decline", item), {"reason_code": "price_not_visible"}, format="json"
        )
        self.assertEqual(resp.status_code, 200)
        receipt.refresh_from_db()
        item.refresh_from_db()
        self.assertEqual(receipt.decision_reason, "Price not visible")
        self.assertEqual((item.outcome, item.rejection_reason), (O.BRAND_REJECTED, "price_not_visible"))
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.REJECTED)

    def test_save_alias_rechecks_other_pending_receipts(self):
        _, receipt, item = self.unmatched()
        _, other_receipt, other_item = self.unmatched(price="3.00")
        self.client.force_authenticate(self.owner)
        body = {**self.selection(receipt), "save_alias": True}
        resp = self.client.post(self.url("review-approve", item), body, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(ProductAlias.objects.filter(alias_text="SS CHIPS 5OZ").exists())
        other_item.refresh_from_db()
        self.assertEqual((other_item.outcome, other_item.calculated_reward), (O.ALIAS_APPROVED, Decimal("3.00")))
        self.assertEqual(Redemption.objects.count(), 2)

    def test_queue_shows_deadline_and_locked_terms(self):
        _, receipt, item = self.unmatched()
        self.assertEqual(item.deadline_at, receipt.created_at + dt.timedelta(days=7))
        self.client.force_authenticate(self.owner)
        row = self.client.get(reverse("v1:receipts:review-queue", args=[self.brand.id])).data[0]
        terms = row["locked_terms"]
        self.assertEqual((terms["deal_type"], terms["required_units"], terms["max_reward"]), ("bogo_free", 2, "5.00"))
        self.assertEqual(terms["eligible_products"], [{"id": str(self.product.id), "name": "Sea Salt Chips"}])
        services.decline_review(item=item, reviewer=self.owner, reason_code="item_not_found")
        url = reverse("v1:receipts:review-queue", args=[self.brand.id])
        self.assertEqual(len(self.client.get(url).data), 0)
        done = self.client.get(url, {"status": "resolved"}).data
        self.assertEqual(done[0]["rejection_reason_label"], "Eligible item not found")


class SevenDayAutoApprovalTests(_World):
    def test_overdue_receipt_is_approved_at_the_maximum(self):
        reservation, receipt, item = self.unmatched(price="1.00")
        _, _, fresh = self.unmatched()
        later = timezone.now() + dt.timedelta(days=7, minutes=1)
        # The claim's own 7 days pass too — a receipt under review keeps it.
        self.assertEqual(reservation_services.expire_due_reservations(now=later), 0)

        result = services.auto_approve_overdue(now=later - dt.timedelta(minutes=2))
        self.assertEqual(result, {"approved": 0, "rejected": 0, "skipped": 0})
        result = services.auto_approve_overdue(now=later)
        self.assertEqual(result["approved"], 2)
        item.refresh_from_db()
        self.assertEqual(item.outcome, O.AUTO_APPROVED)
        receipt.refresh_from_db()
        self.assertEqual(receipt.decision_reason, "Automatically Approved — Review Deadline Passed")
        # Maximum reward even though the readable price was $1.00.
        self.assertEqual(Redemption.objects.get(receipt=receipt).reward_amount, Decimal("5.00"))
        self.assertFalse(ProductAlias.objects.exists())

    def test_overdue_duplicate_is_rejected(self):
        # The DB already refuses two receipts with one identity; this is the
        # safety net if a duplicate ever reaches the deadline anyway.
        from unittest.mock import patch

        reservation, _, item = self.unmatched()
        with patch.object(services, "_assert_single_use", side_effect=services.DuplicateReceipt("dup")):
            result = services.auto_approve_overdue(now=timezone.now() + dt.timedelta(days=8))
        self.assertEqual(result["rejected"], 1)
        item.refresh_from_db()
        self.assertEqual((item.outcome, item.rejection_reason), (O.AUTO_REJECTED, "duplicate"))
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.REJECTED)
        self.assertFalse(Redemption.objects.exists())

    def test_expired_claim_without_receipt_still_expires(self):
        user = User.objects.create_user(email="lazy@x.com", password="x", full_name="L")
        reservation_services.create_reservation(user=user, campaign_id=self.campaign.id)
        later = timezone.now() + dt.timedelta(days=8)
        self.assertEqual(reservation_services.expire_due_reservations(now=later), 1)
