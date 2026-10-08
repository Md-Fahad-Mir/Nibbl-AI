"""Phone add/verify: US normalization and the log-only fallback (no Twilio)."""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts import services
from Apps.accounts.models import User, VerificationCode


class PhoneVerificationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="p@example.com", password="x", full_name="P")
        self.client.force_authenticate(self.user)

    def test_normalizes_us_numbers(self):
        self.assertEqual(services.normalize_us_phone("(555) 201-0003"), "+15552010003")
        self.assertEqual(services.normalize_us_phone("+1 555 201 0003"), "+15552010003")
        for bad in ("12345", "+44 20 7946 0958", "055-201-0003"):
            with self.assertRaises(services.AccountError):
                services.normalize_us_phone(bad)

    def test_add_and_verify_without_twilio_uses_logged_code(self):
        resp = self.client.post(reverse("v1:accounts:users:add-phone"), {"phone": "555-201-0004"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        code = VerificationCode.objects.filter(
            user=self.user, purpose=VerificationCode.Purpose.PHONE_VERIFY
        ).latest("created_at").code
        resp = self.client.post(reverse("v1:accounts:users:verify-phone"), {"code": code}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_phone_verified)
        self.assertEqual(self.user.last_verified_phone, "+15552010004")
        self.assertIsNone(self.user.withdrawals_paused_until)  # first number: no pause

    def test_invalid_number_rejected(self):
        resp = self.client.post(reverse("v1:accounts:users:add-phone"), {"phone": "123"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
