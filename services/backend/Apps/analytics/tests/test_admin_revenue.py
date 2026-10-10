"""Admin dashboard revenue (Master: Admin Dashboard; #42, #49)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

C = LedgerEntry.Category


class AdminRevenueTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="a@x.com", password="x", full_name="A",
                                              role=User.Role.ADMIN, is_staff=True)
        self.big = Brand.objects.create(name="Big", slug="big", plan=Plan.objects.get(slug="scale"))
        self.small = Brand.objects.create(name="Small", slug="small", plan=Plan.objects.get(slug="starter"))
        big = wallet_services.get_or_create_brand_wallet(self.big)
        wallet_services.credit(wallet=big, amount=Decimal("2000"), category=C.FUNDING)  # deposit: not revenue
        wallet_services.credit(wallet=big, amount=Decimal("10"), category=C.ADJUSTMENT, is_promotional=True)
        wallet_services.debit(wallet=big, amount=Decimal("50"), category=C.REBATE_REWARD)  # brand-funded reward
        wallet_services.debit(wallet=big, amount=Decimal("1"), category=C.REVIEW_REWARD)
        wallet_services.charge_eligible(wallet=big, amount=Decimal("7.50"), category=C.REBATE_FEE)  # $7.50 promo
        wallet_services.charge_eligible(wallet=big, amount=Decimal("2"), category=C.REVIEW_FEE)  # $2 promo
        wallet_services.charge_eligible(wallet=big, amount=Decimal("999"), category=C.SUBSCRIPTION)  # $0.50 promo + $998.50 cash
        self.client.force_authenticate(self.admin)
        self.url = reverse("v1:analytics:admin-revenue")

    def test_revenue_split_excludes_rewards(self):
        data = self.client.get(self.url).data
        rev = data["revenue"]
        self.assertEqual((rev["subscriptions"], rev["rebate_fees"], rev["review_fees"], rev["total"]),
                         ("999.00", "7.50", "2.00", "1008.50"))
        self.assertEqual((rev["credits_applied"], rev["cash_total"]), ("10.00", "998.50"))
        self.assertEqual(data["brand_funded_rewards"]["total"], "51.00")
        self.assertIn("campaign_approvals", data["needs_attention"])
        self.assertEqual(data["trend"][-1]["total"], "1008.50")  # Revenue Trend by month

    def test_brand_revenue_lowest_first_and_filters(self):
        rows = self.client.get(self.url).data["brands"]
        self.assertEqual([r["name"] for r in rows], ["Small", "Big"])
        self.assertEqual(rows[1]["revenue"], "1008.50")
        rows = self.client.get(self.url, {"sort": "highest", "plan": "scale"}).data["brands"]
        self.assertEqual([r["name"] for r in rows], ["Big"])

    def test_date_range_and_admin_only(self):
        self.assertEqual(self.client.get(self.url, {"from": "2020-01-01", "to": "2020-01-31"}).data["revenue"]["total"], "0.00")
        self.client.force_authenticate(User.objects.create_user(email="s@x.com", password="x", full_name="S"))
        self.assertEqual(self.client.get(self.url).status_code, 403)
