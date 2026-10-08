from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.payouts import services
from Apps.payouts.models import PayoutBatch, PayoutMethod, WithdrawalRequest
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry

S = WithdrawalRequest.Status


def _funded_user(email="c@example.com", balance="100.00"):
    user = User.objects.create_user(email=email, password="x", full_name="U")
    wallet = wallet_services.get_or_create_customer_wallet(user)
    if Decimal(balance) > 0:
        wallet_services.credit(
            wallet=wallet, amount=Decimal(balance),
            category=LedgerEntry.Category.ADJUSTMENT,
        )
    return user, wallet


def _admin():
    return User.objects.create_user(
        email="admin@example.com", password="x", full_name="Admin",
        role=User.Role.ADMIN, is_staff=True,
    )


def _method(user, provider="paypal", handle="c@paypal.com"):
    return services.add_payout_method(user=user, provider=provider, handle=handle)


class PayoutMethodTests(APITestCase):
    def test_add_method(self):
        user, _ = _funded_user()
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:payouts:method-list"),
            {"provider": "paypal", "handle": "me@paypal.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_account_links_to_only_one_user(self):
        u1, _ = _funded_user("a@example.com")
        u2, _ = _funded_user("b@example.com")
        _method(u1, handle="shared@paypal.com")
        with self.assertRaises(services.PayoutError):
            _method(u2, handle="shared@paypal.com")


class PayoutReviewTests(APITestCase):
    def test_first_method_approved_second_pending(self):
        user, _ = _funded_user()
        m1 = _method(user, handle="first@paypal.com")
        self.assertEqual(m1.review_status, PayoutMethod.ReviewStatus.APPROVED)
        m2 = services.add_payout_method(user=user, provider="venmo", handle="second-venmo")
        self.assertEqual(m2.review_status, PayoutMethod.ReviewStatus.PENDING)

    def test_withdrawal_blocked_on_pending_method(self):
        user, _ = _funded_user(balance="100.00")
        _method(user, handle="first@paypal.com")  # auto-approved
        m2 = services.add_payout_method(user=user, provider="venmo", handle="pend-venmo")
        with self.assertRaises(services.PayoutError):
            services.request_withdrawal(
                user=user, payout_method_id=m2.id, amount=Decimal("10.00")
            )

    def test_duplicate_across_users_raises_fraud_flag(self):
        from Apps.receipts.models import FraudFlag

        u1, _ = _funded_user("a@example.com")
        u2, _ = _funded_user("b@example.com")
        _method(u1, handle="shared@paypal.com")
        with self.assertRaises(services.PayoutError):
            _method(u2, handle="shared@paypal.com")
        self.assertTrue(FraudFlag.objects.filter(user=u2).exists())

    def test_admin_approves_then_withdrawal_allowed(self):
        admin = _admin()
        user, _ = _funded_user(balance="100.00")
        _method(user, handle="first@paypal.com")
        m2 = services.add_payout_method(user=user, provider="venmo", handle="pend2-venmo")

        self.client.force_authenticate(admin)
        listing = self.client.get(reverse("v1:payouts:admin-method-pending"))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listing.data), 1)

        resp = self.client.post(
            reverse("v1:payouts:admin-method-review", args=[m2.id]),
            {"approve": True}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["review_status"], "approved")

        withdrawal = services.request_withdrawal(
            user=user, payout_method_id=m2.id, amount=Decimal("10.00")
        )
        self.assertIsNotNone(withdrawal)

    def test_non_admin_cannot_review(self):
        user, _ = _funded_user()
        _method(user, handle="first@paypal.com")
        m2 = services.add_payout_method(user=user, provider="venmo", handle="pend3-venmo")
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:payouts:admin-method-review", args=[m2.id]),
            {"approve": True}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class RequestWithdrawalTests(APITestCase):
    def test_request_places_hold_and_reduces_available(self):
        user, wallet = _funded_user(balance="100.00")
        method = _method(user)
        withdrawal = services.request_withdrawal(
            user=user, payout_method_id=method.id, amount=Decimal("40.00")
        )
        self.assertEqual(withdrawal.status, S.PENDING)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("100.00"))  # unchanged
        self.assertEqual(wallet.held_amount(), Decimal("40.00"))
        self.assertEqual(wallet.available(), Decimal("60.00"))

    def test_cannot_withdraw_more_than_available(self):
        user, wallet = _funded_user(balance="30.00")
        method = _method(user)
        with self.assertRaises(services.PayoutError):
            services.request_withdrawal(
                user=user, payout_method_id=method.id, amount=Decimal("50.00")
            )

    def test_two_withdrawals_cannot_exceed_balance(self):
        user, wallet = _funded_user(balance="100.00")
        method = _method(user)
        services.request_withdrawal(user=user, payout_method_id=method.id, amount=Decimal("70.00"))
        with self.assertRaises(services.PayoutError):
            services.request_withdrawal(
                user=user, payout_method_id=method.id, amount=Decimal("40.00")
            )

    def test_requires_a_method(self):
        user, _ = _funded_user()
        with self.assertRaises(services.PayoutError):
            services.request_withdrawal(
                user=user, payout_method_id="00000000-0000-0000-0000-000000000000",
                amount=Decimal("10.00"),
            )


