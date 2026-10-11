"""Brand dashboard + analytics to the Master definitions (#1, #28).

* Snapshots — Rebates: claims, redemptions, redemption rate, Total Brand Cost,
  cost per redemption. Reviews: invitations, completed, completion rate, Total
  Brand Cost, cost per review. Total Brand Cost = actual wallet debits for
  shopper rewards + Nibbl fees (subscriptions excluded).
* Customer & conversion — rebate offer views → claims, new vs returning.
* Campaign performance — every rebate campaign (ended ones too) with its
  results and a status from completed 25-hour cycles (current one excluded):
  Exhausted Early (< 12 h average to fill), On Pace (12–25 h), Behind (usually
  doesn't fill), Building Data (< 7 completed cycles).

Tracking limitations: the view→claim rate counts views, which may be
anonymous. Review invitations are the review opportunities created.
"""

from __future__ import annotations

import datetime as dt
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum
from django.utils import timezone

from Apps.campaigns import deals
from Apps.campaigns.models import Campaign
from Apps.common.money import ZERO
from Apps.offers.models import OfferView
from Apps.rebates.models import Redemption
from Apps.reservations.models import Reservation
from Apps.reviews.models import Review
from Apps.wallets.models import LedgerEntry, Wallet

CENT = Decimal("0.01")
MIN_CYCLES = 7
EARLY_HOURS = 12
RAISE_BY = Decimal("1.25")


def _rate(part, whole):
    return round(part * 100 / whole, 1) if whole else None


def _per(cost: Decimal, count: int) -> str | None:
    """Cost per result; None ("—") when there are no results."""
    return str((cost / count).quantize(CENT, rounding=ROUND_HALF_UP)) if count else None


def _cost(brand, start, end, categories) -> Decimal:
    wallet = Wallet.objects.filter(brand=brand).first()
    if wallet is None:
        return ZERO
    total = LedgerEntry.objects.filter(
        wallet=wallet, entry_type=LedgerEntry.EntryType.DEBIT, category__in=categories,
        created_at__gte=start, created_at__lt=end,
    ).aggregate(t=Sum("amount"))["t"]
    return (total or ZERO).quantize(CENT)


def cycle_performance(campaign: Campaign, now=None) -> dict:
    """Status from completed 25-hour cycles (the current one is excluded)."""
    now = now or timezone.now()
    capacity = campaign.claim_capacity
    anchor = campaign.activated_at
    if not capacity or anchor is None or anchor > now:
        return {"status": "building_data", "completed_cycles": 0, "average_fill_hours": None,
                "recommendation": "Wait for more activity before assigning a status."}
    completed = int((now - anchor) / deals.CYCLE)
    if completed < MIN_CYCLES:
        return {"status": "building_data", "completed_cycles": completed, "average_fill_hours": None,
                "recommendation": "Wait for more activity before assigning a status."}

    end = anchor + deals.CYCLE * completed
    claims = Reservation.objects.filter(
        campaign=campaign, created_at__gte=anchor, created_at__lt=end
    ).order_by("created_at").values_list("created_at", flat=True)
    per_cycle: dict[int, list] = {}
    for created in claims:
        per_cycle.setdefault(int((created - anchor) / deals.CYCLE), []).append(created)
    fill_hours = []
    for index, times in per_cycle.items():
        if len(times) >= capacity:  # filled: time of the capacity-th claim
            start = anchor + deals.CYCLE * index
            fill_hours.append((times[capacity - 1] - start).total_seconds() / 3600)

    average = round(sum(fill_hours) / len(fill_hours), 1) if fill_hours else None
    if len(fill_hours) * 2 < completed:  # usually doesn't fill before the reset
        status, advice = "behind", "Review the offer value and campaign visibility."
    elif average < EARLY_HOURS:
        status = "exhausted_early"
        raised = int((Decimal(campaign.desired_redemptions or 0) * RAISE_BY).to_integral_value(ROUND_HALF_UP))
        advice = f"Raise the claim limit by 25% (desired redemptions {campaign.desired_redemptions} → {raised})."
    else:
        status, advice = "on_pace", "No change recommended."
    return {"status": status, "completed_cycles": completed, "average_fill_hours": average,
            "recommendation": advice}


