"""Payout business logic: methods, withdrawals (status machine), and batches."""

from __future__ import annotations

import datetime as dt
import logging

from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from Apps.accounts import twilio_verify
from Apps.common.exceptions import DomainError
from Apps.common.models import get_platform_settings
from Apps.common.money import ZERO, to_money
from Apps.payouts.models import PayoutBatch, PayoutMethod, WithdrawalRequest
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry

logger = logging.getLogger(__name__)

S = WithdrawalRequest.Status


class PayoutError(DomainError):
    """Expected, user-facing payout errors (mapped to HTTP 400)."""


# ---------------------------------------------------------------------------
# Payout methods
# ---------------------------------------------------------------------------
def add_payout_method(*, user, provider, handle, is_default=False) -> PayoutMethod:
    handle = handle.strip()
    if not handle:
        raise PayoutError("A payout account handle is required.")

    # Same account already linked to this user.
    if user.payout_methods.filter(provider=provider, handle__iexact=handle).exists():
        raise PayoutError("This payout account is already linked to your account.")

    # Linked to ANOTHER user → a fraud signal. Raise a review flag and reject
    # the add rather than silently failing on the uniqueness constraint.
    if PayoutMethod.objects.filter(provider=provider, handle__iexact=handle).exists():
        from Apps.receipts.models import FraudFlag

        FraudFlag.objects.create(
            user=user,
            reason=FraudFlag.Reason.MANUAL,
            detail=f"Duplicate payout account attempted: {provider}:{handle}",
        )
        raise PayoutError(
            "This payout account is linked to another account and has been "
            "flagged for review."
        )

    # A user's first payout method is usable immediately; any later change goes
    # to a review hold until an admin approves it (spec 2.7).
    is_first = not user.payout_methods.exists()
    review_status = (
        PayoutMethod.ReviewStatus.APPROVED
        if is_first
        else PayoutMethod.ReviewStatus.PENDING
    )
    try:
        with transaction.atomic():
            if is_default:
                user.payout_methods.update(is_default=False)
            return PayoutMethod.objects.create(
                user=user, provider=provider, handle=handle,
                is_default=is_default, review_status=review_status,
            )
    except IntegrityError:
        raise PayoutError("This payout account is already linked to an account.")


def remove_payout_method(method: PayoutMethod) -> None:
    if method.withdrawals.exclude(
        status__in=[S.PAID, S.REJECTED]
    ).exists():
        raise PayoutError("This method has in-progress withdrawals and can't be removed.")
    method.delete()


def list_pending_payout_methods():
    """Payout methods awaiting admin review (the review queue)."""
    return (
        PayoutMethod.objects.filter(review_status=PayoutMethod.ReviewStatus.PENDING)
        .select_related("user")
        .order_by("created_at")
    )


def review_payout_method(*, method: PayoutMethod, approve: bool, note="") -> PayoutMethod:
    """Approve or reject a payout method held for review."""
    method.review_status = (
        PayoutMethod.ReviewStatus.APPROVED
        if approve
        else PayoutMethod.ReviewStatus.REJECTED
    )
    method.review_note = note or ""
    method.save(update_fields=["review_status", "review_note", "updated_at"])
    return method


# ---------------------------------------------------------------------------
# Withdrawal request (places a hold on the customer wallet)
# ---------------------------------------------------------------------------
@transaction.atomic
def _validate_withdrawal(*, user, payout_method_id, amount):
    """Shared pre-checks for a withdrawal. Returns (method, wallet, amount)."""
    amount = to_money(amount)
    minimum = to_money(settings.PAYOUT_MIN_AMOUNT)
    if amount < minimum:
        raise PayoutError(f"Minimum withdrawal is {minimum}.")

    method = PayoutMethod.objects.filter(id=payout_method_id, user=user).first()
    if method is None:
        raise PayoutError("Payout method not found.")
    if method.review_status != PayoutMethod.ReviewStatus.APPROVED:
        raise PayoutError(
            "This payout method is under review. You can withdraw once it's approved."
        )

    wallet = wallet_services.get_or_create_customer_wallet(user)
    if wallet.available() < amount:
        raise PayoutError("Insufficient available balance.")
    return method, wallet, amount


