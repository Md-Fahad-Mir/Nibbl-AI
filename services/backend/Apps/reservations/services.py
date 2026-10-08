"""Reservation business logic: claim (reserve) and expiry.

Concurrency: a claim locks the campaign row (SELECT ... FOR UPDATE on Postgres)
so the per-user, global-cap, and daily-budget checks are evaluated atomically;
the wallet hold additionally locks the wallet row. Lock order is always
campaign → wallet to avoid deadlocks.
"""

from __future__ import annotations

import datetime as dt

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from Apps.campaigns.models import Campaign
from Apps.common.money import ZERO, to_money
from Apps.offers.services import enter_cooldown, is_in_cooldown
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services


class ReservationError(Exception):
    """Expected, user-facing reservation errors (mapped to HTTP 400)."""


def _expiry_from(now):
    return now + dt.timedelta(days=settings.RESERVATION_EXPIRY_DAYS)


def claim_slots(user) -> dict:
    """A shopper's active-claim slot usage, for the '3 of 5' display."""
    limit = settings.ACTIVE_CLAIM_SLOTS
    used = Reservation.objects.filter(
        user=user, status=Reservation.Status.ACTIVE
    ).count()
    return {"used": used, "limit": limit, "available": max(limit - used, 0)}


def _lock_campaign(campaign_id):
    qs = Campaign.objects.select_related("brand", "fallback_offer")
    if connection.features.has_select_for_update:
        qs = qs.select_for_update(of=("self",))
    return qs.filter(id=campaign_id).first()


# ---------------------------------------------------------------------------
# Daily budget usage (computed by summing reservations)
# ---------------------------------------------------------------------------
def _reserved_today(campaign, *, tier=None):
    today = timezone.localdate()
    qs = Reservation.objects.filter(
        campaign=campaign,
        created_at__date=today,
        status__in=Reservation.BUDGET_CONSUMING,
    )
    qs = qs.filter(tier=tier) if tier is not None else qs
    total = ZERO
    for amount in qs.values_list("reward_amount", flat=True):
        total += amount
    return total


def _select_claimable_offer(campaign, user):
    """Pick the offer to reserve: waterfall premium tier (within daily budget)
    or the fallback offer (during cooldown / when premium is exhausted)."""
    in_cd = is_in_cooldown(user, campaign)
    daily = campaign.daily_budget
    total_today = _reserved_today(campaign)

    if not in_cd:
        for tier in campaign.tiers.all():  # ordered high → low (waterfall)
            tier_alloc = to_money(daily * tier.allocation_percent / 100)
            tier_used = _reserved_today(campaign, tier=tier)
            if (
                tier_used + tier.reward_amount <= tier_alloc
                and total_today + tier.reward_amount <= daily
            ):
                return Reservation.OfferType.PREMIUM, tier, tier.reward_amount

    fallback = getattr(campaign, "fallback_offer", None)
    if fallback and fallback.is_enabled:
        if total_today + fallback.reward_amount <= daily:
            return Reservation.OfferType.FALLBACK, None, fallback.reward_amount

    raise ReservationError("This offer is not currently available.")


# ---------------------------------------------------------------------------
# Claim (create reservation)
# ---------------------------------------------------------------------------
@transaction.atomic
def create_reservation(*, user, campaign_id, kind=Reservation.Kind.REBATE) -> Reservation:
    campaign = _lock_campaign(campaign_id)
    if campaign is None or not campaign.is_live or not campaign.brand.is_operational:
        raise ReservationError("This offer is not available.")

    # A shopper suspended by this brand can't claim its offers.
    from Apps.brands.customers import is_suspended_from_brand

    if is_suspended_from_brand(user, campaign.brand):
        raise ReservationError("This offer is not available.")

    # One active reservation per user per campaign.
    if Reservation.objects.filter(
        user=user, campaign=campaign, status=Reservation.Status.ACTIVE
    ).exists():
        raise ReservationError("You already have an active claim for this offer.")

    # Per-shopper active-claim slot limit (e.g. 3 of 5).
    slot_limit = settings.ACTIVE_CLAIM_SLOTS
    if Reservation.objects.filter(
        user=user, status=Reservation.Status.ACTIVE
    ).count() >= slot_limit:
        raise ReservationError(
            f"You've reached your active claim limit ({slot_limit}). Upload a "
            "receipt or let a claim expire to free up a slot."
        )

    # Backend-controlled global cap on concurrent active reservations.
    cap = settings.RESERVATION_GLOBAL_CAP
    if Reservation.objects.filter(status=Reservation.Status.ACTIVE).count() >= cap:
        raise ReservationError(
            "Reservation capacity reached. Please try again later."
        )

    offer_type, tier, reward = _select_claimable_offer(campaign, user)

    now = timezone.now()
    expires_at = _expiry_from(now)

    reservation = Reservation.objects.create(
        user=user,
        campaign=campaign,
        tier=tier,
        kind=kind,
        offer_type=offer_type,
        reward_amount=reward,
        status=Reservation.Status.ACTIVE,
        expires_at=expires_at,
    )

    # Escrow the reward on the brand wallet.
    wallet = wallet_services.get_or_create_brand_wallet(campaign.brand)
    try:
        hold = wallet_services.place_hold(
            wallet=wallet,
            amount=reward,
            reference_type="reservation",
            reference_id=reservation.id,
            expires_at=expires_at,
            idempotency_key=f"reservation-hold:{reservation.id}",
        )
    except wallet_services.InsufficientFunds:
        raise ReservationError(
            "The brand wallet has insufficient funds for this reward."
        )

    reservation.hold = hold
    reservation.save(update_fields=["hold", "updated_at"])

    # Claiming a premium reward starts the per-campaign cooldown.
    if offer_type == Reservation.OfferType.PREMIUM:
        enter_cooldown(user, campaign)

    return reservation


# ---------------------------------------------------------------------------
# Terminal transitions (driven by the redemption flow in M9)
# ---------------------------------------------------------------------------
def mark_redeemed(reservation: Reservation, now=None) -> Reservation:
    reservation.status = Reservation.Status.REDEEMED
    reservation.redeemed_at = now or timezone.now()
    reservation.save(update_fields=["status", "redeemed_at", "updated_at"])
    return reservation


def mark_rejected(reservation: Reservation) -> Reservation:
    """Terminate a claim whose receipt was rejected: release the escrow hold
    (brand money returns) but keep the daily budget consumed."""
    if reservation.hold_id:
        wallet_services.release_hold(hold=reservation.hold)
    reservation.status = Reservation.Status.REJECTED
    reservation.save(update_fields=["status", "updated_at"])
    return reservation


# ---------------------------------------------------------------------------
# Expiry (run by the expire_reservations command / Celery beat later)
# ---------------------------------------------------------------------------
def expire_due_reservations(now=None) -> int:
    now = now or timezone.now()
    due = (
        Reservation.objects.filter(
            status=Reservation.Status.ACTIVE, expires_at__lte=now
        )
        .select_related("hold")
    )
    count = 0
    for reservation in due:
        with transaction.atomic():
            reservation.status = Reservation.Status.EXPIRED
            reservation.expired_at = now
            reservation.save(update_fields=["status", "expired_at", "updated_at"])
            # Release the escrow hold — the money returns to the brand wallet.
            # The daily-budget usage is NOT restored (EXPIRED still counts).
            if reservation.hold_id:
                wallet_services.release_hold(hold=reservation.hold)
        count += 1
    return count
