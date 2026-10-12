"""Master onboarding ⑪: wallet funding required before launch."""

from decimal import Decimal

from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import AutoRefill, Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.products.services import create_product
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


@override_settings(LAUNCH_FUNDING_REQUIRED=True)
class LaunchFundingTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner")
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=Plan.objects.get(slug="pro"))
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        product = create_product(brand=self.brand, name="Chips", category="Snacks")
        self.campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[product.id], name="Free chips", deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=2, estimated_redemption_rate=Decimal("100"),
            cooldown_days=0, offer_headline="Free chips",
        )
        self.client.force_authenticate(self.owner)
        self.ready_url = reverse("v1:campaigns:campaign-launch-readiness", args=[self.brand.id, self.campaign.id])
        self.submit_url = reverse("v1:campaigns:campaign-submit", args=[self.brand.id, self.campaign.id])

    def test_submit_blocked_until_funded_and_auto_replenishment_on(self):
        state = self.client.get(self.ready_url).data
        # $5 reward + 15% fee = $5.75 × capacity 2 × 7 cycles = $80.50
        self.assertEqual((state["seven_day_requirement"], state["minimum_needed"], state["ready"]),
                         ("80.50", "80.50", False))
        blocked = self.client.post(self.submit_url)
        self.assertEqual(blocked.status_code, 400)
        self.assertIn("Fund your campaign before launch", str(blocked.data))

        wallet_services.credit(wallet=wallet_services.get_or_create_brand_wallet(self.brand),
                               amount=Decimal("100"), category=LedgerEntry.Category.FUNDING)
        self.assertIn("auto-replenishment", str(self.client.post(self.submit_url).data))

        AutoRefill.objects.update_or_create(brand=self.brand, defaults={
            "enabled": True, "amount": Decimal("100"), "stripe_payment_method_id": "pm_1"})
        self.assertTrue(self.client.get(self.ready_url).data["ready"])
        self.assertEqual(self.client.post(self.submit_url).status_code, 200)
