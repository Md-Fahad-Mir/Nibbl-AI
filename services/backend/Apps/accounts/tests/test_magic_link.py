"""Master brand onboarding: passwordless signup + magic-link sign-in (15 min)."""

import datetime as dt
import re

from django.core import mail
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import MagicLinkToken, PendingUser, User


def _token(body):
    return re.search(r"token=([\w\-]+)", body).group(1)


class MagicLinkTests(APITestCase):
    def test_passwordless_brand_signup_signs_in_from_the_link(self):
        resp = self.client.post(reverse("v1:accounts:auth:register"), {
            "full_name": "Jordan Smith", "email": "jordan@acme.com", "accept_terms": True, "verify_via": "link",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        pending = PendingUser.objects.get(email="jordan@acme.com")
        self.assertLessEqual(pending.expires_at, timezone.now() + dt.timedelta(minutes=15, seconds=5))
        self.assertIn("15 minutes", mail.outbox[-1].body)
        data = self.client.post(reverse("v1:accounts:auth:verify-email"), {
            "email": "jordan@acme.com", "token": pending.verification_token,
        }, format="json").data
        self.assertTrue(data["access"] and data["refresh"])
        self.assertFalse(User.objects.get(email="jordan@acme.com").has_usable_password())

    def test_password_still_required_for_code_signup(self):
        resp = self.client.post(reverse("v1:accounts:auth:register"), {
            "full_name": "Sam", "email": "sam@x.com", "accept_terms": True,
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_magic_link_sign_in_once_and_expires(self):
        user = User.objects.create_user(email="owner@acme.com", password="x", full_name="O", is_email_verified=True)
        url = reverse("v1:accounts:auth:magic-link")
        self.assertEqual(self.client.post(url, {"email": "nobody@x.com"}, format="json").status_code, 202)
        self.assertEqual(len(mail.outbox), 0)  # unknown email: nothing sent, same answer
        self.client.post(url, {"email": "owner@acme.com"}, format="json")
        token = _token(mail.outbox[-1].body)
        self.assertIn("/login/magic?token=", mail.outbox[-1].body)

        sign_in = reverse("v1:accounts:auth:magic-link-sign-in")
        ok = self.client.post(sign_in, {"token": token}, format="json")
        self.assertEqual((ok.status_code, ok.data["user"]["email"]), (200, user.email))
        self.assertEqual(self.client.post(sign_in, {"token": token}, format="json").status_code, 400)  # once

        self.client.post(url, {"email": "owner@acme.com"}, format="json")
        token = _token(mail.outbox[-1].body)
        MagicLinkToken.objects.filter(user=user, used_at__isnull=True).update(
            expires_at=timezone.now() - dt.timedelta(seconds=1))
        self.assertEqual(self.client.post(sign_in, {"token": token}, format="json").status_code, 400)  # expired
