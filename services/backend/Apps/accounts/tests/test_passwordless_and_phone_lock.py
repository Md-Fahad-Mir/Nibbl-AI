"""Shopper passwordless sign-in (email code), Reserve Offer while logged out,
and the locked verified phone with admin-reviewed changes."""

from unittest.mock import patch

from django.core import mail
from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import PhoneChangeRequest, User, VerificationCode


class EmailCodeSignInTests(APITestCase):
    def _code(self, email):
        return VerificationCode.objects.filter(user__email=email, purpose="sign_in").latest("created_at").code

    def test_new_shopper_from_reserve_offer(self):
        r = self.client.post(reverse("v1:accounts:auth:email-code"), {"email": "new@x.com", "create": True})
        self.assertEqual(r.status_code, 202)
        self.assertIn("sign-in code", mail.outbox[-1].subject)
        user = User.objects.get(email="new@x.com")
        self.assertFalse(user.has_usable_password())
        r = self.client.post(reverse("v1:accounts:auth:email-code-sign-in"), {
            "email": "new@x.com", "code": self._code("new@x.com"), "phone": "(512) 555-0123", "phone_country": "US"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["access"] and r.data["is_new"] and r.data["phone_saved"])
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)
        self.assertEqual((user.phone, user.is_phone_verified), ("+15125550123", False))

    def test_existing_shopper_and_silent_cases(self):
        User.objects.create_user(email="sam@x.com", password="x", full_name="Sam")
        User.objects.create_user(email="brand@x.com", password="x", full_name="B", role=User.Role.BRAND)
        url = reverse("v1:accounts:auth:email-code")
        self.client.post(url, {"email": "sam@x.com"})
        self.assertEqual(len(mail.outbox), 1)
        self.client.post(url, {"email": "nobody@x.com"})  # unknown, no create → nothing sent, no account
        self.client.post(url, {"email": "brand@x.com"})  # brand accounts use the brand app
        self.assertEqual(len(mail.outbox), 1)
        self.assertFalse(User.objects.filter(email="nobody@x.com").exists())
        bad = self.client.post(reverse("v1:accounts:auth:email-code-sign-in"), {"email": "sam@x.com", "code": "000000"})
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post(reverse("v1:accounts:auth:email-code-sign-in"),
                              {"email": "sam@x.com", "code": self._code("sam@x.com")})
        self.assertFalse(ok.data["is_new"])


class PhoneLockTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="p@x.com", password="x", full_name="P",
                                             phone="+15125550123", is_phone_verified=True)
        self.client.force_authenticate(self.user)

    def test_verified_phone_is_locked_and_change_goes_to_admin(self):
        r = self.client.post(reverse("v1:accounts:users:add-phone"), {"phone": "+15125550199"})
        self.assertEqual((r.status_code, r.data["code"]), (400, "phone_locked"))
        url = reverse("v1:accounts:users:phone-change-request")
        r = self.client.post(url, {"new_phone": "+15125550199", "reason": "New SIM"})
        self.assertEqual((r.status_code, r.data["request"]["status"]), (201, "pending"))
        self.assertEqual(self.client.post(url, {"new_phone": "+15125550188"}).status_code, 400)  # one at a time

        admin = User.objects.create_user(email="a@x.com", password="x", full_name="A", role=User.Role.ADMIN)
        self.client.force_authenticate(admin)
        req = PhoneChangeRequest.objects.get()
        decide = reverse("v1:admin_panel:phone-change-decision", args=[req.id, "reject"])
        self.assertEqual(self.client.post(decide, {"note": ""}).status_code, 400)  # reason required
        detail = self.client.post(reverse("v1:admin_panel:phone-change-decision", args=[req.id, "approve"])).data
        self.assertEqual(detail["phone_requests"][0]["status"], "approved")
        self.user.refresh_from_db()
        self.assertEqual((self.user.phone, self.user.is_phone_verified), ("+15125550199", False))
        listing = self.client.get(reverse("v1:admin_panel:shopper-list"), {"phone_change": "pending"}).data
        self.assertEqual(listing["count"], 0)

    def test_reserve_contact_phone_never_replaces(self):
        from Apps.accounts.services import remember_phone

        self.assertFalse(remember_phone(self.user, "+15125550177"))
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "+15125550123")
