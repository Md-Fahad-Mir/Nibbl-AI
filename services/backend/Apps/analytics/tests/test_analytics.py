from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.analytics import services
from Apps.analytics.models import CampaignStat, PlatformStat, ProductStat
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.reservations import services as reservation_services
from Apps.reviews import services as review_services
from Apps.reviews.models import ReviewSession
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry
from Apps.common.testing import RECEIPT_META, receipt_meta


def _brand(slug="acme", plan="starter"):
    owner = User.objects.create_user(email=f"{slug}@example.com", password="x", full_name="O")
    brand = Brand.objects.create(name=slug.title(), slug=slug, plan=Plan.objects.get(slug=plan))
    BrandMembership.objects.create(brand=brand, user=owner, role=BrandMembership.Role.OWNER)
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(wallet=wallet, amount=Decimal("1000.00"), category=LedgerEntry.Category.FUNDING)
    return owner, brand, wallet


def _full_flow(brand, *, email="c@example.com"):
    """Claim → verified receipt → rebate redemption + a submitted review."""
    product = create_product(brand=brand, name="Cola")
    rebate = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Deal", daily_budget=Decimal("100.00")
    )
    campaign_services.set_tiers(rebate, [{"reward_amount": "5.00", "allocation_percent": "100.00"}])
    campaign_services.activate_campaign(rebate)

    review_campaign = review_services.create_review_campaign(
        brand=brand, name="R", daily_budget=Decimal("100.00"),
        reward_amount=Decimal("1.00"), product_ids=[product.id],
    )
    review_services.generate_ai_prompts(review_campaign)
    review_services.activate_review_campaign(review_campaign)

    user = User.objects.create_user(email=email, password="x", full_name="U")
    reservation = reservation_services.create_reservation(user=user, campaign_id=rebate.id)
    receipt_services.upload_receipt(
        user=user, reservation_id=reservation.id, **RECEIPT_META,
        items=[{"description": "Cola", "quantity": 1}],
    )  # auto-verifies -> redemption + review opportunity
    session = ReviewSession.objects.get(user=user, product=product)
    review_services.submit_review(session, rating=5, content="Great")
    return user, product, rebate


class BrandOverviewTests(APITestCase):
    def test_overview_matches_source_data(self):
        owner, brand, wallet = _brand(plan="starter")  # rebate fee 20%, review fee 0.30
        _full_flow(brand)

        o = services.brand_overview(brand)
        self.assertEqual(o["reservations"], 1)
        self.assertEqual(o["redemptions"], 1)
        self.assertEqual(o["approvals"], 1)  # one verified receipt
        self.assertEqual(o["reviews"], 1)
        self.assertEqual(o["published_reviews"], 1)
        self.assertEqual(o["average_rating"], Decimal("5.00"))
        # Spend: rebate reward 5 + fee 1.00 (20%) + review reward 1 + review fee 0.30
        self.assertEqual(o["spend"]["rebate_reward"], Decimal("5.00"))
        self.assertEqual(o["spend"]["rebate_fee"], Decimal("1.00"))
        self.assertEqual(o["spend"]["review_reward"], Decimal("1.00"))
        self.assertEqual(o["spend"]["review_fee"], Decimal("0.30"))
        self.assertEqual(o["spend"]["total"], Decimal("7.30"))

    def test_tenant_isolation(self):
        owner_a, brand_a, _ = _brand("acme")
        owner_b, brand_b, _ = _brand("globex")
        _full_flow(brand_a)

        b = services.brand_overview(brand_b)
        self.assertEqual(b["reservations"], 0)
        self.assertEqual(b["redemptions"], 0)
        self.assertEqual(b["spend"]["total"], Decimal("0.00"))

    def test_api_overview_requires_membership(self):
        owner, brand, _ = _brand()
        outsider = User.objects.create_user(email="out@example.com", password="x", full_name="X")
        self.client.force_authenticate(outsider)
        resp = self.client.get(reverse("v1:analytics:brand-overview", args=[brand.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_api_overview_for_member(self):
        owner, brand, _ = _brand()
        _full_flow(brand)
        self.client.force_authenticate(owner)
        resp = self.client.get(reverse("v1:analytics:brand-overview", args=[brand.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["redemptions"], 1)


class CampaignProductMetricsTests(APITestCase):
    def test_campaign_and_product_metrics(self):
        owner, brand, _ = _brand()
        user, product, rebate = _full_flow(brand)

        cm = services.campaign_metrics(rebate)
        self.assertEqual(cm["redemptions"], 1)
        self.assertEqual(cm["total_spend"], Decimal("6.00"))  # 5 reward + 1 fee

        pm = services.product_metrics(product)
        self.assertEqual(pm["redemptions"], 1)
        self.assertEqual(pm["reviews_count"], 1)
        self.assertEqual(pm["average_rating"], Decimal("5.00"))


class SnapshotRefreshTests(APITestCase):
    def test_refresh_is_idempotent(self):
        owner, brand, _ = _brand()
        _full_flow(brand)

        services.refresh_all()
        services.refresh_all()  # second run must not duplicate rows

        self.assertEqual(CampaignStat.objects.count(), 1)
        self.assertEqual(ProductStat.objects.count(), 1)
        self.assertEqual(PlatformStat.objects.count(), 1)

        stat = CampaignStat.objects.get()
        self.assertEqual(stat.redemptions, 1)
        self.assertEqual(stat.total_spend, Decimal("6.00"))


class PlatformAnalyticsTests(APITestCase):
    def test_platform_overview_counts(self):
        owner, brand, _ = _brand()
        _full_flow(brand)
        o = services.platform_overview()
        self.assertEqual(o["brands_total"], 1)
        self.assertEqual(o["redemptions_total"], 1)
        self.assertEqual(o["reviews_total"], 1)
        # Customer received rebate 5 + review 1.
        self.assertEqual(o["total_reward_paid"], Decimal("6.00"))
        # Platform fees: rebate 1.00 + review 0.30.
        self.assertEqual(o["total_fees"], Decimal("1.30"))

    def test_platform_endpoint_requires_admin(self):
        owner, brand, _ = _brand()
        self.client.force_authenticate(owner)
        resp = self.client.get(reverse("v1:analytics:platform-overview"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_platform_endpoint_for_admin(self):
        admin = User.objects.create_user(
            email="admin@example.com", password="x", full_name="A",
            role=User.Role.ADMIN, is_staff=True,
        )
        self.client.force_authenticate(admin)
        resp = self.client.get(reverse("v1:analytics:platform-overview"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
