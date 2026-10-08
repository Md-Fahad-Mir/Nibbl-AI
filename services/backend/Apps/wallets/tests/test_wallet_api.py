from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class BrandWalletApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner"
        )
        self.outsider = User.objects.create_user(
            email="out@example.com", password="x", full_name="Out"
        )
        self.brand = Brand.objects.create(
            name="Acme", slug="acme", plan=Plan.objects.get(slug="starter")
        )
        BrandMembership.objects.create(
            brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER
        )

    def test_member_sees_zero_balance_wallet(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.get(
            reverse("v1:wallets:brand-wallet", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(resp.data["balance"]), Decimal("0.00"))
        self.assertEqual(resp.data["kind"], "brand")

    def test_non_member_blocked_from_wallet(self):
        self.client.force_authenticate(self.outsider)
        resp = self.client.get(
            reverse("v1:wallets:brand-wallet", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_funding_is_reflected_in_transactions(self):
        # Funding now arrives via Stripe (billing); the wallet transactions
        # endpoint should still surface the resulting funding entry.
        self.client.force_authenticate(self.owner)
        wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        wallet_services.credit(
            wallet=wallet,
            amount=Decimal("250.00"),
            category=LedgerEntry.Category.FUNDING,
            reference_type="stripe_payment_intent",
            reference_id="pi_test",
            description="Wallet funding via Stripe",
        )

        tx = self.client.get(
            reverse("v1:wallets:brand-wallet-transactions", args=[self.brand.id])
        )
        self.assertEqual(tx.data["count"], 1)
        self.assertEqual(tx.data["results"][0]["category"], "funding")

    def test_ledger_csv_export(self):
        self.client.force_authenticate(self.owner)
        wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        wallet_services.credit(
            wallet=wallet, amount=Decimal("250.00"),
            category=LedgerEntry.Category.FUNDING,
            description="Wallet funding via Stripe",
        )
        resp = self.client.get(
            reverse("v1:wallets:brand-wallet-ledger-export", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "text/csv")
        self.assertIn("attachment", resp["Content-Disposition"])
        body = resp.content.decode()
        self.assertIn("date,type,category,amount", body)
        self.assertIn("funding", body)
        self.assertIn("250.00", body)

    def test_non_member_cannot_export_ledger(self):
        self.client.force_authenticate(self.outsider)
        resp = self.client.get(
            reverse("v1:wallets:brand-wallet-ledger-export", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class CustomerWalletApiTests(APITestCase):
    def test_customer_wallet_is_created_on_first_access(self):
        user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C"
        )
        self.client.force_authenticate(user)
        resp = self.client.get(reverse("v1:wallets:customer-wallet"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["kind"], "customer")
        self.assertEqual(Decimal(resp.data["balance"]), Decimal("0.00"))
