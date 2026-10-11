"""Brand refund requests (Master Wallet: "Request Refund").

Only Available Cash can be refunded — never Reserved Funds or Promotional
Credits. A brand has at most one pending request. Nibbl approves by returning
the money through Stripe and marking the request refunded, which debits the
wallet; a rejection leaves the wallet untouched."""

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from Apps.common.exceptions import DomainError
from Apps.common.models import AuditLog
from Apps.common.money import ZERO, to_money
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry, RefundRequest


class RefundError(DomainError):
    """Expected, user-facing refund errors (HTTP 400)."""


def refundable(wallet) -> Decimal:
    """Available Cash: real money not reserved for claims or reviews."""
    return max(to_money(wallet.reward_available()), ZERO)


def _audit(refund, action, actor, **meta):
    AuditLog.objects.create(
        action=action, actor_type="admin" if getattr(actor, "is_platform_admin", False) else "brand_user",
        actor_id=str(actor.id) if actor else "", target_type="refund_request", target_id=str(refund.id),
        metadata={"amount": str(refund.amount), **meta},
    )


def request_refund(brand, *, amount, reason: str, user) -> RefundRequest:
    try:
        amount = to_money(Decimal(str(amount)))
    except (InvalidOperation, ValueError):
        raise RefundError("Enter a valid amount.")
    if amount <= ZERO:
        raise RefundError("Enter an amount greater than $0.")
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    if RefundRequest.objects.filter(brand=brand, status=RefundRequest.Status.PENDING).exists():
        raise RefundError("You already have a refund request being reviewed.")
    available = refundable(wallet)
    if amount > available:
        raise RefundError(f"You can request up to ${available} — your Available Cash.")
    refund = RefundRequest.objects.create(
        brand=brand, wallet=wallet, amount=amount, reason=(reason or "").strip()[:1000], requested_by=user,
    )
    _audit(refund, AuditLog.Action.CREATE, user, event="refund_requested")
    return refund


@transaction.atomic
def mark_refunded(refund: RefundRequest, *, admin, reference: str = "", note: str = "") -> RefundRequest:
    refund = RefundRequest.objects.select_for_update().get(pk=refund.pk)
    if refund.status != RefundRequest.Status.PENDING:
        raise RefundError("This request has already been decided.")
    if refund.amount > refundable(refund.wallet):
        raise RefundError("The brand's Available Cash is now lower than this request. Reject it and ask for a new one.")
    wallet_services.debit(
        wallet=refund.wallet, amount=refund.amount, category=LedgerEntry.Category.REFUND, real_only=True,
        reference_type="refund_request", reference_id=str(refund.id),
        description="Refund of Available Cash", idempotency_key=f"refund:{refund.id}",
    )
    refund.status = RefundRequest.Status.REFUNDED
    refund.decided_by, refund.decided_at = admin, timezone.now()
    refund.stripe_reference, refund.decision_note = (reference or "").strip()[:100], (note or "").strip()[:1000]
    refund.save(update_fields=["status", "decided_by", "decided_at", "stripe_reference", "decision_note", "updated_at"])
    _audit(refund, AuditLog.Action.APPROVE, admin, event="refund_paid", reference=refund.stripe_reference)
    return refund


def reject(refund: RefundRequest, *, admin, note: str) -> RefundRequest:
    if refund.status != RefundRequest.Status.PENDING:
        raise RefundError("This request has already been decided.")
    if not (note or "").strip():
        raise RefundError("Enter the reason shown to the brand.")
    refund.status = RefundRequest.Status.REJECTED
    refund.decided_by, refund.decided_at, refund.decision_note = admin, timezone.now(), note.strip()[:1000]
    refund.save(update_fields=["status", "decided_by", "decided_at", "decision_note", "updated_at"])
    _audit(refund, AuditLog.Action.REJECT, admin, event="refund_rejected", note=refund.decision_note)
    return refund


def row(refund: RefundRequest) -> dict:
    return {
        "id": str(refund.id),
        "brand_id": str(refund.brand_id),
        "brand_name": refund.brand.name,
        "amount": str(refund.amount),
        "reason": refund.reason,
        "status": refund.status,
        "requested_by": refund.requested_by.email if refund.requested_by_id else "",
        "created_at": refund.created_at,
        "decided_at": refund.decided_at,
        "decision_note": refund.decision_note,
        "stripe_reference": refund.stripe_reference,
    }
