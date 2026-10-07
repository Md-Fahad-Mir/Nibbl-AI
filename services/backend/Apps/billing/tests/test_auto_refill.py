"""Phase 2 Stripe: saved card + automatic wallet refill.

Stripe is mocked; these cover our glue — config validation, the refill job's
decision logic, and endpoint access control.
"""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing import services
from Apps.billing.models import AutoRefill, Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def _brand(slug="acme"):
    return Brand.objects.create(
        name="Acme", slug=slug, plan=Plan.objects.get(slug="pro")
    )


def _fund(brand, amount):
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    if Decimal(amount) > 0:
        wallet_services.credit(
            wallet=wallet, amount=Decimal(amount),
            category=LedgerEntry.Category.FUNDING,
        )
    return wallet


class AutoRefillConfigTests(APITestCase):
    def setUp(self):
        self.brand = _brand()

    def test_enable_requires_card(self):
        with self.assertRaises(services.BillingError):
            services.set_auto_refill(
                brand=self.brand, enabled=True,
                threshold=Decimal("50"), amount=Decimal("100"), payment_method_id="",
            )

    def test_enable_requires_positive_amount(self):
        with self.assertRaises(services.BillingError):
            services.set_auto_refill(
                brand=self.brand, enabled=True,
                threshold=Decimal("50"), amount=Decimal("0"), payment_method_id="pm_1",
            )

    def test_set_and_read_back(self):
        config = services.set_auto_refill(
            brand=self.brand, enabled=True,
            threshold=Decimal("50"), amount=Decimal("100"), payment_method_id="pm_1",
        )
        self.assertTrue(config.enabled)
        self.assertEqual(config.amount, Decimal("100.00"))
        self.assertEqual(config.stripe_payment_method_id, "pm_1")

    def test_list_saved_cards_normalizes_stripe_objects(self):
        # Stripe returns StripeObjects (no .get()); list_saved_cards must
        # normalize them or it 500s.
        import stripe

        pm = stripe.PaymentMethod.construct_from(
            {
                "id": "pm_1",
                "card": {"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030},
            },
            "sk_test",
        )
        with patch("Apps.billing.stripe_gateway.list_payment_methods", return_value=[pm]):
            cards = services.list_saved_cards(brand=self.brand)
        self.assertEqual(cards[0]["last4"], "4242")
        self.assertEqual(cards[0]["brand"], "visa")


class RunAutoRefillTests(APITestCase):
    @patch("Apps.billing.stripe_gateway.charge_saved_card")
    def test_charges_when_below_threshold(self, mock_charge):
        mock_charge.return_value = SimpleNamespace(id="pi_refill")
        brand = _brand()
        _fund(brand, "10.00")  # below threshold
        services.set_auto_refill(
            brand=brand, enabled=True,
            threshold=Decimal("50"), amount=Decimal("100"), payment_method_id="pm_1",
        )
        summary = services.run_auto_refill()
        self.assertEqual(summary["charged"], 1)
        self.assertEqual(mock_charge.call_args.kwargs["amount_cents"], 10000)
        AutoRefill.objects.get(brand=brand).refresh_from_db()
        self.assertIsNotNone(AutoRefill.objects.get(brand=brand).last_refilled_at)

    @patch("Apps.billing.stripe_gateway.charge_saved_card")
    def test_skips_when_above_threshold(self, mock_charge):
        brand = _brand()
        _fund(brand, "500.00")  # above threshold
        services.set_auto_refill(
            brand=brand, enabled=True,
            threshold=Decimal("50"), amount=Decimal("100"), payment_method_id="pm_1",
        )
        summary = services.run_auto_refill()
        self.assertEqual(summary["charged"], 0)
        self.assertEqual(summary["skipped"], 1)
        mock_charge.assert_not_called()

    @patch("Apps.billing.stripe_gateway.charge_saved_card", side_effect=Exception("card declined"))
    def test_counts_failures(self, _mock):
        brand = _brand()
        _fund(brand, "0")
        services.set_auto_refill(
            brand=brand, enabled=True,
            threshold=Decimal("50"), amount=Decimal("100"), payment_method_id="pm_1",
        )
        summary = services.run_auto_refill()
        self.assertEqual(summary["failed"], 1)

    def test_disabled_configs_ignored(self):
        brand = _brand()
        _fund(brand, "0")
        services.set_auto_refill(
            brand=brand, enabled=False,
            threshold=Decimal("50"), amount=Decimal("100"), payment_method_id="pm_1",
        )
        summary = services.run_auto_refill()
        self.assertEqual(summary, {"charged": 0, "skipped": 0, "failed": 0})


class Phase2EndpointTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner"
        )
        self.outsider = User.objects.create_user(
            email="out@example.com", password="x", full_name="Out"
        )
        self.brand = _brand()
        BrandMembership.objects.create(
            brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER
        )

    @patch("Apps.billing.stripe_gateway.create_setup_intent")
    def test_setup_intent(self, mock_si):
        mock_si.return_value = SimpleNamespace(client_secret="seti_cs", id="seti_1")
        self.client.force_authenticate(self.owner)
        url = reverse("v1:billing:setup-card", kwargs={"brand_id": self.brand.id})
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["client_secret"], "seti_cs")

    def test_auto_refill_get_and_put(self):
        self.client.force_authenticate(self.owner)
        url = reverse("v1:billing:auto-refill", kwargs={"brand_id": self.brand.id})
        # default: disabled
        self.assertFalse(self.client.get(url).data["enabled"])
        # enable
        resp = self.client.put(
            url,
            {"enabled": True, "threshold": "50.00", "amount": "100.00", "payment_method_id": "pm_1"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["enabled"])

    def test_auto_refill_enable_without_card_is_400(self):
        self.client.force_authenticate(self.owner)
        url = reverse("v1:billing:auto-refill", kwargs={"brand_id": self.brand.id})
        resp = self.client.put(
            url,
            {"enabled": True, "threshold": "50.00", "amount": "100.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_member_forbidden(self):
        self.client.force_authenticate(self.outsider)
        url = reverse("v1:billing:auto-refill", kwargs={"brand_id": self.brand.id})
        self.assertEqual(self.client.get(url).status_code, status.HTTP_403_FORBIDDEN)
