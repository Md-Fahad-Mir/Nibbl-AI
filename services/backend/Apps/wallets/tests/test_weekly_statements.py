"""Weekly statements + detailed ledger (Master: Wallet §5)."""

import datetime as dt
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.wallets import services as wallet_services
from Apps.wallets import statements
from Apps.wallets.models import LedgerEntry

C = LedgerEntry.Category


class WeeklyStatementTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner")
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=Plan.objects.get(slug="starter"))
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("100"), category=C.FUNDING)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("3"), category=C.ADJUSTMENT, is_promotional=True)
        wallet_services.debit(wallet=self.wallet, amount=Decimal("5"), category=C.REBATE_REWARD)
        wallet_services.debit(wallet=self.wallet, amount=Decimal("1"), category=C.REVIEW_REWARD)
        # $4 fee: $3 from promo credit, $1 real.
        wallet_services.charge_eligible(wallet=self.wallet, amount=Decimal("4"), category=C.REBATE_FEE)
        wallet_services.charge_eligible(wallet=self.wallet, amount=Decimal("39"), category=C.SUBSCRIPTION)
        self.hold = wallet_services.place_hold(wallet=self.wallet, amount=Decimal("2"), reference_type="reservation")
        wallet_services.release_hold(hold=self.hold)
        self.client.force_authenticate(self.owner)

    def test_current_week_row(self):
        rows = self.client.get(reverse("v1:wallets:brand-weekly-statements", args=[self.brand.id])).data
        self.assertEqual(len(rows), 1)  # no weeks before the wallet existed
        week = rows[0]
        self.assertTrue(week["in_progress"])
        self.assertEqual(
            (week["rebate_rewards"], week["review_rewards"], week["fees"], week["plan_charges"],
             week["credits_applied"], week["total_cash_spent"]),
            ("5.00", "1.00", "4.00", "39.00", "3.00", "46.00"),  # deposits not counted
        )

    def test_previous_weeks_listed_and_empty(self):
        LedgerEntry.objects.filter(wallet=self.wallet).update(created_at=timezone.now() - dt.timedelta(days=21))
        type(self.wallet).objects.filter(pk=self.wallet.pk).update(created_at=timezone.now() - dt.timedelta(days=21))
        self.wallet.refresh_from_db()
        rows = statements.weekly_statements(self.wallet)
        self.assertGreaterEqual(len(rows), 4)
        self.assertEqual(rows[0]["total_cash_spent"], "0.00")
        self.assertEqual(sum(Decimal(r["total_cash_spent"]) for r in rows), Decimal("46.00"))

    def test_weekly_export_has_summary_and_reservations(self):
        start = statements.week_start(timezone.localdate())
        body = self.client.get(
            reverse("v1:wallets:brand-weekly-statement-export", args=[self.brand.id, start.isoformat()])
        ).content.decode()
        self.assertIn("Total cash spent,46.00", body)
        self.assertIn("reservation,", body)
        self.assertIn("reservation_released", body)

    def test_ledger_export_date_range(self):
        url = reverse("v1:wallets:brand-wallet-ledger-export", args=[self.brand.id])
        today = timezone.localdate()
        self.assertIn("rebate_reward", self.client.get(url, {"from": today, "to": today}).content.decode())
        past = (today - dt.timedelta(days=10)).isoformat()
        body = self.client.get(url, {"from": past, "to": past}).content.decode()
        self.assertNotIn("rebate_reward", body)
        self.assertEqual(self.client.get(url, {"from": "bad"}).status_code, 400)

    def test_outsider_blocked(self):
        outsider = User.objects.create_user(email="x@x.com", password="x", full_name="X")
        self.client.force_authenticate(outsider)
        self.assertEqual(
            self.client.get(reverse("v1:wallets:brand-weekly-statements", args=[self.brand.id])).status_code, 403
        )
