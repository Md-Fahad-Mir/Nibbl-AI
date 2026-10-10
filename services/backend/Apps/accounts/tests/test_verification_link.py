"""Brand signup verifies the work email through a secure link (Master:
Plan & Account Setup); the shopper app keeps the 6-digit code."""

import datetime as dt

from django.core import mail
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import PendingUser, User

BODY = {"full_name": "Founder", "email": "founder@acme.com", "password": "Str0ng!Passw0rd", "accept_terms": True}


@override_settings(BRAND_APP_URL="https://brand.example.com")
class VerificationLinkTests(APITestCase):
    def register(self, **extra):
        return self.client.post(reverse("v1:accounts:auth:register"), {**BODY, **extra}, format="json")

    def verify(self, **body):
        return self.client.post(reverse("v1:accounts:auth:verify-email"), {"email": BODY["email"], **body}, format="json")

    def test_link_signup_verifies_once_with_token(self):
        self.assertEqual(self.register(verify_via="link").status_code, 201)
        token = PendingUser.objects.get().verification_token
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(f"https://brand.example.com/verify-email?email=founder%40acme.com&token={token}", mail.outbox[0].body)
        self.assertEqual(self.verify(code=PendingUser.objects.get().verification_code).status_code, 400)  # code not accepted
        self.assertEqual(self.verify(token="wrong").status_code, 400)
        self.assertEqual(self.verify(token=token).status_code, 200)
        self.assertTrue(User.objects.get(email=BODY["email"]).is_email_verified)
        self.assertFalse(PendingUser.objects.exists())  # single use

    def test_expired_link_and_resend(self):
        self.register(verify_via="link")
        PendingUser.objects.update(expires_at=timezone.now() - dt.timedelta(minutes=1))
        old = PendingUser.objects.get().verification_token
        self.assertEqual(self.verify(token=old).status_code, 400)
        self.client.post(reverse("v1:accounts:auth:resend-email-verification"),
                         {"email": BODY["email"], "verify_via": "link"}, format="json")
        new = PendingUser.objects.get().verification_token
        self.assertNotEqual(old, new)
        self.assertEqual(self.verify(token=old).status_code, 400)
        self.assertEqual(self.verify(token=new).status_code, 200)

    def test_code_signup_unchanged(self):
        self.register()
        pending = PendingUser.objects.get()
        self.assertEqual(pending.verification_token, "")
        self.assertIn(pending.verification_code, mail.outbox[0].body)
        self.assertEqual(self.verify(code=pending.verification_code).status_code, 200)

    def test_brand_application_filed_on_verification(self):
        from Apps.brands.models import BrandApplication

        self.register(verify_via="link", brand_application={
            "brand_name": "Acme Snacks", "contact_email": BODY["email"], "requested_plan": "pro",
        })
        self.assertFalse(BrandApplication.objects.exists())  # not until verified
        self.verify(token=PendingUser.objects.get().verification_token)
        application = BrandApplication.objects.get()
        self.assertEqual((application.brand_name, application.requested_plan.slug, application.status),
                         ("Acme Snacks", "pro", "pending"))
        self.assertEqual(application.applicant.email, BODY["email"])
