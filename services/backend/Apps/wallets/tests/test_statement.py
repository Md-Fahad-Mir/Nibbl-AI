"""Contract test for the merged wallet statement (Phase-1 batch 2)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.payouts import services as payout_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class WalletStatementTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C", is_email_verified=True
        )
        wallet = wallet_services.get_or_create_customer_wallet(self.user)
        wallet_services.credit(
            wallet=wallet, amount=Decimal("100.00"),
            category=LedgerEntry.Category.FUNDING, description="Reward credit",
        )
        method = payout_services.add_payout_method(
            user=self.user, provider="paypal", handle="c@example.com",
        )
        payout_services.request_withdrawal(
            user=self.user, payout_method_id=method.id, amount=Decimal("10.00"),
        )
        self.client.force_authenticate(self.user)

    def test_statement_is_paginated_and_merges_pending_withdrawal(self):
        resp = self.client.get(reverse("v1:wallets:customer-statement"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(set(resp.data), {"count", "next", "previous", "results"})

        kinds = {row["kind"] for row in resp.data["results"]}
        self.assertIn("ledger", kinds)
        self.assertIn("withdrawal", kinds)

        withdrawal = next(r for r in resp.data["results"] if r["kind"] == "withdrawal")
        self.assertEqual(withdrawal["status"], "approved")  # safe request → Ready for Batch
        self.assertEqual(Decimal(withdrawal["amount"]), Decimal("-10.00"))

        ledger = next(r for r in resp.data["results"] if r["kind"] == "ledger")
        self.assertEqual(ledger["status"], "completed")
