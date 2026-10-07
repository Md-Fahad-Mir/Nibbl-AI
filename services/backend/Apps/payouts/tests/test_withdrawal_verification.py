"""SMS-verified withdrawals (Twilio Verify).

Twilio is mocked. Verification is enforced only when Twilio is configured,
so the default (unconfigured) path keeps the existing behavior.
"""

from decimal import Decimal
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.payouts import services
from Apps.payouts.models import WithdrawalRequest
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

TWILIO_ON = {
    "TWILIO_ACCOUNT_SID": "AC_test",
    "TWILIO_AUTH_TOKEN": "tok_test",
    "TWILIO_VERIFY_SERVICE_SID": "VA_test",
}


def _user(email, phone, verified=True, balance="100.00"):
    user = User.objects.create_user(email=email, password="x", full_name="U")
    user.phone = phone
    user.is_phone_verified = verified
    user.save()
    wallet = wallet_services.get_or_create_customer_wallet(user)
    wallet_services.credit(
        wallet=wallet, amount=Decimal(balance), category=LedgerEntry.Category.ADJUSTMENT
    )
    return user


def _method(user, handle):
    return services.add_payout_method(user=user, provider="paypal", handle=handle)


class SendCodeTests(APITestCase):
    @override_settings(**TWILIO_ON)
    @patch("Apps.accounts.twilio_verify.start_verification")
    def test_send_code_returns_masked_phone(self, mock_start):
        user = _user("a@example.com", "+15551230123")
        method = _method(user, "a@paypal.com")
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:payouts:withdrawal-send-code"),
            {"payout_method": str(method.id), "amount": "10.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("0123", resp.data["phone"])
        mock_start.assert_called_once()

    @override_settings(**TWILIO_ON)
    def test_send_code_requires_verified_phone(self):
        user = _user("b@example.com", "+15551230124", verified=False)
        method = _method(user, "b@paypal.com")
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:payouts:withdrawal-send-code"),
            {"payout_method": str(method.id), "amount": "10.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_code_503_when_twilio_unconfigured(self):
        user = _user("c@example.com", "+15551230125")
        method = _method(user, "c@paypal.com")
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:payouts:withdrawal-send-code"),
            {"payout_method": str(method.id), "amount": "10.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


class WithdrawalCodeEnforcementTests(APITestCase):
    @override_settings(**TWILIO_ON)
    @patch("Apps.accounts.twilio_verify.check_verification", return_value=True)
    def test_valid_code_creates_withdrawal(self, _mock):
        user = _user("d@example.com", "+15551230126")
        method = _method(user, "d@paypal.com")
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:payouts:withdrawal-list"),
            {"payout_method": str(method.id), "amount": "10.00", "code": "123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    @override_settings(**TWILIO_ON)
    @patch("Apps.accounts.twilio_verify.check_verification", return_value=False)
    def test_bad_code_rejected(self, _mock):
        user = _user("e@example.com", "+15551230127")
        method = _method(user, "e@paypal.com")
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:payouts:withdrawal-list"),
            {"payout_method": str(method.id), "amount": "10.00", "code": "000000"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(WithdrawalRequest.objects.filter(user=user).exists())

    def test_without_twilio_no_code_needed(self):
        # Twilio unconfigured (default) → existing behavior, no code required.
        user = _user("f@example.com", "+15551230128")
        method = _method(user, "f@paypal.com")
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:payouts:withdrawal-list"),
            {"payout_method": str(method.id), "amount": "10.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
