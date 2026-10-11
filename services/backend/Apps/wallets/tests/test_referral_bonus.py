"""Referral reward qualification (Master: Refer a Friend; Admin Referrals)."""

from decimal import Decimal
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts import referrals
from Apps.accounts.models import PendingUser, Referral, User
from Apps.wallets import services
from Apps.wallets.models import LedgerEntry


def _bonus_count(user):
    return LedgerEntry.objects.filter(
        wallet=services.get_or_create_customer_wallet(user), category=LedgerEntry.Category.REFERRAL_BONUS
    ).count()


class ReferralQualificationTests(APITestCase):
    def setUp(self):
        self.inviter = User.objects.create_user(email="inviter@example.com", password="x", full_name="Inviter")

    def join(self):
        self.client.post(reverse("v1:accounts:auth:register"), {
            "full_name": "Invitee", "email": "invitee@example.com", "password": "Sup3rSecret!",
            "accept_terms": True, "referral_code": self.inviter.referral_code,
        }, format="json")
        code = PendingUser.objects.get(email="invitee@example.com").verification_code
        self.client.post(reverse("v1:accounts:auth:verify-email"), {"email": "invitee@example.com", "code": code},
                         format="json")
        return User.objects.get(email="invitee@example.com")

    def complete(self, user, *, missing=None):
        now = timezone.now()
        steps = {"claimed_at": now, "redeemed_at": now, "payout_connected_at": now, "withdrawn_at": now}
        if missing:
            steps[missing] = None
        return patch("Apps.accounts.referrals._completed_steps", return_value=steps)

    def test_signup_alone_pays_nothing(self):
        user = self.join()
        referral = Referral.objects.get(referred=user)
        self.assertEqual((referral.referrer, referral.status), (self.inviter, "in_progress"))
        self.assertEqual(_bonus_count(self.inviter), 0)  # no longer paid at email verification

    def test_paid_only_after_all_steps(self):
        user = self.join()
        with self.complete(user, missing="withdrawn_at"):
            referrals.refresh(user)
        self.assertEqual((Referral.objects.get().status, _bonus_count(self.inviter)), ("in_progress", 0))
        with self.complete(user):
            referrals.refresh(user)
            referrals.refresh(user)  # idempotent
        referral = Referral.objects.get()
        self.assertEqual((referral.status, referral.reward_amount), ("paid", Decimal("5.00")))
        self.assertEqual(_bonus_count(self.inviter), 1)

        self.client.force_authenticate(self.inviter)
        mine = self.client.get(reverse("v1:accounts:users:referrals")).data["referrals"][0]
        self.assertEqual((mine["status"], len(mine["steps"]), all(s["done"] for s in mine["steps"])), ("paid", 5, True))

    def test_flagged_then_admin_decisions(self):
        user = self.join()
        with self.complete(user), patch("Apps.accounts.referrals.protection_flags",
                                        return_value=["The new shopper and the referrer used the same device."]):
            referrals.refresh(user)
        referral = Referral.objects.get()
        self.assertEqual(referral.status, "flagged")
        self.assertEqual(_bonus_count(self.inviter), 0)

        self.client.force_authenticate(self.inviter)  # shopper never sees "flagged"
        self.assertEqual(self.client.get(reverse("v1:accounts:users:referrals")).data["referrals"][0]["status"], "in_review")

        admin = User.objects.create_user(email="a@x.com", password="x", full_name="A", role=User.Role.ADMIN, is_staff=True)
        self.client.force_authenticate(admin)
        listing = self.client.get(reverse("v1:admin_panel:referral-list"), {"status": "flagged"}).data
        self.assertEqual((listing["summary"]["flagged"], listing["results"][0]["flag_reason"].startswith("The new shopper and the referrer")),
                         (1, True))
        url = lambda action: reverse("v1:admin_panel:referral-action", args=[referral.id, action])  # noqa: E731
        self.assertEqual(self.client.post(url("reject"), {}, format="json").status_code, 400)  # reason required
        self.client.post(url("reject"), {"reason": "Accounts appear linked."}, format="json")
        self.assertEqual(Referral.objects.get().status, "rejected")
        self.client.post(url("approve"), {}, format="json")
        self.assertEqual((Referral.objects.get().status, _bonus_count(self.inviter)), ("paid", 1))

    def test_suspend_shopper_rejects_reward(self):
        user = self.join()
        with self.complete(user), patch("Apps.accounts.referrals.protection_flags", return_value=["x"]):
            referrals.refresh(user)
        admin = User.objects.create_user(email="a@x.com", password="x", full_name="A", role=User.Role.ADMIN, is_staff=True)
        self.client.force_authenticate(admin)
        self.client.post(reverse("v1:admin_panel:referral-action", args=[Referral.objects.get().id, "suspend"]),
                         {"target": "referred", "reason": "Self-referral"}, format="json")
        user.refresh_from_db()
        self.assertEqual((user.is_active, Referral.objects.get().status), (False, "rejected"))

    def test_progress_hook_on_real_events(self):
        user = self.join()
        from Apps.payouts import services as payouts

        with self.captureOnCommitCallbacks(execute=True):
            payouts.add_payout_method(user=user, provider="paypal", handle="invitee@pay.com")
        self.assertIsNotNone(Referral.objects.get().payout_connected_at)

    # --- Master: every step must be finished within 90 days of joining ---

    def test_overview_totals_link_and_days_left(self):
        user = self.join()
        self.client.force_authenticate(self.inviter)
        data = self.client.get(reverse("v1:accounts:users:referrals")).data
        self.assertTrue(data["referral_link"].endswith(f"/r/{self.inviter.referral_code}"))
        self.assertEqual((data["reward_amount"], data["window_days"]), ("5.00", 90))
        self.assertEqual(data["summary"], {"earned": "0", "pending": "5.00", "invited": 1})
        friend = data["referrals"][0]
        self.assertIn(friend["days_left"], (89, 90))
        with self.complete(user):
            referrals.refresh(user)
        data = self.client.get(reverse("v1:accounts:users:referrals")).data
        self.assertEqual((data["summary"]["earned"], data["summary"]["pending"]), ("5.00", "0"))
        self.assertIsNone(data["referrals"][0]["days_left"])

    def test_expires_after_90_days_and_late_steps_dont_count(self):
        import datetime as dt

        user = self.join()
        referral = Referral.objects.get(referred=user)
        late = timezone.now() + dt.timedelta(days=91)
        steps = {"claimed_at": timezone.now(), "redeemed_at": timezone.now(), "payout_connected_at": timezone.now(),
                 "withdrawn_at": late}  # final step after the window
        with patch("Apps.accounts.referrals._completed_steps", return_value=steps):
            referrals.refresh(user, now=late)
        referral.refresh_from_db()
        self.assertEqual((referral.status, referral.withdrawn_at), ("expired", None))
        self.assertEqual(_bonus_count(self.inviter), 0)
        self.client.force_authenticate(self.inviter)
        friend = self.client.get(reverse("v1:accounts:users:referrals")).data["referrals"][0]
        self.assertEqual(friend["status"], "expired")
        self.assertIn("90 days", friend["decision_reason"])

    def test_expiry_job_closes_old_referrals(self):
        import datetime as dt

        user = self.join()
        Referral.objects.filter(referred=user).update(created_at=timezone.now() - dt.timedelta(days=91))
        self.assertEqual(referrals.expire_overdue(), 1)
        self.assertEqual(Referral.objects.get().status, "expired")
