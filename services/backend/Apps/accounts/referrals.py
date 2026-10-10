"""Referral qualification (Master: Refer a Friend; Admin Referrals).

A referral reward is earned only after the new shopper:
  1. joins through the referral link,
  2. claims an offer,
  3. completes an approved redemption,
  4. connects a payout method,
  5. completes any successful withdrawal (it needn't include the reward).

Progress is recomputed whenever one of those things happens. Once all five
are done the Referral Flag Rules (Admin Settings) run: a clean referral is
paid to the referrer's wallet; otherwise it's flagged for Admin, who may
approve, reject (with a customer-facing reason) or suspend the shopper.
Referral rewards then follow the normal Wallet / withdrawal rules.
"""

from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from Apps.accounts.models import Referral, User
from Apps.common.models import AuditLog, get_platform_settings
from Apps.common.money import ZERO, to_money

STEPS = [
    ("joined", "Joined through the referral link"),
    ("claimed", "Claimed an offer"),
    ("redeemed", "Completed an approved redemption"),
    ("payout_connected", "Connected a payout method"),
    ("withdrawn", "Completed a withdrawal"),
]


class ReferralError(Exception):
    """Expected, user-facing errors (HTTP 400)."""


def start(user, *, campaign_id=None) -> Referral | None:
    """Called when a referred shopper verifies their email (step 1)."""
    if user.referred_by_id is None or not get_platform_settings().referrals_enabled:
        return None
    from Apps.campaigns.models import Campaign

    campaign = Campaign.objects.filter(id=campaign_id).first() if campaign_id else None
    referral, _ = Referral.objects.get_or_create(
        referred=user, defaults={"referrer_id": user.referred_by_id, "campaign": campaign},
    )
    return referral


def _completed_steps(user) -> dict:
    from Apps.payouts.models import PayoutMethod, WithdrawalRequest
    from Apps.rebates.models import Redemption
    from Apps.reservations.models import Reservation

    def first(qs, field="created_at"):
        return qs.order_by(field).values_list(field, flat=True).first()

    return {
        "claimed_at": first(Reservation.objects.filter(user=user)),
        "redeemed_at": first(Redemption.objects.filter(user=user)),
        "payout_connected_at": first(
            PayoutMethod.objects.filter(user=user, review_status=PayoutMethod.ReviewStatus.APPROVED)
        ),
        "withdrawn_at": first(
            WithdrawalRequest.objects.filter(user=user, status=WithdrawalRequest.Status.PAID), "paid_at"
        ),
    }


def protection_flags(referral: Referral) -> list[str]:
    """Referral Flag Rules (each can be switched off in Admin Settings)."""
    from Apps.accounts.risk import risk_reasons, shared_with
    from Apps.receipts.models import FraudFlag

    cfg = get_platform_settings()
    reasons = []
    shared = shared_with(referral.referred, referral.referrer)
    if cfg.referral_flag_shared_device and shared["device"]:
        reasons.append("The new shopper and the referrer used the same device.")
    if cfg.referral_flag_shared_network and shared["network"]:
        reasons.append("The new shopper and the referrer used the same network.")
    if cfg.referral_flag_fraud_signals:
        users = (referral.referred, referral.referrer)
        if FraudFlag.objects.filter(user__in=users).exists():
            reasons.append("Fraud signals on the new shopper's or referrer's account.")
        for user in users:
            reasons.extend(risk_reasons(user))
    return list(dict.fromkeys(reasons))


