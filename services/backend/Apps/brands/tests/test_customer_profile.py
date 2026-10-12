"""Master Customers → Customer Profile, cooldown removal, ban, 30-day receipts."""

import datetime as dt
import shutil
import tempfile
from decimal import Decimal

from django.core.files.base import ContentFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.models import AuditLog
from Apps.common.testing import go_live, receipt_meta
from Apps.offers.services import is_in_cooldown
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.receipts.models import Receipt
from Apps.receipts.retention import purge_expired_images
from Apps.reservations import services as reservation_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA)
class CustomerProfileTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(MEDIA, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner")
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=Plan.objects.get(slug="pro"))
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        product = create_product(brand=self.brand, name="Vanilla Granola", category="Snacks")
        wallet_services.credit(wallet=wallet_services.get_or_create_brand_wallet(self.brand), amount=Decimal("100"),
                               category=LedgerEntry.Category.FUNDING)
        self.campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[product.id], name="Free granola", deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=20, estimated_redemption_rate=Decimal("100"),
            cooldown_days=30, offer_headline="Free Acme Granola",
        )
        go_live(self.campaign)
        self.shopper = User.objects.create_user(email="maya@x.com", password="x", full_name="Maya Thompson")
        reservation = reservation_services.create_reservation(user=self.shopper, campaign_id=self.campaign.id)
        self.receipt = receipt_services.upload_receipt(
            user=self.shopper, reservation_id=reservation.id, **receipt_meta("INV-1"), merchant="Target",
            items=[{"description": "Vanilla Granola", "quantity": 1, "unit_price": "4.00"},
                   {"description": "Milk", "quantity": 1, "unit_price": "3.00"}],
        )
        self.receipt.image.save("r.jpg", ContentFile(b"receipt"), save=True)
        self.client.force_authenticate(self.owner)
        self.url = reverse("v1:brands:customer-profile", args=[self.brand.id, self.shopper.id])

    def test_profile_sections(self):
        data = self.client.get(self.url).data
        self.assertEqual((data["name"], data["email"], data["status"]), ("Maya Thompson", "maya@x.com", "active"))
        rel = data["relationship"]
        self.assertEqual((rel["claims"], rel["completed_rebates"], rel["conversion"], rel["open_claims"]), (1, 1, 100, 0))
        self.assertEqual(data["nibbl_activity"]["total_claims"], 1)
        self.assertEqual([c["kind"] for c in data["cooldowns"]], ["rebate"])
        row = data["redemption_history"][0]
        self.assertEqual((row["status"], row["retailer"], row["reward"]), ("approved", "Target", "4.00"))
        self.assertTrue(row["receipt_image"])
        self.assertEqual([li["description"] for li in row["matching_lines"]], ["Vanilla Granola"])  # never "Milk"
        self.assertTrue(any(e["text"].startswith("Claimed Free Acme Granola") for e in data["recent_activity"]))

        listing = self.client.get(reverse("v1:brands:customer-list", args=[self.brand.id])).data["customers"][0]
        self.assertEqual((listing["brand_claims"], listing["site_activity"]["claims"]), (1, 1))
        self.assertIsNotNone(listing["cooldown_days_left"])

    def test_remove_cooldown_is_audited_and_restores_eligibility(self):
        cooldown = self.client.get(self.url).data["cooldowns"][0]
        self.assertTrue(is_in_cooldown(self.shopper, self.campaign))
        url = reverse("v1:brands:customer-cooldown-remove", args=[self.brand.id, self.shopper.id])
        data = self.client.post(url, {"kind": "rebate", "id": cooldown["id"]}, format="json").data
        self.assertEqual(data["cooldowns"], [])
        self.assertFalse(is_in_cooldown(self.shopper, self.campaign))
        self.assertTrue(AuditLog.objects.filter(target_type="customer_cooldown", metadata__event="cooldown_removed").exists())

    def test_ban_shows_in_profile(self):
        self.client.post(reverse("v1:brands:customer-action", args=[self.brand.id, self.shopper.id, "suspend"]),
                         {"reason": "Suspicious claim activity"}, format="json")
        data = self.client.get(self.url).data
        self.assertEqual((data["status"], data["ban_reason"]), ("banned", "Suspicious claim activity"))

    def test_full_receipt_for_30_days_then_matching_line_only(self):
        Receipt.objects.filter(id=self.receipt.id).update(created_at=timezone.now() - dt.timedelta(days=31))
        self.assertEqual(purge_expired_images(), 1)
        self.receipt.refresh_from_db()
        self.assertFalse(self.receipt.image)
        self.assertIsNotNone(self.receipt.image_purged_at)
        row = self.client.get(self.url).data["redemption_history"][0]
        self.assertIsNone(row["receipt_image"])
        self.assertEqual([li["description"] for li in row["matching_lines"]], ["Vanilla Granola"])
        self.assertEqual(purge_expired_images(), 0)

    def test_starter_plan_limits_identity(self):
        self.brand.plan = Plan.objects.get(slug="starter")
        self.brand.save()
        listing = self.client.get(reverse("v1:brands:customer-list", args=[self.brand.id])).data["customers"][0]
        url = reverse("v1:brands:customer-profile", args=[self.brand.id, listing["user_id"]])
        data = self.client.get(url).data
        self.assertEqual((data["name"], data["email"]), ("Maya T.", None))
