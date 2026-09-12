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


def _generated_review_response():
    """A canned AI-service /reviews/generate response for httpx.post to return."""
    from unittest.mock import Mock

    resp = Mock(status_code=200)
    resp.json.return_value = {
        "success": True,
        "data": {
            "title": "Great", "body": "Great product overall.", "rating": 5,
            "ai_generated": False, "disclosure": "",
        },
    }
    return resp


def _full_flow(brand, *, email="c@example.com"):
    """Claim → verified receipt → rebate redemption + a submitted review."""
    from unittest.mock import patch

    product = create_product(brand=brand, name="Cola")
    rebate = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Deal", daily_budget=Decimal("100.00")
    )
    campaign_services.set_tiers(rebate, [{"reward_amount": "5.00", "allocation_percent": "100.00"}])
    campaign_services.activate_campaign(rebate)

    user = User.objects.create_user(email=email, password="x", full_name="U")
    reservation = reservation_services.create_reservation(user=user, campaign_id=rebate.id)
    receipt_services.upload_receipt(
        user=user, reservation_id=reservation.id, **RECEIPT_META,
        items=[{"description": "Cola", "quantity": 1}],
    )  # auto-verifies -> redemption

    with patch("httpx.post", return_value=_generated_review_response()):
        review_services.generate_and_submit_review(
            user=user, product=product,
            answers=[("How was it?", "Great product overall.")],
        )
    return user, product, rebate


class BrandRebatesSummaryTests(APITestCase):
    def test_summary_endpoint_shape_and_values(self):
        owner, brand, wallet = _brand(plan="starter")  # rebate fee 20%
        _full_flow(brand)  # 1 reservation -> 1 redemption (reward 5.00) this period

        self.client.force_authenticate(owner)
        resp = self.client.get(
            reverse("v1:analytics:brand-rebates-summary", args=[brand.id]),
            {"period": "30d"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        data = resp.data

        # All contract keys present.
        self.assertEqual(
            set(data),
            {
                "performance_change_percent",
                "performance_change_label",
                "budget_savings",
                "total_cashback",
                "total_cashback_change_percent",
                "redemption_rate",
                "redemption_rate_change_percent",
                "avg_claim_time_minutes",
                "avg_claim_time_change_percent",
                "active_users",
                "active_users_change_percent",
            },
        )
        # Values derived from the single current-period redemption.
        self.assertEqual(data["total_cashback"], "5.00")      # decimal string
        self.assertEqual(data["redemption_rate"], 100.0)      # 1 redemption / 1 reservation
        self.assertEqual(data["active_users"], 1)
        self.assertIn(data["performance_change_label"], {"better", "worse"})

    def test_summary_requires_membership(self):
        owner, brand, wallet = _brand()
        outsider = User.objects.create_user(
            email="outsider@example.com", password="x", full_name="X"
        )
        self.client.force_authenticate(outsider)
        resp = self.client.get(
            reverse("v1:analytics:brand-rebates-summary", args=[brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class BrandOverviewTests(APITestCase):
    def test_overview_matches_source_data(self):
        owner, brand, wallet = _brand(plan="starter")  # rebate fee 20%
        _full_flow(brand)

        o = services.brand_overview(brand)
        self.assertEqual(o["reservations"], 1)
        self.assertEqual(o["redemptions"], 1)
        self.assertEqual(o["approvals"], 1)  # one verified receipt
        self.assertEqual(o["reviews"], 1)
        self.assertEqual(o["published_reviews"], 1)
        self.assertEqual(o["average_rating"], Decimal("5.00"))
        # Spend: rebate reward 5 + fee 1.00 (20%) + review reward 1 (flat, no fee).
        self.assertEqual(o["spend"]["rebate_reward"], Decimal("5.00"))
        self.assertEqual(o["spend"]["rebate_fee"], Decimal("1.00"))
        self.assertEqual(o["spend"]["review_reward"], Decimal("1.00"))
        self.assertEqual(o["spend"]["review_fee"], Decimal("0.00"))
        self.assertEqual(o["spend"]["total"], Decimal("7.00"))

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
        # Platform fees: rebate 1.00 (reviews carry no fee in the flat-reward flow).
        self.assertEqual(o["total_fees"], Decimal("1.00"))

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
