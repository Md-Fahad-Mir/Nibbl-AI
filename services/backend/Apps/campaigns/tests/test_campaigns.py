from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services
from Apps.campaigns.models import Campaign, Restriction, RewardTier
from Apps.products.services import create_product
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def _setup_brand(owner_email="owner@example.com"):
    owner = User.objects.create_user(
        email=owner_email, password="x", full_name="Owner"
    )
    brand = Brand.objects.create(name="Acme", slug="acme")
    BrandMembership.objects.create(
        brand=brand, user=owner, role=BrandMembership.Role.OWNER
    )
    product = create_product(brand=brand, name="Cola 12oz")
    return owner, brand, product


def _fund(brand, amount):
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal(amount), category=LedgerEntry.Category.FUNDING
    )
    return wallet


class CampaignCreateTests(APITestCase):
    def setUp(self):
        self.owner, self.brand, self.product = _setup_brand()
        self.client.force_authenticate(self.owner)

    def _create(self, **overrides):
        payload = {
            "product": [str(self.product.id)],
            "name": "Summer Cashback",
            "daily_budget": "100.00",
        }
        payload.update(overrides)
        return self.client.post(
            reverse("v1:campaigns:campaign-list", args=[self.brand.id]),
            payload,
            format="json",
        )

    def test_create_generates_restriction_and_access(self):
        resp = self._create()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        campaign = Campaign.objects.get()
        self.assertEqual(campaign.status, Campaign.Status.DRAFT)
        self.assertTrue(hasattr(campaign, "restriction"))
        self.assertTrue(hasattr(campaign, "campaign_url"))
        self.assertTrue(hasattr(campaign, "qr_code"))

    def test_min_units_generates_restriction_text(self):
        self._create(min_purchase_units=2)
        restriction = Restriction.objects.get()
        self.assertEqual(restriction.restriction_type, Restriction.Type.MIN_UNITS)
        self.assertEqual(restriction.description, "Buy 2 units required")

    def test_bogo_generates_restriction_text(self):
        self._create(is_bogo=True)
        restriction = Restriction.objects.get()
        self.assertEqual(restriction.restriction_type, Restriction.Type.BOGO)
        self.assertIn("BOGO", restriction.description)

    def test_product_from_other_brand_rejected(self):
        other_owner = User.objects.create_user(
            email="o2@example.com", password="x", full_name="O2"
        )
        other_brand = Brand.objects.create(name="Other", slug="other")
        BrandMembership.objects.create(
            brand=other_brand, user=other_owner, role=BrandMembership.Role.OWNER
        )
        foreign_product = create_product(brand=other_brand, name="Foreign")
        resp = self._create(product=str(foreign_product.id))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class TierTests(APITestCase):
    def setUp(self):
        self.owner, self.brand, self.product = _setup_brand()
        self.campaign = services.create_campaign(
            brand=self.brand, product_ids=[self.product.id],
            name="C", daily_budget=Decimal("100.00"),
        )
        self.client.force_authenticate(self.owner)
        self.url = reverse(
            "v1:campaigns:campaign-tiers", args=[self.brand.id, self.campaign.id]
        )

    def test_tiers_must_sum_to_100(self):
        resp = self.client.put(
            self.url,
            {"tiers": [
                {"reward_amount": "5.00", "allocation_percent": "60.00"},
                {"reward_amount": "2.00", "allocation_percent": "30.00"},
            ]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(RewardTier.objects.count(), 0)

    def test_valid_tiers_saved_in_waterfall_order(self):
        resp = self.client.put(
            self.url,
            {"tiers": [
                {"reward_amount": "2.00", "allocation_percent": "30.00"},
                {"reward_amount": "5.00", "allocation_percent": "50.00"},
                {"reward_amount": "1.00", "allocation_percent": "20.00"},
            ]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        amounts = [Decimal(t["reward_amount"]) for t in resp.data]
        self.assertEqual(
            amounts, [Decimal("5.00"), Decimal("2.00"), Decimal("1.00")]
        )

    def test_setting_tiers_replaces_previous(self):
        services.set_tiers(
            self.campaign,
            [{"reward_amount": "5.00", "allocation_percent": "100.00"}],
        )
        self.client.put(
            self.url,
            {"tiers": [
                {"reward_amount": "3.00", "allocation_percent": "100.00"},
            ]},
            format="json",
        )
        self.assertEqual(RewardTier.objects.count(), 1)
        self.assertEqual(RewardTier.objects.get().reward_amount, Decimal("3.00"))


class ActivationFundingTests(APITestCase):
    def setUp(self):
        self.owner, self.brand, self.product = _setup_brand()
        self.campaign = services.create_campaign(
            brand=self.brand, product_ids=[self.product.id],
            name="C", daily_budget=Decimal("100.00"),
        )
        services.set_tiers(
            self.campaign,
            [{"reward_amount": "5.00", "allocation_percent": "100.00"}],
        )
        self.client.force_authenticate(self.owner)
        self.activate_url = reverse(
            "v1:campaigns:campaign-activate", args=[self.brand.id, self.campaign.id]
        )

    def test_cannot_activate_without_funds(self):
        resp = self.client.post(self.activate_url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.Status.DRAFT)

    def test_activate_with_funds(self):
        _fund(self.brand, "100.00")
        resp = self.client.post(self.activate_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.status, Campaign.Status.ACTIVE)

    def test_cannot_activate_without_tiers(self):
        bare = services.create_campaign(
            brand=self.brand, product_ids=[self.product.id],
            name="Bare", daily_budget=Decimal("10.00"),
        )
        _fund(self.brand, "1000.00")
        resp = self.client.post(
            reverse("v1:campaigns:campaign-activate", args=[self.brand.id, bare.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class FundingSyncTests(APITestCase):
    def test_underfunded_active_campaign_pauses_then_resumes(self):
        owner, brand, product = _setup_brand()
        campaign = services.create_campaign(
            brand=brand, product_ids=[product.id],
            name="C", daily_budget=Decimal("100.00"),
        )
        services.set_tiers(
            campaign, [{"reward_amount": "5.00", "allocation_percent": "100.00"}]
        )
        wallet = _fund(brand, "100.00")
        services.activate_campaign(campaign)

        # Drain the wallet -> campaign should auto-pause.
        wallet_services.debit(
            wallet=wallet, amount=Decimal("100.00"),
            category=LedgerEntry.Category.ADJUSTMENT,
        )
        services.sync_funding_state(brand)
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, Campaign.Status.PAUSED)
        self.assertTrue(campaign.auto_paused)

        # Re-fund -> campaign should auto-resume.
        wallet_services.credit(
            wallet=wallet, amount=Decimal("100.00"),
            category=LedgerEntry.Category.FUNDING,
        )
        services.sync_funding_state(brand)
        campaign.refresh_from_db()
        self.assertEqual(campaign.status, Campaign.Status.ACTIVE)
        self.assertFalse(campaign.auto_paused)


class PreviewTests(APITestCase):
    def test_preview_has_best_offer_and_no_side_effects(self):
        owner, brand, product = _setup_brand()
        campaign = services.create_campaign(
            brand=brand, product_ids=[product.id],
            name="C", daily_budget=Decimal("100.00"),
        )
        services.set_tiers(
            campaign,
            [
                {"reward_amount": "5.00", "allocation_percent": "50.00"},
                {"reward_amount": "2.00", "allocation_percent": "50.00"},
            ],
        )
        _fund(brand, "100.00")
        self.client.force_authenticate(owner)

        ledger_before = LedgerEntry.objects.count()
        resp = self.client.get(
            reverse("v1:campaigns:campaign-preview", args=[brand.id, campaign.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(resp.data["best_offer"]), Decimal("5.00"))
        self.assertFalse(resp.data["consumes_budget"])
        self.assertFalse(resp.data["creates_reservation"])
        # No ledger movement, no holds created by previewing.
        self.assertEqual(LedgerEntry.objects.count(), ledger_before)

    def test_preview_works_on_draft(self):
        owner, brand, product = _setup_brand()
        campaign = services.create_campaign(
            brand=brand, product_ids=[product.id],
            name="Draft", daily_budget=Decimal("50.00"),
        )
        self.client.force_authenticate(owner)
        resp = self.client.get(
            reverse("v1:campaigns:campaign-preview", args=[brand.id, campaign.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.data["best_offer"])


class TenantIsolationTests(APITestCase):
    def test_non_member_cannot_list_campaigns(self):
        owner, brand, product = _setup_brand()
        outsider = User.objects.create_user(
            email="out@example.com", password="x", full_name="Out"
        )
        self.client.force_authenticate(outsider)
        resp = self.client.get(
            reverse("v1:campaigns:campaign-list", args=[brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
