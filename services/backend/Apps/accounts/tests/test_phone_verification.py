"""Phone add/verify: international validation and the log-only fallback (no Twilio)."""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts import services
from Apps.accounts.models import User, VerificationCode


class PhoneVerificationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="p@example.com", password="x", full_name="P")
        self.client.force_authenticate(self.user)

    def test_accepts_mobile_numbers_from_any_country(self):
        self.assertEqual(services.normalize_phone("+1 (212) 555-0123"), "+12125550123")   # US
        self.assertEqual(services.normalize_phone("+880 1712-345678"), "+8801712345678")  # Bangladesh
        self.assertEqual(services.normalize_phone("+44 7911 123456"), "+447911123456")    # UK mobile
        self.assertEqual(services.normalize_phone("0044 7911 123456"), "+447911123456")   # 00 prefix

    def test_local_number_with_country_applies_that_countrys_rules(self):
        # Leading 0 is the national prefix in BD and the UK — dropped correctly.
        self.assertEqual(services.normalize_phone("01712-345678", "BD"), "+8801712345678")
        self.assertEqual(services.normalize_phone("07911 123456", "gb"), "+447911123456")
        self.assertEqual(services.normalize_phone("(212) 555-0123", "US"), "+12125550123")

    def test_rejects_missing_country_code_invalid_and_non_sms_numbers(self):
        for bad in (
            "(212) 555-0123",     # no country code and no country given
            "+1 12345",           # too short / invalid
            "+44 20 7946 0958",   # UK landline
            "+1 800 555 0199",    # toll-free
            "+44 909 879 0000",   # premium-rate (SMS-fraud vector)
        ):
            with self.assertRaises(services.AccountError, msg=bad):
                services.normalize_phone(bad)

    def test_add_and_verify_without_twilio_uses_logged_code(self):
        resp = self.client.post(reverse("v1:accounts:users:add-phone"), {"phone": "+880 1712-345604"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(resp.data["phone"], "+8801712345604")  # normalized number echoed back
        code = VerificationCode.objects.filter(
            user=self.user, purpose=VerificationCode.Purpose.PHONE_VERIFY
        ).latest("created_at").code
        resp = self.client.post(reverse("v1:accounts:users:verify-phone"), {"code": code}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_phone_verified)
        self.assertEqual(self.user.last_verified_phone, "+8801712345604")
        self.assertIsNone(self.user.withdrawals_paused_until)  # first number: no pause

    def test_invalid_number_rejected(self):
        resp = self.client.post(reverse("v1:accounts:users:add-phone"), {"phone": "123"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
