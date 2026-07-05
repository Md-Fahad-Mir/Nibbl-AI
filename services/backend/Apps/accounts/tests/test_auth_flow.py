from django.core import mail
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User, VerificationCode


def _code_for(user, purpose):
    return (
        VerificationCode.objects.filter(user=user, purpose=purpose, consumed_at__isnull=True)
        .latest("created_at")
        .code
    )


class RegistrationTests(APITestCase):
    url = None

    def setUp(self):
        self.url = reverse("v1:accounts:auth:register")

    def test_register_creates_pending_user_and_sends_code(self):
        from Apps.accounts.models import PendingUser
        resp = self.client.post(
            self.url,
            {
                "full_name": "Ada Lovelace",
                "email": "ada@example.com",
                "password": "Sup3rSecret!",
                "accept_terms": True,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # Main user must not exist yet!
        self.assertFalse(User.objects.filter(email="ada@example.com").exists())
        # Pending user must exist!
        pending = PendingUser.objects.get(email="ada@example.com")
        self.assertEqual(pending.full_name, "Ada Lovelace")
        self.assertEqual(len(mail.outbox), 1)

    def test_register_requires_terms_acceptance(self):
        resp = self.client.post(
            self.url,
            {
                "full_name": "No Terms",
                "email": "no@example.com",
                "password": "Sup3rSecret!",
                "accept_terms": False,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_rejects_duplicate_email(self):
        User.objects.create_user(email="dup@example.com", password="x", full_name="Dup")
        resp = self.client.post(
            self.url,
            {
                "full_name": "Second",
                "email": "dup@example.com",
                "password": "Sup3rSecret!",
                "accept_terms": True,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_with_referral_links_referrer(self):
        from Apps.accounts.models import PendingUser
        referrer = User.objects.create_user(
            email="ref@example.com", password="x", full_name="Ref"
        )
        resp = self.client.post(
            self.url,
            {
                "full_name": "Invited",
                "email": "invited@example.com",
                "password": "Sup3rSecret!",
                "accept_terms": True,
                "referral_code": referrer.referral_code,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # Not in main User yet
        self.assertFalse(User.objects.filter(email="invited@example.com").exists())

        # Pending has the referral code
        pending = PendingUser.objects.get(email="invited@example.com")
        self.assertEqual(pending.referral_code, referrer.referral_code)

        # Let's verify to create the user
        resp_verify = self.client.post(
            reverse("v1:accounts:auth:verify-email"),
            {"email": "invited@example.com", "code": pending.verification_code},
            format="json",
        )
        self.assertEqual(resp_verify.status_code, status.HTTP_200_OK)

        # Now the User exists and has the referrer set
        invited = User.objects.get(email="invited@example.com")
        self.assertEqual(invited.referred_by_id, referrer.id)


class EmailVerificationTests(APITestCase):
    def test_verify_email_with_valid_code(self):
        from Apps.accounts.models import PendingUser
        self.client.post(
            reverse("v1:accounts:auth:register"),
            {
                "full_name": "Ada",
                "email": "ada@example.com",
                "password": "Sup3rSecret!",
                "accept_terms": True,
            },
            format="json",
        )
        pending = PendingUser.objects.get(email="ada@example.com")
        code = pending.verification_code

        resp = self.client.post(
            reverse("v1:accounts:auth:verify-email"),
            {"email": "ada@example.com", "code": code},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        user = User.objects.get(email="ada@example.com")
        self.assertTrue(user.is_email_verified)

    def test_verify_email_rejects_bad_code(self):
        User.objects.create_user(email="ada@example.com", password="x", full_name="Ada")
        resp = self.client.post(
            reverse("v1:accounts:auth:verify-email"),
            {"email": "ada@example.com", "code": "000000"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_email_rejects_bad_code_for_pending_user(self):
        self.client.post(
            reverse("v1:accounts:auth:register"),
            {
                "full_name": "Ada",
                "email": "ada@example.com",
                "password": "Sup3rSecret!",
                "accept_terms": True,
            },
            format="json",
        )
        resp = self.client.post(
            reverse("v1:accounts:auth:verify-email"),
            {"email": "ada@example.com", "code": "000000"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)



class LoginTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ada@example.com", password="Sup3rSecret!", full_name="Ada", is_email_verified=True
        )

    def test_login_returns_token_pair(self):
        resp = self.client.post(
            reverse("v1:accounts:auth:login"),
            {"email": "ada@example.com", "password": "Sup3rSecret!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_login_rejects_bad_password(self):
        resp = self.client.post(
            reverse("v1:accounts:auth:login"),
            {"email": "ada@example.com", "password": "wrong"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_rejects_unverified_email(self):
        unverified_user = User.objects.create_user(
            email="unverified@example.com", password="Sup3rSecret!", full_name="Unverified"
        )
        resp = self.client.post(
            reverse("v1:accounts:auth:login"),
            {"email": "unverified@example.com", "password": "Sup3rSecret!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(resp.data["detail"], "Email address is not verified.")


    def test_me_requires_auth(self):
        resp = self.client.get(reverse("v1:accounts:users:me"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_profile_when_authenticated(self):
        self.client.force_authenticate(self.user)
        resp = self.client.get(reverse("v1:accounts:users:me"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"], "ada@example.com")

    def test_me_patch_updates_phone_and_marks_unverified(self):
        self.user.phone = "+15550001111"
        self.user.is_phone_verified = True
        self.user.save(update_fields=["phone", "is_phone_verified", "updated_at"])
        self.client.force_authenticate(self.user)

        resp = self.client.patch(
            reverse("v1:accounts:users:me"),
            {"phone": "+15551234567"},
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["phone"], "+15551234567")
        self.assertFalse(resp.data["is_phone_verified"])
        self.user.refresh_from_db()
        self.assertEqual(self.user.phone, "+15551234567")
        self.assertFalse(self.user.is_phone_verified)

    def test_me_patch_rejects_duplicate_phone(self):
        User.objects.create_user(
            email="grace@example.com",
            password="x",
            full_name="Grace",
            phone="+15551234567",
        )
        self.client.force_authenticate(self.user)

        resp = self.client.patch(
            reverse("v1:accounts:users:me"),
            {"phone": "+15551234567"},
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("phone", resp.data)


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ada@example.com", password="OldPass123!", full_name="Ada"
        )

    def test_full_reset_flow(self):
        self.client.post(
            reverse("v1:accounts:auth:password-forgot"),
            {"email": "ada@example.com"},
            format="json",
        )
        code = _code_for(self.user, VerificationCode.Purpose.PASSWORD_RESET)
        resp = self.client.post(
            reverse("v1:accounts:auth:password-reset"),
            {"email": "ada@example.com", "code": code, "new_password": "BrandNew123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandNew123!"))

    def test_forgot_password_unknown_email_is_silent(self):
        resp = self.client.post(
            reverse("v1:accounts:auth:password-forgot"),
            {"email": "nobody@example.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)


class PhoneVerificationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ada@example.com", password="x", full_name="Ada"
        )
        self.client.force_authenticate(self.user)

    def test_add_and_verify_phone(self):
        resp = self.client.post(
            reverse("v1:accounts:users:add-phone"),
            {"phone": "+15551234567"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_202_ACCEPTED)
        code = _code_for(self.user, VerificationCode.Purpose.PHONE_VERIFY)

        resp = self.client.post(
            reverse("v1:accounts:users:verify-phone"),
            {"code": code},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_phone_verified)


class AccountDeletionTests(APITestCase):
    def test_delete_account_soft_deletes_and_frees_email(self):
        user = User.objects.create_user(
            email="ada@example.com", password="x", full_name="Ada"
        )
        self.client.force_authenticate(user)
        # Re-authentication (current password) is now required.
        resp = self.client.delete(
            reverse("v1:accounts:users:me"), {"password": "x"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        user.refresh_from_db()
        self.assertTrue(user.is_deleted)
        self.assertFalse(user.is_active)
        self.assertNotEqual(user.email, "ada@example.com")

    def test_delete_account_rejects_wrong_password(self):
        user = User.objects.create_user(
            email="ada@example.com", password="RightPass123!", full_name="Ada"
        )
        self.client.force_authenticate(user)
        resp = self.client.delete(
            reverse("v1:accounts:users:me"), {"password": "wrong"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        user.refresh_from_db()
        self.assertFalse(user.is_deleted)


class ReferralTests(APITestCase):
    def test_referral_overview_counts_referrals(self):
        referrer = User.objects.create_user(
            email="ref@example.com", password="x", full_name="Ref"
        )
        User.objects.create_user(
            email="a@example.com", password="x", full_name="A", referred_by=referrer
        )
        User.objects.create_user(
            email="b@example.com", password="x", full_name="B", referred_by=referrer
        )
        self.client.force_authenticate(referrer)
        resp = self.client.get(reverse("v1:accounts:users:referrals"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["total_referrals"], 2)
        self.assertEqual(resp.data["referral_code"], referrer.referral_code)


class SocialLoginScaffoldTests(APITestCase):
    def test_social_login_not_configured_returns_400(self):
        resp = self.client.post(
            reverse("v1:accounts:auth:social-login"),
            {"provider": "google", "token": "fake"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