@transaction.atomic
def _pay(referral: Referral, *, actor=None) -> Referral:
    from Apps.wallets import services as wallet_services
    from Apps.wallets.models import LedgerEntry

    amount = to_money(settings.REFERRAL_BONUS_AMOUNT)
    if amount > ZERO:
        wallet_services.credit(
            wallet=wallet_services.get_or_create_customer_wallet(referral.referrer), amount=amount,
            category=LedgerEntry.Category.REFERRAL_BONUS, reference_type="user",
            reference_id=referral.referred_id, description="Referral bonus",
            # Same key as the old on-signup bonus, so nobody is paid twice.
            idempotency_key=f"referral-bonus:{referral.referred_id}",
        )
    referral.status = Referral.Status.PAID
    referral.reward_amount = amount
    referral.paid_at = timezone.now()
    if actor is not None:
        referral.reviewed_by, referral.reviewed_at = actor, timezone.now()
    referral.save()
    return referral


def refresh(user) -> Referral | None:
    """Record newly completed steps; on qualification flag or pay."""
    referral = Referral.objects.filter(referred=user).select_related("referrer", "referred").first()
    if referral is None or referral.status != Referral.Status.IN_PROGRESS:
        return referral
    changed = []
    for field, value in _completed_steps(user).items():
        if value and getattr(referral, field) is None:
            setattr(referral, field, value)
            changed.append(field)
    if changed:
        referral.save(update_fields=[*changed, "updated_at"])
    if all(getattr(referral, f) for f in ("claimed_at", "redeemed_at", "payout_connected_at", "withdrawn_at")):
        referral.qualified_at = timezone.now()
        flags = protection_flags(referral)
        if flags:
            referral.status = Referral.Status.FLAGGED
            referral.flag_reason = " ".join(flags)
            referral.save(update_fields=["qualified_at", "status", "flag_reason", "updated_at"])
        else:
            referral.save(update_fields=["qualified_at", "updated_at"])
            _pay(referral)
    return referral


def refresh_later(user_id) -> None:
    """Refresh after the current transaction commits (signal hooks)."""
    def run():
        user = User.objects.filter(id=user_id).first()
        if user is not None:
            refresh(user)

    transaction.on_commit(run)


def steps(referral: Referral) -> list[dict]:
    done = {
        "joined": referral.created_at, "claimed": referral.claimed_at, "redeemed": referral.redeemed_at,
        "payout_connected": referral.payout_connected_at, "withdrawn": referral.withdrawn_at,
    }
    return [{"key": key, "label": label, "done": bool(done[key]), "at": done[key]} for key, label in STEPS]


def _audit(referral, admin, event, **meta) -> None:
    AuditLog.objects.create(
        action=AuditLog.Action.UPDATE, actor_type="admin", actor_id=str(admin.id),
        target_type="referral", target_id=str(referral.id), metadata={"event": event, **meta},
    )


def approve(referral: Referral, *, admin) -> Referral:
    if referral.status not in (Referral.Status.FLAGGED, Referral.Status.REJECTED):
        raise ReferralError("Only a flagged or rejected referral can be approved.")
    _pay(referral, actor=admin)
    _audit(referral, admin, "referral_approved")
    return referral


def reject(referral: Referral, *, admin, reason: str) -> Referral:
    reason = (reason or "").strip()
    if not reason:
        raise ReferralError("Enter a reason the shopper will see.")
    if referral.status == Referral.Status.PAID:
        raise ReferralError("This referral reward was already paid.")
    referral.status = Referral.Status.REJECTED
    referral.decision_reason = reason[:2000]
    referral.reviewed_by, referral.reviewed_at = admin, timezone.now()
    referral.save()
    _audit(referral, admin, "referral_rejected", reason=reason)
    return referral


def suspend(referral: Referral, *, admin, target: str, reason: str) -> Referral:
    """Suspend the new shopper or the referrer, and reject the reward."""
    from Apps.admin_panel import services as admin_services

    user = referral.referred if target == "referred" else referral.referrer if target == "referrer" else None
    if user is None:
        raise ReferralError("Choose who to suspend.")
    if user.is_active:
        admin_services.suspend_user(user=user, admin=admin, reason=reason or "Referral abuse")
    if referral.status != Referral.Status.PAID:
        reject(referral, admin=admin, reason=reason or "This referral didn't meet the program rules.")
    return referral
