"""Notification dispatch + reminder/re-engagement generators.

`notify()` is the single entry point: it renders the template for the event
type, records a Notification, suppresses it if the user opted out, and pushes
to the user's devices. Generators scan other apps' state (read-only) and call
notify(); they dedupe so the same nudge isn't repeated within a window.
"""

from __future__ import annotations

import datetime as dt

from django.conf import settings
from django.utils import timezone

from Apps.notifications import push
from Apps.notifications.models import (
    Notification,
    NotificationPreference,
    NotificationTemplate,
    NotificationType,
)


class _SafeDict(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def _render(template_text: str, context: dict) -> str:
    return template_text.format_map(_SafeDict(context or {}))


def get_preference(user) -> NotificationPreference:
    pref, _ = NotificationPreference.objects.get_or_create(user=user)
    return pref


def notify(*, user, notification_type, context=None, reference_type="", reference_id="") -> Notification:
    context = context or {}
    template = NotificationTemplate.objects.filter(
        type=notification_type, is_active=True
    ).first()
    if template:
        title = _render(template.title, context)
        body = _render(template.body, context)
    else:
        title, body = NotificationType(notification_type).label, ""

    pref = get_preference(user)
    allowed = pref.allows(notification_type)

    notification = Notification.objects.create(
        user=user,
        type=notification_type,
        title=title,
        body=body,
        data=context,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id else "",
        status=Notification.Status.PENDING,
    )

    if not allowed:
        notification.status = Notification.Status.SUPPRESSED
        notification.save(update_fields=["status", "updated_at"])
        return notification

    tokens = list(
        user.device_tokens.filter(is_active=True).values_list("token", flat=True)
    )
    push.send_push(tokens=tokens, title=title, body=body, data=context)
    notification.status = Notification.Status.SENT
    notification.sent_at = timezone.now()
    notification.save(update_fields=["status", "sent_at", "updated_at"])
    return notification


# ---------------------------------------------------------------------------
# Dedupe helper
# ---------------------------------------------------------------------------
def _recently_notified(user, notification_type, *, reference_id="", hours=None) -> bool:
    hours = settings.NOTIFY_DEDUPE_HOURS if hours is None else hours
    cutoff = timezone.now() - dt.timedelta(hours=hours)
    qs = Notification.objects.filter(
        user=user, type=notification_type, created_at__gte=cutoff
    )
    if reference_id:
        qs = qs.filter(reference_id=str(reference_id))
    return qs.exists()


# ---------------------------------------------------------------------------
# Reminder / re-engagement generators
# ---------------------------------------------------------------------------
def generate_receipt_reminders() -> int:
    from Apps.receipts.models import Receipt
    from Apps.reservations.models import Reservation

    cutoff = timezone.now() - dt.timedelta(
        hours=settings.NOTIFY_RECEIPT_REMINDER_AFTER_HOURS
    )
    stale = (
        Reservation.objects.filter(
            status=Reservation.Status.ACTIVE,
            kind=Reservation.Kind.REBATE,
            created_at__lte=cutoff,
        )
        .select_related("user", "campaign", "campaign__brand")
    )
    sent = 0
    for reservation in stale:
        if reservation.receipts.exclude(status=Receipt.Status.REJECTED).exists():
            continue
        if _recently_notified(
            reservation.user, NotificationType.RECEIPT_REMINDER, reference_id=reservation.id
        ):
            continue
        notify(
            user=reservation.user,
            notification_type=NotificationType.RECEIPT_REMINDER,
            context={"brand": reservation.campaign.brand.name},
            reference_type="reservation",
            reference_id=reservation.id,
        )
        sent += 1
    return sent


def generate_review_notifications() -> int:
    """REWARDS_WAITING for fresh opportunities; REVIEW_REMINDER for aging ones."""
    from Apps.reviews.models import ReviewSession

    now = timezone.now()
    age_cutoff = now - dt.timedelta(hours=settings.NOTIFY_REVIEW_REMINDER_AFTER_HOURS)
    sessions = ReviewSession.objects.filter(
        status=ReviewSession.Status.ACTIVE, expires_at__gt=now
    ).select_related("user", "product")

    sent = 0
    for session in sessions:
        is_aging = session.created_at <= age_cutoff
        ntype = (
            NotificationType.REVIEW_REMINDER if is_aging
            else NotificationType.REWARDS_WAITING
        )
        if _recently_notified(session.user, ntype, reference_id=session.id):
            continue
        notify(
            user=session.user,
            notification_type=ntype,
            context={
                "product": session.product.name,
                "amount": str(session.reward_amount),
            },
            reference_type="review_session",
            reference_id=session.id,
        )
        sent += 1
    return sent


def generate_inactivity_reminders() -> int:
    from Apps.accounts.models import User

    cutoff = timezone.now() - dt.timedelta(days=settings.NOTIFY_INACTIVE_AFTER_DAYS)
    inactive = User.objects.filter(
        is_active=True, is_deleted=False, last_login__lt=cutoff
    )
    sent = 0
    for user in inactive:
        if _recently_notified(
            user, NotificationType.INACTIVE,
            hours=settings.NOTIFY_INACTIVE_AFTER_DAYS * 24,
        ):
            continue
        notify(user=user, notification_type=NotificationType.INACTIVE)
        sent += 1
    return sent


def generate_new_offer_notifications() -> int:
    """Notify users about active offers for brands/products they bookmarked."""
    from Apps.campaigns.models import Campaign
    from Apps.offers.models import Bookmark

    dedupe_hours = settings.NOTIFY_NEW_OFFER_DEDUPE_DAYS * 24
    active = Campaign.objects.filter(
        status=Campaign.Status.ACTIVE, brand__status="active"
    ).select_related("brand").prefetch_related("products")

    sent = 0
    for campaign in active:
        bookmarkers = (
            Bookmark.objects.filter(brand=campaign.brand)
            | Bookmark.objects.filter(product__in=campaign.products.all())
        )
        for bookmark in bookmarkers.select_related("user").distinct():
            user = bookmark.user
            if _recently_notified(
                user, NotificationType.NEW_OFFERS,
                reference_id=campaign.id, hours=dedupe_hours,
            ):
                continue
            notify(
                user=user,
                notification_type=NotificationType.NEW_OFFERS,
                context={"brand": campaign.brand.name},
                reference_type="campaign",
                reference_id=campaign.id,
            )
            sent += 1
    return sent


def run_all_generators() -> dict:
    return {
        "receipt_reminders": generate_receipt_reminders(),
        "review_notifications": generate_review_notifications(),
        "inactivity": generate_inactivity_reminders(),
        "new_offers": generate_new_offer_notifications(),
    }
