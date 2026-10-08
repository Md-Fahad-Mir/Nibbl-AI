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
from Apps.offers.services import is_in_cooldown
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
def _claim_terms(campaign, user, now):
    """Check the deal is claimable for this shopper right now and return the
    amount to reserve (the maximum possible reward)."""
    from Apps.campaigns import deals

    # Cooldown starts at an approved redemption (one-time = forever).
    if is_in_cooldown(user, campaign):
        raise ReservationError("You've already redeemed this offer recently.")
    remaining = deals.capacity_remaining(campaign, now)
    if remaining is not None and remaining <= 0:
        raise ReservationError(
            "Current rebates have been claimed. This offer is temporarily unavailable."
        )
    reward = deals.max_reward(campaign)
    if not reward:
        raise ReservationError("This offer is not currently available.")
    return reward


# ---------------------------------------------------------------------------
# Claim (create reservation)
# ---------------------------------------------------------------------------
def _record_marketing_consent(*, user, brand, now) -> None:
    """Grant (or re-grant) email+SMS marketing consent for one scope. A box
    left unticked on a later claim never revokes an earlier consent — opting
    out is a separate, explicit action."""
    from Apps.accounts.models import MarketingConsent

    consent, created = MarketingConsent.objects.get_or_create(
        user=user, brand=brand, defaults={"opted_in": True, "consented_at": now}
    )
    if not created and not consent.opted_in:
        consent.opted_in = True
        consent.consented_at = now
        consent.revoked_at = None
        consent.save(update_fields=["opted_in", "consented_at", "revoked_at", "updated_at"])


@transaction.atomic
def create_reservation(*, user, campaign_id, kind=Reservation.Kind.REBATE,
                       consent_nibbl=False, consent_brand=False) -> Reservation:
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

    now = timezone.now()
    reward = _claim_terms(campaign, user, now)
    expires_at = _expiry_from(now)

    reservation = Reservation.objects.create(
        user=user,
        campaign=campaign,
        kind=kind,
        offer_type=Reservation.OfferType.PREMIUM,
        reward_amount=reward,  # reserve the maximum; actual decided on approval
        status=Reservation.Status.ACTIVE,
        expires_at=expires_at,
        # Rule snapshot: later campaign edits apply only to new claims.
        deal_type=campaign.deal_type,
        max_rebate=campaign.max_rebate,
        fixed_reward=campaign.fixed_reward,
        required_quantity=campaign.min_purchase_units,
        eligible_product_ids=[str(pid) for pid in campaign.products.values_list("id", flat=True)],
        allowed_merchants=campaign.allowed_merchants,
        cooldown_days=campaign.cooldown_days,
        one_time_only=campaign.one_time_only,
        consent_nibbl_marketing=bool(consent_nibbl),
        consent_brand_marketing=bool(consent_brand),
    )
    if consent_nibbl:
        _record_marketing_consent(user=user, brand=None, now=now)
    if consent_brand:
        _record_marketing_consent(user=user, brand=campaign.brand, now=now)

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
    # Cooldown now starts at the approved redemption (Apps.rebates.services).
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
