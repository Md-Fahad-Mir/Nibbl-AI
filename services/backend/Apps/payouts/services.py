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
from Apps.common.models import AuditLog, get_platform_settings
from Apps.common.money import ZERO, to_money
from Apps.payouts.models import PayoutBatch, PayoutMethod, WithdrawalRequest
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry

logger = logging.getLogger(__name__)

S = WithdrawalRequest.Status


class PayoutError(DomainError):
    """Expected, user-facing payout errors (mapped to HTTP 400)."""


class DuplicatePayoutAccount(PayoutError):
    """The payout account is connected to another Nibbl account (Master:
    restriction message with a Request Review button)."""

    code = "duplicate_payout_account"


DUPLICATE_PAYOUT_FLAG = "Duplicate payout account"


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
            detail=f"{DUPLICATE_PAYOUT_FLAG} attempted: {provider}:{handle}",
        )
        raise DuplicatePayoutAccount(
            "This payout account is already connected to another Nibbl account. "
            "You can request a review if you believe this is an error."
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



def request_duplicate_review(*, user, provider, handle) -> int:
    """Shopper asks Nibbl to review a payout account that's connected to
    another account. Both accounts' open withdrawals — and any new ones until
    Admin clears the flag — go to Manual Review. Returns accounts flagged."""
    from Apps.receipts.models import FraudFlag

    handle = (handle or "").strip()
    other = PayoutMethod.objects.filter(provider=provider, handle__iexact=handle).exclude(user=user).first()
    if other is None:
        raise PayoutError("There's no conflicting payout account to review.")
    detail = f"{DUPLICATE_PAYOUT_FLAG} — review requested: {provider}:{handle}"
    users = [user, other.user]
    for account in users:
        FraudFlag.objects.create(user=account, reason=FraudFlag.Reason.MANUAL, detail=detail)
    WithdrawalRequest.objects.filter(user__in=users, status__in=[S.PENDING, S.APPROVED]).update(
        needs_review=True, admin_note=detail,
    )
    return len(users)


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

    from Apps.accounts.risk import risk_reasons

    # Device / network risk (Master #51) also routes to Manual Review; the
    # reason is admin-only.
    device_risk = risk_reasons(user)
    from Apps.receipts.models import FraudFlag

    if FraudFlag.objects.filter(user=user, detail__contains=f"{DUPLICATE_PAYOUT_FLAG} — review requested").exists():
        device_risk.append("Duplicate payout account under review.")
    needs_review = _withdrawal_needs_review(user, amount) or bool(device_risk)
    # Master: safe requests enter Ready for Batch automatically (approved);
    # only requests matching a review rule wait in Manual Review.
    withdrawal = WithdrawalRequest.objects.create(
        user=user, payout_method=method, provider=method.provider,
        handle=method.handle, amount=amount, status=S.PENDING if needs_review else S.APPROVED,
        needs_review=needs_review,
        admin_note=" ".join(device_risk),
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


def _audit(withdrawal: WithdrawalRequest, admin, event: str, before: str, **meta) -> None:
    """Master: every withdrawal decision logs the admin, time, reason and
    before/after status."""
    AuditLog.objects.create(
        actor_type="admin", actor_id=str(admin.id) if admin else "", action=AuditLog.Action.UPDATE,
        target_type="withdrawal", target_id=str(withdrawal.id),
        metadata={"event": event, "before": before, "after": withdrawal.status, **meta},
    )


def approve_withdrawal(*, withdrawal, admin) -> WithdrawalRequest:
    _require_status(withdrawal, {S.PENDING, S.FLAGGED})
    before = withdrawal.status
    withdrawal.status = S.APPROVED
    _stamp(withdrawal, admin)
    withdrawal.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
    _audit(withdrawal, admin, "withdrawal_approved", before)
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
    before = withdrawal.status
    if withdrawal.hold_id and withdrawal.hold.status == Hold.Status.ACTIVE:
        wallet_services.release_hold(hold=withdrawal.hold)
    withdrawal.status = S.REJECTED
    if reason:
        withdrawal.admin_note = reason
        withdrawal.decision_reason = reason
    _stamp(withdrawal, admin)
    withdrawal.save(
        update_fields=["status", "admin_note", "decision_reason", "reviewed_by", "reviewed_at", "updated_at"]
    )
    _audit(withdrawal, admin, "withdrawal_rejected", before, reason=reason)
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


# ---------------------------------------------------------------------------
# PayPal file + imported results (Master Admin Sheet 1 — Withdrawals)
# ---------------------------------------------------------------------------
PAYPAL_FILE_HEADER = ["Email/Phone", "Amount", "Currency code", "Reference ID", "Note to recipient", "Recipient wallet"]


def paypal_file_rows(batch: PayoutBatch) -> list[list[str]]:
    """PayPal Payouts bulk-upload rows. ``Reference ID`` is our internal
    Withdrawal ID — the key PayPal's results are matched back on."""
    rows = []
    for w in batch.withdrawals.all().order_by("created_at"):
        rows.append([
            w.handle, str(w.amount), "USD", str(w.id), "Your Nibbl rewards",
            "Venmo" if w.provider == "venmo" else "PayPal",
        ])
    if batch.status == PayoutBatch.Status.CREATED:
        batch.status = PayoutBatch.Status.EXPORTED
        batch.exported_at = timezone.now()
        batch.save(update_fields=["status", "exported_at", "updated_at"])
    return rows


# PayPal payout item statuses → our outcome.
PAID_STATUSES = {"SUCCESS", "SUCCEEDED", "SUCCESSFUL", "COMPLETED", "PAID", "CLAIMED"}
STILL_PROCESSING = {"PENDING", "UNCLAIMED", "ONHOLD", "ON HOLD", "PROCESSING", "NEW"}
PERMANENT_FAILURES = {"RETURNED", "REFUNDED", "REVERSED", "BLOCKED", "DENIED", "CANCELED", "CANCELLED"}

_ID_COLUMNS = ("reference id", "sender item id", "sender_item_id", "withdrawal id", "withdrawal_id", "custom id")
_STATUS_COLUMNS = ("transaction status", "status", "payout item status", "transaction_status")
_REASON_COLUMNS = ("failure reason", "error", "errors", "reason", "error message")
_TXN_COLUMNS = ("transaction id", "paypal transaction id", "payout item id", "transaction_id")


def _pick(row: dict, names) -> str:
    for name in names:
        if name in row and str(row[name]).strip():
            return str(row[name]).strip()
    return ""


def _fail(withdrawal, *, admin, reason: str, permanent: bool, before: str) -> None:
    withdrawal.status = S.FAILED
    withdrawal.failure_reason = (reason or "PayPal could not complete this payment.")[:255]
    withdrawal.failure_permanent = permanent
    if permanent and withdrawal.hold_id and withdrawal.hold.status == Hold.Status.ACTIVE:
        wallet_services.release_hold(hold=withdrawal.hold)
    _stamp(withdrawal, admin)
    withdrawal.save(update_fields=["status", "failure_reason", "failure_permanent", "reviewed_by", "reviewed_at",
                                   "updated_at"])
    _audit(withdrawal, admin, "payout_failed", before, reason=withdrawal.failure_reason, permanent=permanent)


@transaction.atomic
def import_paypal_results(rows: list[dict], *, admin) -> dict:
    """Apply a PayPal Payouts results file. Rows match on the internal
    Withdrawal ID; partial success is supported and re-importing the same
    file changes nothing (no duplicate wallet or ledger activity)."""
    summary = {"paid": 0, "failed": 0, "still_processing": 0, "already_recorded": 0, "unmatched": []}
    touched_batches = set()
    for raw in rows:
        row = {str(k).strip().lower(): v for k, v in raw.items() if k is not None}
        ref = _pick(row, _ID_COLUMNS)
        status = _pick(row, _STATUS_COLUMNS).upper()
        if not ref:
            continue
        withdrawal = (
            WithdrawalRequest.objects.select_related("hold").filter(id=ref).first()
            if _looks_like_uuid(ref) else None
        )
        if withdrawal is None:
            summary["unmatched"].append(ref)
            continue
        if withdrawal.batch_id:
            touched_batches.add(withdrawal.batch_id)
        before = withdrawal.status
        if status in PAID_STATUSES:
            if withdrawal.status == S.PAID:
                summary["already_recorded"] += 1
                continue
            if withdrawal.status not in (S.PROCESSING, S.FAILED) or (
                withdrawal.status == S.FAILED and withdrawal.failure_permanent
            ):
                summary["unmatched"].append(ref)
                continue
            withdrawal.status = S.PROCESSING  # mark_paid accepts processing
            mark_paid(withdrawal=withdrawal, admin=admin)
            withdrawal.paypal_transaction_id = _pick(row, _TXN_COLUMNS)[:64]
            withdrawal.failure_reason, withdrawal.failure_permanent = "", False
            withdrawal.save(update_fields=["paypal_transaction_id", "failure_reason", "failure_permanent", "updated_at"])
            _audit(withdrawal, admin, "payout_paid", before, transaction_id=withdrawal.paypal_transaction_id)
            summary["paid"] += 1
        elif status in STILL_PROCESSING or not status:
            summary["still_processing"] += 1
        else:
            permanent = status in PERMANENT_FAILURES
            if withdrawal.status == S.FAILED and (withdrawal.failure_permanent or not permanent):
                summary["already_recorded"] += 1
                continue
            if withdrawal.status not in (S.PROCESSING, S.FAILED):
                summary["unmatched"].append(ref)
                continue
            reason = _pick(row, _REASON_COLUMNS) or status.title()
            _fail(withdrawal, admin=admin, reason=reason, permanent=permanent, before=before)
            summary["failed"] += 1

    for batch in PayoutBatch.objects.filter(id__in=touched_batches):
        if not batch.withdrawals.filter(status=S.PROCESSING).exists() and batch.status != PayoutBatch.Status.COMPLETED:
            batch.status = PayoutBatch.Status.COMPLETED
            batch.save(update_fields=["status", "updated_at"])
    return summary


def _looks_like_uuid(value: str) -> bool:
    import uuid

    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


@transaction.atomic
def retry_failed(*, withdrawal, admin) -> WithdrawalRequest:
    """A retryable failure goes back to Ready for Batch (still reserved)."""
    if withdrawal.status != S.FAILED or withdrawal.failure_permanent:
        raise PayoutError("Only a retryable failed payout can be retried.")
    if not (withdrawal.hold_id and withdrawal.hold.status == Hold.Status.ACTIVE):
        raise PayoutError("The withdrawal's hold is unavailable.")
    before = withdrawal.status
    withdrawal.status = S.APPROVED
    withdrawal.batch = None
    _stamp(withdrawal, admin)
    withdrawal.save(update_fields=["status", "batch", "reviewed_by", "reviewed_at", "updated_at"])
    _audit(withdrawal, admin, "payout_retry", before, reason=withdrawal.failure_reason)
    return withdrawal


@transaction.atomic
def return_failed_funds(*, withdrawal, admin) -> WithdrawalRequest:
    """Mark a failed payout permanent: the amount returns to the balance."""
    if withdrawal.status != S.FAILED or withdrawal.failure_permanent:
        raise PayoutError("Only a retryable failed payout can be closed.")
    _fail(withdrawal, admin=admin, reason=withdrawal.failure_reason, permanent=True, before=withdrawal.status)
    return withdrawal
