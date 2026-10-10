from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from Apps.billing import services
from Apps.billing.models import Plan, Subscription
from Apps.brands.models import Brand
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class FeeComputationTests(TestCase):
    def test_rebate_processing_fee(self):
        pro = Plan.objects.get(slug="pro")  # 15%
        self.assertEqual(
            services.rebate_processing_fee(pro, Decimal("10.00")), Decimal("1.50")
        )


class SubscriptionChargeTests(TestCase):
    def setUp(self):
        self.pro = Plan.objects.get(slug="pro")  # $199.00 every 30 days
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=self.pro)
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)

    def test_charge_debits_funded_wallet_and_advances_period(self):
        wallet_services.credit(
            wallet=self.wallet, amount=Decimal("200.00"),
            category=LedgerEntry.Category.FUNDING,
        )
        summary = services.charge_due_subscriptions()
        self.assertEqual(summary["charged"], 1)

        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("1.00"))  # 200 - 199

        sub = Subscription.objects.get(brand=self.brand)
        self.assertEqual(sub.status, Subscription.Status.ACTIVE)
        self.assertEqual(sub.total_charged, Decimal("199.00"))
        self.assertGreater(sub.next_charge_at, timezone.now())
        self.assertEqual(sub.current_period_end - sub.current_period_start, services.BILLING_PERIOD)  # 30 days

    def test_underfunded_wallet_marks_past_due(self):
        # No funding -> cannot cover $199.
        summary = services.charge_due_subscriptions()
        self.assertEqual(summary["past_due"], 1)
        sub = Subscription.objects.get(brand=self.brand)
        self.assertEqual(sub.status, Subscription.Status.PAST_DUE)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("0.00"))

    def test_running_twice_does_not_double_charge_same_period(self):
        wallet_services.credit(
            wallet=self.wallet, amount=Decimal("500.00"),
            category=LedgerEntry.Category.FUNDING,
        )
        services.charge_due_subscriptions()
        # Immediately running again: next_charge_at is in the future, so no charge.
        services.charge_due_subscriptions()
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("301.00"))  # charged once
        self.assertEqual(
            LedgerEntry.objects.filter(
                category=LedgerEntry.Category.SUBSCRIPTION
            ).count(),
            1,
        )

    def test_free_plan_advances_without_charge(self):
        Plan.objects.filter(slug="starter").update(monthly_price=Decimal("0.00"))
        starter = Plan.objects.get(slug="starter")
        brand = Brand.objects.create(name="Free", slug="free", plan=starter)
        summary = services.charge_due_subscriptions()
        self.assertEqual(summary["free"], 1)
        sub = Subscription.objects.get(brand=brand)
        self.assertEqual(sub.status, Subscription.Status.ACTIVE)


class RenewalChargeTests(TestCase):
    """Every 30-day renewal is charged — including the second one, whose
    period start used to share the first charge's idempotency key."""

    def test_master_pricing(self):
        plans = {p.slug: (p.monthly_price, p.review_fee, p.rebate_fee_percent) for p in Plan.objects.all()}
        self.assertEqual(plans["starter"], (Decimal("39.00"), Decimal("4.00"), Decimal("20.00")))
        self.assertEqual(plans["pro"], (Decimal("199.00"), Decimal("3.00"), Decimal("15.00")))
        self.assertEqual(plans["scale"], (Decimal("999.00"), Decimal("2.00"), Decimal("10.00")))

    def test_second_and_third_renewals_are_charged(self):
        brand = Brand.objects.create(name="Renew", slug="renew", plan=Plan.objects.get(slug="pro"))
        wallet = wallet_services.get_or_create_brand_wallet(brand)
        wallet_services.credit(wallet=wallet, amount=Decimal("1000.00"), category=LedgerEntry.Category.FUNDING)
        services.charge_due_subscriptions()
        for expected in (2, 3):
            subscription = brand.subscription
            subscription.refresh_from_db()
            services.charge_due_subscriptions(now=subscription.next_charge_at)
            self.assertEqual(
                wallet.ledger_entries.filter(category=LedgerEntry.Category.SUBSCRIPTION).count(), expected
            )