class PhoneVerificationRequired(PayoutError):
    """The shopper must verify a phone before an SMS-verified withdrawal."""

    code = "phone_verification_required"


def sms_required() -> bool:
    """Withdrawals need an SMS code whenever SMS sending (Twilio Verify) is
    configured."""
    return twilio_verify.is_configured()


def _require_verified_phone(user) -> str:
    if not (user.phone and user.is_phone_verified):
        raise PhoneVerificationRequired("Verify your mobile number before withdrawing.")
    paused_until = user.withdrawals_paused_until
    if paused_until and paused_until > timezone.now():
        raise PayoutError(
            "Withdrawals are paused until "
            f"{paused_until:%b %d, %H:%M} UTC because your phone number changed."
        )
    return user.phone


def _mask_phone(phone: str) -> str:
    return "•••• ••" + phone[-4:] if len(phone) >= 4 else "••••"


def start_withdrawal_verification(*, user, payout_method_id, amount) -> str:
    """Validate the pending withdrawal and send an SMS code (returns masked phone)."""
    _validate_withdrawal(user=user, payout_method_id=payout_method_id, amount=amount)
    # Report "SMS verification unavailable" (→ 503, clients skip the SMS step)
    # before demanding a verified phone; otherwise shoppers without one could
    # never withdraw while verification is switched off.
    if not sms_required():
        raise twilio_verify.TwilioNotConfigured("SMS verification is not required.")
    phone = _require_verified_phone(user)
    try:
        twilio_verify.start_verification(phone)
    except Exception:
        # e.g. Twilio rejects the number or the country isn't enabled.
        logger.exception("Withdrawal SMS send failed for user %s", user.pk)
        raise PayoutError(
            "We couldn't send a code to your phone. Please try again shortly."
        )
    return _mask_phone(phone)


def _withdrawal_needs_review(user, amount) -> bool:
    """Flag a withdrawal for manual review when it exceeds the admin-configured
    single-amount or rolling-window thresholds (spec 5.6)."""
    cfg = get_platform_settings()
    if amount > cfg.withdrawal_review_single:
        return True
    window_start = timezone.now() - dt.timedelta(days=cfg.withdrawal_rolling_days)
    recent_total = (
        WithdrawalRequest.objects.filter(user=user, created_at__gte=window_start)
        .exclude(status=S.REJECTED)
        .aggregate(total=Sum("amount"))["total"]
        or ZERO
    )
    return (recent_total + amount) > cfg.withdrawal_review_rolling


def request_withdrawal(*, user, payout_method_id, amount, code="") -> WithdrawalRequest:
    method, wallet, amount = _validate_withdrawal(
        user=user, payout_method_id=payout_method_id, amount=amount
    )

    # SMS verification is enforced only when the admin switch is on (and SMS
    # is configured); otherwise the flow is unchanged.
    if sms_required():
        phone = _require_verified_phone(user)
        if not code or not twilio_verify.check_verification(phone, code):
            raise PayoutError("Invalid or missing verification code.")

    withdrawal = WithdrawalRequest.objects.create(
        user=user, payout_method=method, provider=method.provider,
        handle=method.handle, amount=amount, status=S.PENDING,
        needs_review=_withdrawal_needs_review(user, amount),
    )
    hold = wallet_services.place_hold(
        wallet=wallet, amount=amount,
        reference_type="withdrawal", reference_id=withdrawal.id,
        idempotency_key=f"withdrawal-hold:{withdrawal.id}",
    )
    withdrawal.hold = hold
    withdrawal.save(update_fields=["hold", "updated_at"])
    return withdrawal


# ---------------------------------------------------------------------------
# Admin status machine
# ---------------------------------------------------------------------------
def _require_status(withdrawal: WithdrawalRequest, allowed) -> None:
    if withdrawal.status not in allowed:
        raise PayoutError(
            f"Cannot perform this action on a '{withdrawal.status}' withdrawal."
        )


