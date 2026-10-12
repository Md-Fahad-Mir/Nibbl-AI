"""Event notifications (Master: Notifications and Reminders; Settings §3).

Shopper — sent immediately, in-app (plus push once FCM is live); approval and
rejection are also emailed:
  reservation confirmation · receipt submitted / manual review · approval ·
  rejection · claim expiration.

Brand team — through ``notify_brand`` (in-app always, email / SMS per each
member's own preferences):
  wallet below 25% · campaign paused · campaign exhausted early ·
  weekly performance summary (new negative review + auto-refill failed are
  sent where those events happen).

Every sender runs after the surrounding transaction commits and never breaks
the action that triggered it.
"""

from __future__ import annotations

import datetime as dt
import logging
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from Apps.notifications import services
from Apps.notifications.models import Notification, NotificationType

logger = logging.getLogger(__name__)
T = NotificationType


def _when(value) -> str:
    return f"{value:%b %d, %Y at %H:%M} UTC" if value else ""


def _offer(campaign) -> str:
    return campaign.offer_headline or f"{campaign.brand.name} offer"


def _email(user, subject: str, body: str) -> None:
    try:
        send_mail(f"Nibbl · {subject}", body, settings.DEFAULT_FROM_EMAIL, [user.email])
    except Exception as exc:  # delivery problems never break the action
        logger.error("Shopper email to %s failed: %s", user.email, exc)


def _shopper(user, notification_type, *, title: str, body: str, reference_type="", reference_id="",
             email: bool = False) -> None:
    def deliver():
        try:
            services.notify(user=user, notification_type=notification_type, title=title, body=body[:500],
                            reference_type=reference_type, reference_id=reference_id)
        except Exception as exc:
            logger.error("Shopper notification %s failed: %s", notification_type, exc)
        if email:
            _email(user, title, f"{body}\n\nOpen Nibbl to see your claim: "
                               f"{str(settings.PUBLIC_BASE_URL).rstrip('/')}/?tab=scan")

    transaction.on_commit(deliver)


# --- Shopper ---------------------------------------------------------------
def claim_reserved(reservation) -> None:
    _shopper(
        reservation.user, T.CLAIM_RESERVED, title="Offer reserved",
        body=(f"You reserved {_offer(reservation.campaign)}. Buy the product and submit your receipt by "
              f"{_when(reservation.expires_at)}."),
        reference_type="reservation", reference_id=reservation.id,
    )


def receipt_submitted(receipt) -> None:
    _shopper(
        receipt.user, T.RECEIPT_SUBMITTED, title="Receipt submitted",
        body=("We need a person to verify part of your receipt. You'll receive a response within 7 days. "
              "Your claim stays active and its slot stays occupied."),
        reference_type="receipt", reference_id=receipt.id,
    )


def receipt_approved(receipt, reward: Decimal | None) -> None:
    amount = f"${reward:.2f} " if reward else ""
    _shopper(
        receipt.user, T.RECEIPT_APPROVED, title="Purchase verified",
        body=(f"Your receipt for {_offer(receipt.campaign)} was approved. {amount}was added to your Nibbl Wallet "
              "and your claim slot was released."),
        reference_type="receipt", reference_id=receipt.id, email=True,
    )


def receipt_rejected(reservation, *, reason: str, final: bool, reference_id="") -> None:
    if final:
        body = (f"Your receipt for {_offer(reservation.campaign)} was not approved: {reason} "
                "Your claim is now closed and its slot was released.")
    else:
        body = (f"Your receipt for {_offer(reservation.campaign)} was not approved: {reason} "
                f"You can submit one different receipt before {_when(reservation.expires_at)}.")
    _shopper(
        reservation.user, T.RECEIPT_REJECTED, title="Receipt not approved", body=body,
        reference_type="reservation", reference_id=reference_id or reservation.id, email=True,
    )


def claim_expired(reservation) -> None:
    _shopper(
        reservation.user, T.CLAIM_EXPIRED, title="Claim expired",
        body=(f"Your claim for {_offer(reservation.campaign)} expired before a receipt was submitted. "
              "Its slot is free for another offer."),
        reference_type="reservation", reference_id=reservation.id,
    )


# --- Brand -----------------------------------------------------------------
def campaign_paused(campaign, *, reason: str) -> None:
    from Apps.notifications.brand import notify_brand

    notify_brand(campaign.brand, T.CAMPAIGN_PAUSED,
                 message=f"Your campaign \"{campaign.name}\" was paused: {reason}",
                 reference_type="campaign", reference_id=campaign.id)


def campaign_exhausted_early(campaign, *, hours: float) -> None:
    from Apps.notifications.brand import notify_brand

    notify_brand(campaign.brand, T.CAMPAIGN_EXHAUSTED,
                 message=(f"\"{campaign.name}\" used its full 25-hour claim capacity in {hours:.1f} hours. "
                          "Consider raising the limit about 25% so shoppers can keep claiming."),
                 reference_type="campaign", reference_id=campaign.id)


def _sent_recently(brand, notification_type, hours: float) -> bool:
    from Apps.brands.models import BrandMembership

    user_ids = BrandMembership.objects.filter(brand=brand, is_active=True).values_list("user_id", flat=True)
    return Notification.objects.filter(
        user_id__in=user_ids, type=notification_type, reference_type="brand", reference_id=str(brand.id),
        created_at__gte=timezone.now() - dt.timedelta(hours=hours),
    ).exists()


def generate_wallet_low_alerts() -> int:
    """Available Funds below 25% of the estimated 7-day requirement — at most
    once a day per brand (cron)."""
    from Apps.billing.services import AUTO_REFILL_TRIGGER_FRACTION, estimate_seven_day_requirement
    from Apps.brands.models import Brand
    from Apps.notifications.brand import notify_brand
    from Apps.wallets.services import get_or_create_brand_wallet

    sent = 0
    for brand in Brand.objects.filter(campaigns__status="active").distinct():
        need = estimate_seven_day_requirement(brand)
        if need <= 0:
            continue
        available = get_or_create_brand_wallet(brand).reward_available()
        if available >= need * AUTO_REFILL_TRIGGER_FRACTION or _sent_recently(brand, T.WALLET_LOW, 24):
            continue
        notify_brand(brand, T.WALLET_LOW,
                     message=(f"Available Funds are ${available:.2f} — below 25% of your estimated 7-day "
                              f"requirement (${need:.2f}). Add funds so new claims aren't paused at $0."),
                     reference_type="brand", reference_id=brand.id)
        sent += 1
    return sent


def generate_weekly_summaries(now=None) -> int:
    """Weekly performance summary, sent on Mondays (once a week per brand)."""
    from Apps.analytics.dashboard import brand_dashboard
    from Apps.brands.models import Brand
    from Apps.notifications.brand import notify_brand

    now = now or timezone.now()
    if now.weekday() != 0:
        return 0
    sent = 0
    for brand in Brand.objects.filter(status=Brand.Status.ACTIVE):
        if not brand.campaigns.exists() or _sent_recently(brand, T.WEEKLY_SUMMARY, 6 * 24):
            continue
        d = brand_dashboard(brand, 7, now=now)
        r, v = d["rebates"], d["reviews"]
        notify_brand(brand, T.WEEKLY_SUMMARY,
                     message=(f"Last 7 days — rebates: {r['claims']} claims, {r['redemptions']} redemptions, "
                              f"${r['total_brand_cost']} total brand cost. Reviews: {v['completed']} completed, "
                              f"${v['total_brand_cost']} total brand cost. Available Funds: ${d['available_funds']}."),
                     reference_type="brand", reference_id=brand.id)
        sent += 1
    return sent
