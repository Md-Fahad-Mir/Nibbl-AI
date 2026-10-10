"""Brand team notifications (Master: Settings §3 Notifications).

* Each team member manages their own preferences, per brand.
* Every notification has a separate Email and SMS toggle; changing one
  member's preferences never affects another member.
* In-app notifications are always recorded.

SMS delivery: Nibbl's system SMS will go through Klaviyo (not integrated yet),
so an enabled SMS preference is stored and logged but not sent today.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction

from Apps.notifications import services
from Apps.notifications.models import BrandNotificationPreference, NotificationType

logger = logging.getLogger(__name__)

# The brand notifications, in display order. Defaults: email on, SMS off.
BRAND_NOTIFICATIONS = [
    (NotificationType.CAMPAIGN_REVIEW, "Campaign approval updates",
     "Nibbl approved, rejected or asked for changes to a campaign."),
    (NotificationType.RECEIPT_REVIEW_NEEDED, "Receipts waiting for your review",
     "A receipt needs your decision before its 7-day deadline."),
    (NotificationType.LOW_RATING_REVIEW, "Low-rating reviews to respond to",
     "A 1–3★ review is held for 7 days so you can respond or flag it."),
    (NotificationType.AUTO_REFILL_FAILED, "Wallet refill failed",
     "Your automatic refill payment didn't go through."),
]
BRAND_TYPES = {t for t, _l, _d in BRAND_NOTIFICATIONS}


def preferences(user, brand) -> list[dict]:
    saved = {
        p.notification_type: p
        for p in BrandNotificationPreference.objects.filter(user=user, brand=brand)
    }
    rows = []
    for notification_type, label, description in BRAND_NOTIFICATIONS:
        pref = saved.get(notification_type)
        rows.append({
            "type": notification_type.value, "label": label, "description": description,
            "email": pref.email if pref else True, "sms": pref.sms if pref else False,
        })
    return rows


def set_preferences(user, brand, rows: list[dict]) -> list[dict]:
    for row in rows:
        if row.get("type") not in BRAND_TYPES:
            continue
        BrandNotificationPreference.objects.update_or_create(
            user=user, brand=brand, notification_type=row["type"],
            defaults={"email": bool(row.get("email")), "sms": bool(row.get("sms"))},
        )
    return preferences(user, brand)


def _send_email(user, subject: str, body: str) -> None:
    try:
        send_mail(subject, body, getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@nibblai.app"), [user.email])
    except Exception as exc:  # delivery problems never break the action
        logger.error("Brand notification email to %s failed: %s", user.email, exc)


def notify_brand(brand, notification_type, *, message: str, context=None,
                 reference_type: str = "", reference_id="", roles=None) -> None:
    """Notify every active team member (optionally only ``roles``): in-app
    always, plus email / SMS per that member's own preferences. Delivery runs
    after the surrounding transaction commits."""
    from Apps.brands.models import BrandMembership

    members = BrandMembership.objects.filter(brand=brand, is_active=True).select_related("user")
    if roles:
        members = members.filter(role__in=roles)
    context = {**(context or {}), "brand": brand.name, "message": message}
    title = NotificationType(notification_type).label
    prefs = {
        (p.user_id, p.notification_type): p
        for p in BrandNotificationPreference.objects.filter(brand=brand, notification_type=notification_type)
    }

    def deliver():
        for membership in members:
            user = membership.user
            services.notify(user=user, notification_type=notification_type, context=context,
                            reference_type=reference_type, reference_id=reference_id)
            pref = prefs.get((user.id, str(notification_type)))
            if pref is None or pref.email:
                _send_email(user, f"NibblAI · {brand.name}: {title}", message)
            if pref is not None and pref.sms:
                logger.info("Brand SMS (pending Klaviyo) to user %s: %s", user.id, message)

    transaction.on_commit(deliver)
