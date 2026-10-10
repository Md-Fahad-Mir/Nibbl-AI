"""Self-serve brand checkout (Master: Plan & Account Setup → Checkout & Activation)."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing import services as billing
from Apps.billing.models import Plan, Subscription
from Apps.brands.models import BrandApplication, BrandMembership
from Apps.wallets.models import LedgerEntry


def _event(application, cents, pi_id="pi_act"):
    return {
        "type": "payment_intent.succeeded",
        "data": {"object": {
            "id": pi_id, "amount_received": cents,
            "metadata": {"application_id": str(application.id), "purpose": "brand_activation"},
        }},
    }


class CheckoutTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="founder@acme.com", password="x", full_name="Founder")
        self.application = BrandApplication.objects.create(
            applicant=self.user, brand_name="Acme Snacks", contact_email="founder@acme.com",
            requested_plan=Plan.objects.get(slug="starter"),
        )
        self.client.force_authenticate(self.user)
        self.quote_url = reverse("v1:brands:application-checkout-quote", args=[self.application.id])
        self.url = reverse("v1:brands:application-checkout", args=[self.application.id])

    def test_quote_with_promo(self):
        billing.create_promo_code(code="launch10", amount=Decimal("10.00"))
        data = self.client.post(self.quote_url, {"plan": "pro", "promo_code": "launch10"}, format="json").data
        self.assertEqual((data["price"], data["promo_credit"], data["due_today"]), ("199.00", "10.00", "189.00"))
        bad = self.client.post(self.quote_url, {"promo_code": "nope"}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_card_checkout_activates_on_webhook(self):
        billing.create_promo_code(code="launch10", amount=Decimal("10.00"))
        with patch("Apps.billing.stripe_gateway.create_checkout_intent",
                   return_value=SimpleNamespace(id="pi_act", client_secret="secret")) as create:
            data = self.client.post(self.url, {"plan": "starter", "promo_code": "launch10"}, format="json").data
        self.assertEqual((data["activated"], data["client_secret"], data["due_today"]), (False, "secret", "29.00"))
        self.assertEqual(create.call_args.kwargs["amount_cents"], 2900)
        self.assertFalse(BrandMembership.objects.filter(user=self.user).exists())  # not active until paid

        billing.handle_stripe_event(_event(self.application, 2900))
        billing.handle_stripe_event(_event(self.application, 2900))  # redelivery
        self.application.refresh_from_db()
        brand = self.application.brand
        self.assertEqual(self.application.status, BrandApplication.Status.APPROVED)
        self.assertEqual(brand.plan.slug, "starter")
        self.assertTrue(BrandMembership.objects.filter(user=self.user, brand=brand,
                                                       role=BrandMembership.Role.OWNER).exists())
        # $29 card + $10 promo pays the $39 plan; nothing left over, charged once.
        entries = LedgerEntry.objects.filter(wallet__brand=brand)
        self.assertEqual(entries.filter(category=LedgerEntry.Category.FUNDING, is_promotional=False).count(), 1)
        charged = entries.filter(category=LedgerEntry.Category.SUBSCRIPTION)
        self.assertEqual(sum(e.amount for e in charged), Decimal("39.00"))
        self.assertEqual(brand.wallet.balance, Decimal("0.00"))
        self.assertEqual(Subscription.objects.get(brand=brand).status, Subscription.Status.ACTIVE)

    def test_promo_covering_plan_activates_without_card(self):
        billing.create_promo_code(code="free", amount=Decimal("50.00"))
        data = self.client.post(self.url, {"plan": "starter", "promo_code": "free"}, format="json").data
        self.assertTrue(data["activated"])
        self.application.refresh_from_db()
        brand = self.application.brand
        self.assertEqual(brand.wallet.promo_balance(), Decimal("11.00"))  # leftover credit for fees
        self.assertEqual(self.client.post(self.url, {}, format="json").status_code, 400)  # already set up

    def test_admin_approved_first_still_records_payment(self):
        with patch("Apps.billing.stripe_gateway.create_checkout_intent",
                   return_value=SimpleNamespace(id="pi_act", client_secret="secret")):
            self.client.post(self.url, {"plan": "starter"}, format="json")
        from Apps.brands import services

        admin = User.objects.create_user(email="a@x.com", password="x", full_name="A",
                                         role=User.Role.ADMIN, is_staff=True)
        brand = services.approve_application(application=self.application, reviewer=admin)
        billing.handle_stripe_event(_event(self.application, 3900))
        self.assertTrue(LedgerEntry.objects.filter(wallet__brand=brand, reference_id="pi_act").exists())

    def test_other_users_application_hidden(self):
        other = User.objects.create_user(email="o@x.com", password="x", full_name="O")
        self.client.force_authenticate(other)
        self.assertEqual(self.client.post(self.quote_url, {}, format="json").status_code, 404)
