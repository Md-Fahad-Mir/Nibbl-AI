"""Self-serve plan changes (Master: Plans §1, §2, §5)."""

import datetime as dt
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing import services
from Apps.billing.models import Plan, Subscription
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.testing import go_live
from Apps.products.services import create_product
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class PlanChangeTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner")
        self.pro = Plan.objects.get(slug="pro")
        self.starter = Plan.objects.get(slug="starter")
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=self.pro)
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("1000"), category=LedgerEntry.Category.FUNDING)
        services.charge_due_subscriptions()  # first charge, period starts now
        self.product = create_product(brand=self.brand, name="Chips", category="Chips")
        self.campaigns = [self._live(f"C{i}") for i in range(2)]
        self.client.force_authenticate(self.owner)
        self.url = reverse("v1:billing:brand-plan-change", args=[self.brand.id])

    def _live(self, name):
        campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[self.product.id], name=name, deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=10, estimated_redemption_rate=Decimal("100"),
        )
        go_live(campaign)
        return campaign

    def _renew(self):
        sub = self.brand.subscription
        sub.refresh_from_db()
        return services.charge_due_subscriptions(now=sub.next_charge_at + dt.timedelta(minutes=1))

    def test_overview(self):
        data = self.client.get(reverse("v1:billing:brand-plan", args=[self.brand.id])).data
        self.assertEqual((data["plan"], data["active_campaigns_used"], data["active_campaign_limit"]), ("pro", 2, 3))
        self.assertEqual(len(data["billing_history"]), 1)
        self.assertIsNone(data["scheduled_change"])
        self.assertIn(data["recommendation"]["plan"], ("starter", "pro", "scale"))

    def test_downgrade_requires_choice_then_applies_at_renewal(self):
        self.assertEqual(self.client.post(self.url, {"plan": "starter"}, format="json").status_code, 400)
        keep = self.campaigns[1]
        resp = self.client.post(self.url, {"plan": "starter", "keep_campaign_ids": [str(keep.id)]}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["scheduled_change"]["plan"], "starter")
        self.brand.refresh_from_db()
        self.assertEqual(self.brand.plan, self.pro)  # current plan until renewal

        before = self.wallet.ledger_entries.filter(category=LedgerEntry.Category.SUBSCRIPTION).count()
        self._renew()
        self.brand.refresh_from_db()
        self.assertEqual((self.brand.plan, self.brand.subscription.plan), (self.starter, self.starter))
        charge = self.wallet.ledger_entries.filter(category=LedgerEntry.Category.SUBSCRIPTION).order_by("-created_at")
        self.assertEqual(charge.count(), before + 1)
        self.assertEqual(charge.first().amount, self.starter.monthly_price)  # renewal at the new price
        statuses = {c.id: Campaign.objects.get(pk=c.pk).status for c in self.campaigns}
        self.assertEqual(statuses[keep.id], Campaign.Status.ACTIVE)
        self.assertEqual(statuses[self.campaigns[0].id], Campaign.Status.PAUSED)
        self.assertFalse(Campaign.objects.get(pk=self.campaigns[0].pk).auto_paused)
        self.assertIsNone(Subscription.objects.get(brand=self.brand).scheduled_plan)

    def test_upgrade_waits_for_renewal_and_can_be_canceled(self):
        self.client.post(self.url, {"plan": "scale"}, format="json")
        self.brand.refresh_from_db()
        self.assertEqual(self.brand.plan, self.pro)
        resp = self.client.delete(self.url)
        self.assertIsNone(resp.data["scheduled_change"])
        self._renew()
        self.brand.refresh_from_db()
        self.assertEqual(self.brand.plan, self.pro)

    def test_same_plan_and_bad_keep_rejected(self):
        self.assertEqual(self.client.post(self.url, {"plan": "pro"}, format="json").status_code, 400)
        resp = self.client.post(self.url, {"plan": "starter", "keep_campaign_ids": [
            str(c.id) for c in self.campaigns]}, format="json")
        self.assertEqual(resp.status_code, 400)  # 2 kept > Starter's 1

    def test_campaign_started_after_scheduling_is_paused_over_limit(self):
        self.client.post(self.url, {"plan": "starter", "keep_campaign_ids": [str(self.campaigns[0].id)]},
                         format="json")
        late = self._live("Late")
        self._renew()
        self.assertEqual(Campaign.objects.get(pk=late.pk).status, Campaign.Status.PAUSED)
        self.assertEqual(Campaign.objects.get(pk=self.campaigns[0].pk).status, Campaign.Status.ACTIVE)

    def test_recommendation_by_spend(self):
        from Apps.billing import plans

        wallet_services.debit(wallet=self.wallet, amount=Decimal("600"), category=LedgerEntry.Category.REBATE_REWARD)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("6000"), category=LedgerEntry.Category.FUNDING)
        wallet_services.debit(wallet=self.wallet, amount=Decimal("5000"), category=LedgerEntry.Category.REBATE_REWARD)
        self.assertEqual(plans.recommend(self.brand, timezone.now())["plan"], "scale")

    def test_viewer_cannot_change(self):
        member = User.objects.create_user(email="m@x.com", password="x", full_name="M")
        BrandMembership.objects.create(brand=self.brand, user=member, role=BrandMembership.Role.MEMBER)
        self.client.force_authenticate(member)
        self.assertEqual(self.client.post(self.url, {"plan": "scale"}, format="json").status_code, 403)