class StatusMachineTests(APITestCase):
    def setUp(self):
        self.user, self.wallet = _funded_user(balance="100.00")
        self.method = _method(self.user)
        self.admin = _admin()
        self.w = services.request_withdrawal(
            user=self.user, payout_method_id=self.method.id, amount=Decimal("40.00")
        )

    def test_approve_then_mark_paid_captures_hold(self):
        services.approve_withdrawal(withdrawal=self.w, admin=self.admin)
        self.w.refresh_from_db()
        self.assertEqual(self.w.status, S.APPROVED)

        services.mark_paid(withdrawal=self.w, admin=self.admin)
        self.w.refresh_from_db()
        self.assertEqual(self.w.status, S.PAID)
        # Hold captured -> balance debited.
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("60.00"))
        self.assertEqual(self.wallet.held_amount(), Decimal("0.00"))
        self.assertEqual(self.w.hold.status, Hold.Status.CAPTURED)

    def test_reject_releases_hold(self):
        services.reject_withdrawal(withdrawal=self.w, admin=self.admin, reason="Suspicious")
        self.w.refresh_from_db()
        self.assertEqual(self.w.status, S.REJECTED)
        self.assertEqual(self.w.admin_note, "Suspicious")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.held_amount(), Decimal("0.00"))
        self.assertEqual(self.wallet.available(), Decimal("100.00"))

    def test_flagged_cannot_be_paid(self):
        services.flag_withdrawal(withdrawal=self.w, admin=self.admin, reason="Review")
        self.w.refresh_from_db()
        self.assertEqual(self.w.status, S.FLAGGED)
        # Hold still in place while flagged.
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.held_amount(), Decimal("40.00"))
        with self.assertRaises(services.PayoutError):
            services.mark_paid(withdrawal=self.w, admin=self.admin)

    def test_flagged_can_be_approved_then_paid(self):
        services.flag_withdrawal(withdrawal=self.w, admin=self.admin)
        services.approve_withdrawal(withdrawal=self.w, admin=self.admin)
        services.mark_paid(withdrawal=self.w, admin=self.admin)
        self.w.refresh_from_db()
        self.assertEqual(self.w.status, S.PAID)

    def test_cannot_pay_pending(self):
        with self.assertRaises(services.PayoutError):
            services.mark_paid(withdrawal=self.w, admin=self.admin)

    def test_cannot_reject_paid(self):
        services.approve_withdrawal(withdrawal=self.w, admin=self.admin)
        services.mark_paid(withdrawal=self.w, admin=self.admin)
        with self.assertRaises(services.PayoutError):
            services.reject_withdrawal(withdrawal=self.w, admin=self.admin)


class BatchTests(APITestCase):
    def test_create_batch_and_export(self):
        admin = _admin()
        u1, _ = _funded_user("a@example.com", balance="100.00")
        u2, _ = _funded_user("b@example.com", balance="100.00")
        m1, m2 = _method(u1, handle="a@paypal.com"), _method(u2, provider="venmo", handle="b-venmo")
        w1 = services.request_withdrawal(user=u1, payout_method_id=m1.id, amount=Decimal("20.00"))
        w2 = services.request_withdrawal(user=u2, payout_method_id=m2.id, amount=Decimal("30.00"))
        services.approve_withdrawal(withdrawal=w1, admin=admin)
        services.approve_withdrawal(withdrawal=w2, admin=admin)

        batch = services.create_batch(admin=admin)
        self.assertEqual(batch.total_amount, Decimal("50.00"))
        for w in (w1, w2):
            w.refresh_from_db()
            self.assertEqual(w.status, S.PROCESSING)
            self.assertEqual(w.batch_id, batch.id)

        export = services.export_batch(batch)
        self.assertEqual(export["count"], 2)
        self.assertEqual(export["total_amount"], "50.00")
        handles = {r["handle"] for r in export["rows"]}
        self.assertEqual(handles, {"a@paypal.com", "b-venmo"})
        batch.refresh_from_db()
        self.assertEqual(batch.status, PayoutBatch.Status.EXPORTED)

    def test_create_batch_requires_approved(self):
        admin = _admin()
        with self.assertRaises(services.PayoutError):
            services.create_batch(admin=admin)


class AdminApiTests(APITestCase):
    def test_admin_endpoints_require_admin(self):
        user, _ = _funded_user()
        self.client.force_authenticate(user)
        resp = self.client.get(reverse("v1:payouts:admin-withdrawal-list"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_approve_via_api(self):
        user, wallet = _funded_user(balance="100.00")
        method = _method(user)
        w = services.request_withdrawal(
            user=user, payout_method_id=method.id, amount=Decimal("25.00")
        )
        admin = _admin()
        self.client.force_authenticate(admin)
        resp = self.client.post(
            reverse("v1:payouts:admin-withdrawal-action", args=[w.id, "approve"])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["status"], "approved")

    def test_user_sees_only_own_withdrawals(self):
        u1, w1 = _funded_user("a@example.com", balance="100.00")
        m1 = _method(u1)
        services.request_withdrawal(user=u1, payout_method_id=m1.id, amount=Decimal("10.00"))
        other = User.objects.create_user(email="other@example.com", password="x", full_name="O")
        self.client.force_authenticate(other)
        resp = self.client.get(reverse("v1:payouts:withdrawal-list"))
        # Paginated envelope: {count, next, previous, results}
        self.assertEqual(resp.data["count"], 0)
        self.assertEqual(resp.data["results"], [])