def _stamp(withdrawal: WithdrawalRequest, admin) -> None:
    withdrawal.reviewed_by = admin
    withdrawal.reviewed_at = timezone.now()


def approve_withdrawal(*, withdrawal, admin) -> WithdrawalRequest:
    _require_status(withdrawal, {S.PENDING, S.FLAGGED})
    withdrawal.status = S.APPROVED
    _stamp(withdrawal, admin)
    withdrawal.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    return withdrawal


def flag_withdrawal(*, withdrawal, admin, reason="") -> WithdrawalRequest:
    _require_status(withdrawal, {S.PENDING, S.APPROVED})
    withdrawal.status = S.FLAGGED
    if reason:
        withdrawal.admin_note = reason
    _stamp(withdrawal, admin)
    withdrawal.save(
        update_fields=["status", "admin_note", "reviewed_by", "reviewed_at", "updated_at"]
    )
    return withdrawal


@transaction.atomic
def reject_withdrawal(*, withdrawal, admin, reason="") -> WithdrawalRequest:
    _require_status(withdrawal, {S.PENDING, S.APPROVED, S.PROCESSING, S.FLAGGED})
    if withdrawal.hold_id and withdrawal.hold.status == Hold.Status.ACTIVE:
        wallet_services.release_hold(hold=withdrawal.hold)
    withdrawal.status = S.REJECTED
    if reason:
        withdrawal.admin_note = reason
    _stamp(withdrawal, admin)
    withdrawal.save(
        update_fields=["status", "admin_note", "reviewed_by", "reviewed_at", "updated_at"]
    )
    return withdrawal


@transaction.atomic
def mark_paid(*, withdrawal, admin) -> WithdrawalRequest:
    _require_status(withdrawal, {S.APPROVED, S.PROCESSING})
    if withdrawal.hold_id is None or withdrawal.hold.status != Hold.Status.ACTIVE:
        raise PayoutError("The withdrawal's hold is unavailable.")
    wallet_services.capture_hold(
        hold=withdrawal.hold,
        category=LedgerEntry.Category.PAYOUT,
        description=f"Payout via {withdrawal.provider}",
        idempotency_key=f"withdrawal-payout:{withdrawal.id}",
    )
    withdrawal.status = S.PAID
    withdrawal.paid_at = timezone.now()
    _stamp(withdrawal, admin)
    withdrawal.save(
        update_fields=["status", "paid_at", "reviewed_by", "reviewed_at", "updated_at"]
    )
    return withdrawal


def add_note(*, withdrawal, note) -> WithdrawalRequest:
    withdrawal.admin_note = note
    withdrawal.save(update_fields=["admin_note", "updated_at"])
    return withdrawal


# ---------------------------------------------------------------------------
# Batches
# ---------------------------------------------------------------------------
@transaction.atomic
def create_batch(*, admin, withdrawal_ids=None) -> PayoutBatch:
    qs = WithdrawalRequest.objects.filter(status=S.APPROVED)
    if withdrawal_ids:
        qs = qs.filter(id__in=withdrawal_ids)
    approved = list(qs)
    if not approved:
        raise PayoutError("No approved withdrawals to batch.")

    batch = PayoutBatch.objects.create(
        created_by=admin,
        total_amount=sum((w.amount for w in approved), ZERO),
    )
    for withdrawal in approved:
        withdrawal.status = S.PROCESSING
        withdrawal.batch = batch
        withdrawal.save(update_fields=["status", "batch", "updated_at"])
    return batch


def export_batch(batch: PayoutBatch) -> dict:
    rows = [
        {
            "withdrawal_id": str(w.id),
            "user_email": w.user.email,
            "provider": w.provider,
            "handle": w.handle,
            "amount": str(w.amount),
        }
        for w in batch.withdrawals.select_related("user").all()
    ]
    if batch.status == PayoutBatch.Status.CREATED:
        batch.status = PayoutBatch.Status.EXPORTED
        batch.exported_at = timezone.now()
        batch.save(update_fields=["status", "exported_at", "updated_at"])
    return {
        "batch_id": str(batch.id),
        "total_amount": str(batch.total_amount),
        "count": len(rows),
        "rows": rows,
    }