def brand_dashboard(brand, days: int = 30, now=None) -> dict:
    now = now or timezone.now()
    start = now - dt.timedelta(days=days)
    C = LedgerEntry.Category

    claims = Reservation.objects.filter(
        campaign__brand=brand, kind=Reservation.Kind.REBATE, created_at__gte=start, created_at__lt=now
    )
    redemptions = Redemption.objects.filter(brand=brand, created_at__gte=start, created_at__lt=now)
    rebate_cost = _cost(brand, start, now, [C.REBATE_REWARD, C.REBATE_FEE])

    # Review invitations = review opportunities created (each counted once).
    from Apps.reviews.models import ReviewSession

    invitations = ReviewSession.objects.filter(
        review_campaign__brand=brand, created_at__gte=start, created_at__lt=now
    ).count()
    reviews = Review.objects.filter(brand=brand, created_at__gte=start, created_at__lt=now).count()
    review_cost = _cost(brand, start, now, [C.REVIEW_REWARD, C.REVIEW_FEE])

    # Customer & conversion (rebates only).
    views = OfferView.objects.filter(
        campaign__brand=brand, created_at__gte=start, created_at__lt=now
    ).exclude(source=OfferView.Source.PREVIEW).count()
    claimers = set(claims.values_list("user_id", flat=True))
    returning = set(
        Reservation.objects.filter(campaign__brand=brand, user_id__in=claimers, created_at__lt=start)
        .values_list("user_id", flat=True)
    )

    wallet = Wallet.objects.filter(brand=brand).first()
    campaigns = []
    for campaign in Campaign.objects.filter(brand=brand).exclude(status=Campaign.Status.ARCHIVED):
        c_claims = claims.filter(campaign=campaign).count()
        c_redemptions = redemptions.filter(campaign=campaign).count()
        campaigns.append({
            "id": str(campaign.id),
            "name": campaign.name,
            "type": "rebate",
            "display_status": campaign.display_status,
            "claims": c_claims,
            "redemptions": c_redemptions,
            "redemption_rate": _rate(c_redemptions, c_claims),
            "claim_capacity": campaign.claim_capacity,
            "performance": cycle_performance(campaign, now),
        })

    # Review campaigns: Results = invitations / completed reviews in the period.
    from Apps.reviews.models import ReviewCampaign

    sessions = ReviewSession.objects.filter(review_campaign__brand=brand, created_at__gte=start, created_at__lt=now)
    period_reviews = Review.objects.filter(brand=brand, created_at__gte=start, created_at__lt=now)
    for rc in ReviewCampaign.objects.filter(brand=brand).exclude(status=ReviewCampaign.Status.ARCHIVED):
        r_invitations = sessions.filter(review_campaign=rc).count()
        r_completed = period_reviews.filter(review_campaign=rc).count()
        campaigns.append({
            "id": str(rc.id),
            "name": rc.name,
            "type": "review",
            "display_status": rc.status,
            "invitations": r_invitations,
            "completed": r_completed,
            "completion_rate": _rate(r_completed, r_invitations),
        })

    return {
        "period": {"days": days, "start": start, "end": now},
        "available_funds": str(wallet.reward_available()) if wallet else "0.00",
        "rebates": {
            "claims": claims.count(),
            "redemptions": redemptions.count(),
            "redemption_rate": _rate(redemptions.count(), claims.count()),
            "total_brand_cost": str(rebate_cost),
            "cost_per_redemption": _per(rebate_cost, redemptions.count()),
        },
        "reviews": {
            "invitations": invitations,
            "completed": reviews,
            "completion_rate": _rate(reviews, invitations),
            "total_brand_cost": str(review_cost),
            "cost_per_review": _per(review_cost, reviews),
        },
        "conversion": {
            "rebate_views": views,
            "claims": claims.count(),
            "view_to_claim_rate": _rate(claims.count(), views),
            "new_customers": len(claimers - returning),
            "returning_customers": len(returning),
        },
        "campaigns": campaigns,
    }
