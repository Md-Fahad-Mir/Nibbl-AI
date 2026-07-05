"""Platform-admin actions. Every sensitive action writes an AuditLog entry."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.common.exceptions import DomainError
from Apps.common.models import AuditLog
from Apps.common.money import ZERO, to_money
from Apps.notifications import services as notification_services
from Apps.notifications.models import NotificationType
from Apps.reviews import services as review_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class AdminError(DomainError):
    """Expected, user-facing admin errors (mapped to HTTP 400)."""


def _audit(*, admin, action, target_type, target_id, metadata=None):
    AuditLog.objects.create(
        action=action,
        actor_type="admin",
        actor_id=str(admin.id),
        target_type=target_type,
        target_id=str(target_id),
        metadata=metadata or {},
    )


# ---------------------------------------------------------------------------
# Promotional wallet credit
# ---------------------------------------------------------------------------
@transaction.atomic
def promo_credit(*, brand, amount, note, admin) -> LedgerEntry:
    amount = to_money(amount)
    if amount <= ZERO:
        raise AdminError("Credit amount must be positive.")
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    entry = wallet_services.credit(
        wallet=wallet, amount=amount,
        category=LedgerEntry.Category.ADJUSTMENT,
        reference_type="promo_credit", reference_id=brand.id,
        description=note or "Promotional credit",
    )
    _audit(
        admin=admin, action=AuditLog.Action.UPDATE,
        target_type="brand", target_id=brand.id,
        metadata={"event": "promo_credit", "amount": str(amount), "note": note},
    )
    return entry


@transaction.atomic
def credit_user_wallet(*, user, amount, note, admin) -> LedgerEntry:
    amount = to_money(amount)
    if amount <= ZERO:
        raise AdminError("Credit amount must be positive.")
    wallet = wallet_services.get_or_create_customer_wallet(user)
    entry = wallet_services.credit(
        wallet=wallet,
        amount=amount,
        category=LedgerEntry.Category.ADJUSTMENT,
        reference_type="admin_user_credit",
        reference_id=user.id,
        description=note or "Admin wallet credit",
    )
    _audit(
        admin=admin,
        action=AuditLog.Action.UPDATE,
        target_type="user",
        target_id=user.id,
        metadata={"event": "user_wallet_credit", "amount": str(amount), "note": note},
    )
    return entry


# ---------------------------------------------------------------------------
# Plan management
# ---------------------------------------------------------------------------
@transaction.atomic
def change_plan(*, brand, plan_slug, admin):
    plan = Plan.objects.filter(slug=plan_slug, is_active=True).first()
    if plan is None:
        raise AdminError("Plan not found.")
    old = brand.plan.slug if brand.plan else None
    brand.plan = plan
    brand.save(update_fields=["plan", "updated_at"])
    subscription = getattr(brand, "subscription", None)
    if subscription is not None:
        subscription.plan = plan
        subscription.save(update_fields=["plan", "updated_at"])
    _audit(
        admin=admin, action=AuditLog.Action.UPDATE,
        target_type="brand", target_id=brand.id,
        metadata={"event": "plan_change", "from": old, "to": plan.slug},
    )
    return brand


# ---------------------------------------------------------------------------
# User suspension / restriction
# ---------------------------------------------------------------------------
def suspend_user(*, user, admin, reason="") -> User:
    if not user.is_active:
        raise AdminError("User is already suspended.")
    user.is_active = False
    user.save(update_fields=["is_active", "updated_at"])
    _audit(
        admin=admin, action=AuditLog.Action.UPDATE,
        target_type="user", target_id=user.id,
        metadata={"event": "user_suspended", "reason": reason},
    )
    return user


def reactivate_user(*, user, admin) -> User:
    if user.is_active:
        raise AdminError("User is already active.")
    user.is_active = True
    user.save(update_fields=["is_active", "updated_at"])
    _audit(
        admin=admin, action=AuditLog.Action.UPDATE,
        target_type="user", target_id=user.id,
        metadata={"event": "user_reactivated"},
    )
    return user


# ---------------------------------------------------------------------------
# Platform review moderation
# ---------------------------------------------------------------------------
def remove_review(*, review, admin, reason="") -> None:
    review_services.remove_review(review=review, moderator=admin, reason=reason)
    _audit(
        admin=admin, action=AuditLog.Action.DELETE,
        target_type="review", target_id=review.id,
        metadata={"event": "review_removed_by_admin", "reason": reason},
    )


# ---------------------------------------------------------------------------
# Announcements (broadcast)
# ---------------------------------------------------------------------------
def broadcast(*, title, message, admin) -> int:
    sent = 0
    for user in User.objects.filter(is_active=True, is_deleted=False):
        notification_services.notify(
            user=user,
            notification_type=NotificationType.PROMOTIONAL,
            context={"title": title, "message": message},
        )
        sent += 1
    _audit(
        admin=admin, action=AuditLog.Action.OTHER,
        target_type="platform", target_id="broadcast",
        metadata={"event": "announcement", "title": title, "recipients": sent},
    )
    return sent
