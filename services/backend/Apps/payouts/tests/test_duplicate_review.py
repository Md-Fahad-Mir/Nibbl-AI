"""Duplicate payout account: Request Review (Master: Shopper restriction messages)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.payouts import services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class DuplicatePayoutReviewTests(APITestCase):
    def setUp(self):
        self.a = User.objects.create_user(email="a@x.com", password="x", full_name="A")
        self.b = User.objects.create_user(email="b@x.com", password="x", full_name="B")
        services.add_payout_method(user=self.a, provider="paypal", handle="shared@pay.com")

    def test_duplicate_returns_code_then_review_routes_both_accounts(self):
        self.client.force_authenticate(self.b)
        resp = self.client.post(reverse("v1:payouts:method-list"),
                                {"provider": "paypal", "handle": "Shared@pay.com"}, format="json")
        self.assertEqual((resp.status_code, resp.data["code"]), (400, "duplicate_payout_account"))
        self.assertIn("already connected to another Nibbl account", resp.data["detail"])

        resp = self.client.post(reverse("v1:payouts:method-request-review"),
                                {"provider": "paypal", "handle": "shared@pay.com"}, format="json")
        self.assertEqual(resp.status_code, 202)

        # The other account's next withdrawal goes to Manual Review.
        wallet_services.credit(wallet=wallet_services.get_or_create_customer_wallet(self.a), amount=Decimal("5"),
                               category=LedgerEntry.Category.REBATE_REWARD)
        method = self.a.payout_methods.get()
        withdrawal = services.request_withdrawal(user=self.a, payout_method_id=method.id, amount=Decimal("2"))
        self.assertTrue(withdrawal.needs_review)
        self.assertIn("Duplicate payout account", withdrawal.admin_note)

    def test_no_conflict_rejected(self):
        self.client.force_authenticate(self.b)
        resp = self.client.post(reverse("v1:payouts:method-request-review"),
                                {"provider": "venmo", "handle": "nobody"}, format="json")
        self.assertEqual(resp.status_code, 400)
