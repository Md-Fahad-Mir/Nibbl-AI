"""Meta Pixel tracking (Master #11 + Settings §4)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.testing import go_live
from Apps.offers.services import resolve_offer
from Apps.products.services import create_product
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

PIXEL = "123456789012345"


class MetaPixelTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner")
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=Plan.objects.get(slug="pro"))
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        wallet_services.credit(wallet=wallet_services.get_or_create_brand_wallet(self.brand),
                               amount=Decimal("100"), category=LedgerEntry.Category.FUNDING)
        product = create_product(brand=self.brand, name="Chips", category="Chips")
        self.campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[product.id], name="Free chips", deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=10, estimated_redemption_rate=Decimal("100"),
        )
        go_live(self.campaign)
        self.client.force_authenticate(self.owner)
        self.tracking_url = reverse("v1:brands:brand-tracking", args=[self.brand.id])
        self.toggle_url = reverse("v1:campaigns:campaign-tracking", args=[self.brand.id, self.campaign.id])

    def test_pixel_validation_rejects_scripts_and_bad_ids(self):
        for bad in ("<script>fbq('init','1')</script>", "12345", "abc123456789012345"):
            self.assertEqual(self.client.put(self.tracking_url, {"meta_pixel_id": bad}, format="json").status_code, 400)
        data = self.client.put(self.tracking_url, {"meta_pixel_id": f" {PIXEL} "}, format="json").data
        self.assertEqual((data["meta_pixel_id"], data["meta_pixel_validated"]), (PIXEL, True))

    def test_campaign_toggle_requires_validated_pixel(self):
        self.assertEqual(self.client.post(self.toggle_url, {"meta_pixel_enabled": True}, format="json").status_code, 400)
        self.client.put(self.tracking_url, {"meta_pixel_id": PIXEL}, format="json")
        resp = self.client.post(self.toggle_url, {"meta_pixel_enabled": True}, format="json")
        self.assertTrue(resp.data["meta_pixel_enabled"])
        self.campaign.refresh_from_db()
        self.assertEqual(resolve_offer(self.campaign)["meta_pixel_id"], PIXEL)

    def test_tracking_off_or_pixel_removed_hides_pixel(self):
        self.client.put(self.tracking_url, {"meta_pixel_id": PIXEL}, format="json")
        self.assertIsNone(resolve_offer(self.campaign)["meta_pixel_id"])  # campaign toggle off
        self.client.post(self.toggle_url, {"meta_pixel_enabled": True}, format="json")
        self.client.put(self.tracking_url, {"meta_pixel_id": ""}, format="json")  # removing turns tracking off
        self.campaign.refresh_from_db()
        self.assertFalse(self.campaign.meta_pixel_enabled)
        self.assertIsNone(resolve_offer(self.campaign)["meta_pixel_id"])

    def test_member_cannot_change_pixel(self):
        member = User.objects.create_user(email="m@x.com", password="x", full_name="M")
        BrandMembership.objects.create(brand=self.brand, user=member, role=BrandMembership.Role.MEMBER)
        self.client.force_authenticate(member)
        self.assertEqual(self.client.get(self.tracking_url).status_code, 200)
        self.assertEqual(self.client.put(self.tracking_url, {"meta_pixel_id": PIXEL}, format="json").status_code, 403)
