"""Phase 1 Stripe: card payments that fund the brand wallet.

Stripe itself is mocked — these cover our glue: intent creation, the
webhook crediting the wallet, idempotency, and endpoint access control.
"""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing import services
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def _succeeded_event(brand, *, pi_id="pi_test_1", cents=5000, purpose="wallet_topup"):
    return {
        "type": "payment_intent.succeeded",
        "data": {
            "object": {
                "id": pi_id,
                "amount_received": cents,
                "metadata": {"brand_id": str(brand.id), "purpose": purpose},
            }
        },
    }


class WalletTopupServiceTests(APITestCase):
    def setUp(self):
        self.brand = Brand.objects.create(
            name="Acme", slug="acme", plan=Plan.objects.get(slug="pro")
        )
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)

    @patch("Apps.billing.stripe_gateway.create_payment_intent")
    def test_create_intent_returns_client_secret(self, mock_pi):
        mock_pi.return_value = SimpleNamespace(client_secret="cs_123", id="pi_1")
        result = services.create_wallet_topup_intent(
            brand=self.brand, amount=Decimal("50.00")
        )
        self.assertEqual(result["client_secret"], "cs_123")
        self.assertEqual(result["payment_intent_id"], "pi_1")
        # Stripe wants cents.
        self.assertEqual(mock_pi.call_args.kwargs["amount_cents"], 5000)

    def test_create_intent_rejects_non_positive_amount(self):
        with self.assertRaises(services.BillingError):
            services.create_wallet_topup_intent(brand=self.brand, amount=Decimal("0"))

    def test_webhook_credits_wallet(self):
        services.handle_stripe_event(_succeeded_event(self.brand, cents=5000))
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("50.00"))

    def test_webhook_is_idempotent(self):
        event = _succeeded_event(self.brand, pi_id="pi_dup", cents=2500)
        services.handle_stripe_event(event)
        services.handle_stripe_event(event)  # redelivery
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("25.00"))
        self.assertEqual(
            LedgerEntry.objects.filter(
                wallet=self.wallet, reference_id="pi_dup"
            ).count(),
            1,
        )

    def test_webhook_ignores_non_topup_purpose(self):
        services.handle_stripe_event(
            _succeeded_event(self.brand, purpose="something_else")
        )
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("0.00"))


class AddFundsEndpointTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner"
        )
        self.outsider = User.objects.create_user(
            email="out@example.com", password="x", full_name="Out"
        )
        self.brand = Brand.objects.create(
            name="Acme", slug="acme", plan=Plan.objects.get(slug="pro")
        )
        BrandMembership.objects.create(
            brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER
        )
        self.url = reverse("v1:billing:add-funds", kwargs={"brand_id": self.brand.id})

    @patch("Apps.billing.stripe_gateway.create_payment_intent")
    def test_owner_can_start_topup(self, mock_pi):
        mock_pi.return_value = SimpleNamespace(client_secret="cs_abc", id="pi_abc")
        self.client.force_authenticate(self.owner)
        resp = self.client.post(self.url, {"amount": "50.00"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["client_secret"], "cs_abc")

    def test_non_member_is_forbidden(self):
        self.client.force_authenticate(self.outsider)
        resp = self.client.post(self.url, {"amount": "50.00"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_requires_authentication(self):
        resp = self.client.post(self.url, {"amount": "50.00"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class StripeWebhookEndpointTests(APITestCase):
    def setUp(self):
        self.brand = Brand.objects.create(
            name="Acme", slug="acme", plan=Plan.objects.get(slug="pro")
        )
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        self.url = reverse("v1:billing:stripe-webhook")

    @patch("Apps.billing.stripe_gateway.construct_event")
    def test_valid_event_credits_wallet(self, mock_construct):
        mock_construct.return_value = _succeeded_event(self.brand, cents=10000)
        resp = self.client.post(
            self.url, data=b"{}", content_type="application/json",
            HTTP_STRIPE_SIGNATURE="t=1,v1=sig",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("100.00"))

    @patch("Apps.billing.stripe_gateway.construct_event")
    def test_bad_signature_returns_400(self, mock_construct):
        from stripe import SignatureVerificationError

        mock_construct.side_effect = SignatureVerificationError("bad", "sig")
        resp = self.client.post(
            self.url, data=b"{}", content_type="application/json",
            HTTP_STRIPE_SIGNATURE="bad",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
