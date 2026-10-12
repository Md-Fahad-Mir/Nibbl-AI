"""Master Notifications and Reminders + brand Settings §3 notifications."""

import datetime as dt
from decimal import Decimal
from unittest.mock import patch

from django.core import mail
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.testing import go_live, receipt_meta
from Apps.notifications import events
from Apps.notifications.models import Notification
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.reservations import services as reservation_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class EventNotificationTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner")
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=Plan.objects.get(slug="pro"))
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        self.product = create_product(brand=self.brand, name="Sea Salt Chips", category="Chips")
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("100"), category=LedgerEntry.Category.FUNDING)
        self.campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[self.product.id], name="Free chips", deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=2, estimated_redemption_rate=Decimal("100"),
            cooldown_days=0,
        )
        self.campaign.offer_headline = "Free Sea Salt Chips"
        self.campaign.save(update_fields=["offer_headline"])
        go_live(self.campaign)
        self.n = 0

    def shopper(self):
        self.n += 1
        return User.objects.create_user(email=f"s{self.n}@x.com", password="x", full_name="Sam Shopper")

    def types(self, user):
        return list(Notification.objects.filter(user=user).values_list("type", flat=True))

    def test_shopper_claim_receipt_and_decision(self):
        user = self.shopper()
        with self.captureOnCommitCallbacks(execute=True):
            reservation = reservation_services.create_reservation(user=user, campaign_id=self.campaign.id)
        self.assertIn("claim_reserved", self.types(user))
        self.assertIn("Free Sea Salt Chips", Notification.objects.get(user=user, type="claim_reserved").body)

        with self.captureOnCommitCallbacks(execute=True):
            receipt_services.upload_receipt(
                user=user, reservation_id=reservation.id, **receipt_meta("INV-1"),
                items=[{"description": "Sea Salt Chips", "quantity": 1, "unit_price": "3.00"}],
            )
        approved = Notification.objects.get(user=user, type="receipt_approved")
        self.assertIn("$3.00", approved.body)
        self.assertTrue(any(m.to == [user.email] and "Purchase verified" in m.subject for m in mail.outbox))

    def test_manual_review_and_clear_rejections(self):
        user = self.shopper()
        reservation = reservation_services.create_reservation(user=user, campaign_id=self.campaign.id)
        with self.captureOnCommitCallbacks(execute=True):
            receipt_services.upload_receipt(
                user=user, reservation_id=reservation.id, **receipt_meta("INV-2"),
                items=[{"description": "Mystery item", "quantity": 1, "unit_price": "3.00"}],
            )
        self.assertIn("receipt_submitted", self.types(user))

        other = self.shopper()
        res2 = reservation_services.create_reservation(user=other, campaign_id=self.campaign.id)
        old = timezone.now() - dt.timedelta(days=10)
        for attempt in (1, 2):
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(receipt_services.ReceiptRejected):
                    receipt_services.upload_receipt(
                        user=other, reservation_id=res2.id, **receipt_meta(f"OLD-{attempt}", purchased_at=old),
                        items=[{"description": "Sea Salt Chips", "quantity": 1, "unit_price": "3.00"}],
                    )
        bodies = list(Notification.objects.filter(user=other, type="receipt_rejected").order_by("created_at")
                      .values_list("body", flat=True))
        self.assertEqual(len(bodies), 2)
        self.assertIn("one different receipt", bodies[0])
        self.assertIn("claim is now closed", bodies[1])
        self.assertEqual(sum(1 for m in mail.outbox if m.to == [other.email]), 2)

    def test_claim_expired(self):
        user = self.shopper()
        reservation_services.create_reservation(user=user, campaign_id=self.campaign.id)
        with self.captureOnCommitCallbacks(execute=True):
            reservation_services.expire_due_reservations(now=timezone.now() + dt.timedelta(days=8))
        self.assertIn("claim_expired", self.types(user))

    def test_brand_paused_exhausted_wallet_low_and_weekly(self):
        with self.captureOnCommitCallbacks(execute=True):
            for _ in range(2):  # capacity 2 filled at once → exhausted early
                reservation_services.create_reservation(user=self.shopper(), campaign_id=self.campaign.id)
        self.assertIn("campaign_exhausted", self.types(self.owner))

        with self.captureOnCommitCallbacks(execute=True):
            campaign_services.pause_campaign(self.campaign)
        self.assertIn("campaign_paused", self.types(self.owner))

        with patch("Apps.billing.services.estimate_seven_day_requirement", return_value=Decimal("1000")):
            self.campaign.status = Campaign.Status.ACTIVE
            self.campaign.save(update_fields=["status"])
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(events.generate_wallet_low_alerts(), 1)
            self.assertEqual(events.generate_wallet_low_alerts(), 0)  # once a day
        self.assertIn("wallet_low", self.types(self.owner))

        monday = timezone.now() + dt.timedelta(days=(7 - timezone.now().weekday()) % 7)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(events.generate_weekly_summaries(now=monday), 1)
        self.assertEqual(events.generate_weekly_summaries(now=monday), 0)
        self.assertEqual(events.generate_weekly_summaries(now=monday + dt.timedelta(days=1)), 0)  # not Monday
        self.assertIn("weekly_summary", self.types(self.owner))

    def test_settings_list_follows_master(self):
        self.client.force_authenticate(self.owner)
        rows = self.client.get(reverse("v1:brands:brand-notification-preferences", args=[self.brand.id])).data
        rows = rows.get("preferences", rows) if isinstance(rows, dict) else rows
        self.assertEqual([r["label"] for r in rows][:6], [
            "Wallet below 25%", "Auto-refill failed", "Campaign paused", "Campaign exhausted early",
            "New negative review", "Weekly performance summary",
        ])
