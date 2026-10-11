"""Rebate Restriction Pop-ups: each claim restriction has its own code (Master)."""

import datetime as dt
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.testing import go_live
from Apps.products.services import create_product
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class RestrictionCodeTests(APITestCase):
    def setUp(self):
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=Plan.objects.get(slug="pro"))
        wallet_services.credit(wallet=wallet_services.get_or_create_brand_wallet(self.brand), amount=Decimal("100"),
                               category=LedgerEntry.Category.FUNDING)
        self.product = create_product(brand=self.brand, name="Chips", category="Chips")
        self.shopper = User.objects.create_user(email="s@x.com", password="x", full_name="S")
        self.client.force_authenticate(self.shopper)

    def campaign(self, **extra):
        campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[self.product.id], name="Free chips", deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=10, estimated_redemption_rate=Decimal("100"), **extra,
        )
        go_live(campaign)
        return campaign

    def claim(self, campaign):
        return self.client.post(reverse("v1:reservations:reservation-list"),
                                {"campaign": str(campaign.id), "consent_nibbl": True, "consent_brand": True},
                                format="json")

    def test_codes(self):
        live = self.campaign()
        self.assertEqual(self.claim(live).status_code, 201)
        self.assertEqual(self.claim(live).data["code"], "already_claimed")

        later = self.campaign(start_at=timezone.now() + dt.timedelta(days=3))
        self.assertEqual(self.claim(later).data["code"], "not_started")

        paused = self.campaign()
        campaign_services.pause_campaign(paused)
        self.assertEqual(self.claim(paused).data["code"], "paused_or_ended")
