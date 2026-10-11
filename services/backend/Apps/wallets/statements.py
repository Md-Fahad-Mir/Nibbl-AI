"""Brand weekly statements + detailed ledger (Master: Wallet §5).

* Weekly statement — one row per week (Monday–Sunday, platform timezone):
  rebate rewards, review rewards, fees, plan charges, credits applied and
  total cash spent. Spending = wallet debits; deposits, refunds and
  adjustments are not spending. Credits applied = the part of fees / plan
  charges paid with promotional credit, so
  total cash spent = rewards + fees + plan charges − credits applied.
* Detailed ledger — every posted ledger entry plus reward reservations and
  released reservations, for a date range.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone

from Apps.common.money import ZERO
from Apps.wallets.models import Hold, LedgerEntry

CENT = Decimal("0.01")
C = LedgerEntry.Category
FEES = (C.REBATE_FEE, C.REVIEW_FEE)


def week_start(day: dt.date) -> dt.date:
    return day - dt.timedelta(days=day.weekday())


def day_bounds(start: dt.date) -> tuple[dt.datetime, dt.datetime]:
    tz = timezone.get_current_timezone()
    begin = timezone.make_aware(dt.datetime.combine(start, dt.time.min), tz)
    return begin, begin + dt.timedelta(days=7)


def _money(value) -> str:
    return str((value or ZERO).quantize(CENT))


def spending(wallet, begin, end) -> dict:
    """Spending Overview for any period (Master: Wallet §4) — also each
    weekly statement row."""
    debits = LedgerEntry.objects.filter(
        wallet=wallet, entry_type=LedgerEntry.EntryType.DEBIT, created_at__gte=begin, created_at__lt=end,
    )

    def total(**filters):
        return debits.filter(**filters).aggregate(t=Sum("amount"))["t"] or ZERO

    rebate = total(category=C.REBATE_REWARD)
    review = total(category=C.REVIEW_REWARD)
    fees = total(category__in=FEES)
    plan = total(category=C.SUBSCRIPTION)
    credits = total(category__in=(*FEES, C.SUBSCRIPTION), is_promotional=True)
    return {
        "rebate_rewards": _money(rebate),
        "review_rewards": _money(review),
        "fees": _money(fees),
        "plan_charges": _money(plan),
        "credits_applied": _money(credits),
        "total_cash_spent": _money(rebate + review + fees + plan - credits),
    }


def week_summary(wallet, start: dt.date, now=None) -> dict:
    now = now or timezone.now()
    begin, end = day_bounds(start)
    return {
        "week_start": start,
        "week_end": start + dt.timedelta(days=6),
        "in_progress": begin <= now < end,
        **spending(wallet, begin, end),
    }


CYCLES_PER_WEEK = 7  # 25-hour claim cycles that can start within 7 days


def campaign_funding(brand) -> dict:
    """Campaign Funding (Master: Wallet §2): the most that all active
    campaigns could need over the next 7 days vs Available Funds."""
    from Apps.billing.services import rebate_processing_fee, review_fee
    from Apps.campaigns import deals
    from Apps.campaigns.models import Campaign
    from Apps.reviews.campaigns import reward_amount
    from Apps.reviews.models import ReviewCampaign
    from Apps.wallets.services import get_or_create_brand_wallet

    plan = brand.plan
    rebate_need = ZERO
    for campaign in brand.campaigns.filter(status=Campaign.Status.ACTIVE):
        reward = deals.max_reward(campaign) or ZERO
        fee = rebate_processing_fee(plan, reward) if plan else ZERO
        rebate_need += (reward + fee) * (campaign.claim_capacity or 0) * CYCLES_PER_WEEK
    review_need = ZERO
    per_review = reward_amount() + (review_fee(plan) if plan else ZERO)
    for campaign in brand.review_campaigns.filter(status=ReviewCampaign.Status.ACTIVE):
        review_need += per_review * campaign.daily_opportunities * 7
    wallet = get_or_create_brand_wallet(brand)
    available = wallet.reward_available()
    need = rebate_need + review_need
    return {
        "seven_day_need": _money(need),
        "rebate_need": _money(rebate_need),
        "review_need": _money(review_need),
        "available": _money(available),
        "all_funded": available >= need,
        "shortfall": _money(max(need - available, ZERO)),
    }


def weekly_statements(wallet, weeks: int = 12, now=None) -> list[dict]:
    """Newest first, including the current (in-progress) week, never before
    the wallet existed."""
    now = now or timezone.now()
    current = week_start(timezone.localdate(now))
    first = week_start(timezone.localtime(wallet.created_at).date())
    starts = [current - dt.timedelta(weeks=i) for i in range(weeks)]
    return [week_summary(wallet, s, now) for s in starts if s >= first]


def ledger_rows(wallet, start: dt.datetime | None = None, end: dt.datetime | None = None) -> list[dict]:
    """Ledger entries + reservation events, oldest first."""
    def window(field):
        q = Q()
        if start:
            q &= Q(**{f"{field}__gte": start})
        if end:
            q &= Q(**{f"{field}__lt": end})
        return q

    rows = [
        {
            "date": e.created_at, "type": e.entry_type, "category": e.category, "amount": e.signed_amount,
            "balance_after": e.balance_after, "promotional": e.is_promotional,
            "reference_type": e.reference_type, "reference_id": e.reference_id, "description": e.description,
        }
        for e in LedgerEntry.objects.filter(Q(wallet=wallet) & window("created_at"))
    ]
    holds = Hold.objects.filter(wallet=wallet)
    for h in holds.filter(window("created_at")):
        rows.append({
            "date": h.created_at, "type": "reservation", "category": h.reference_type, "amount": -h.amount,
            "balance_after": "", "promotional": False, "reference_type": h.reference_type,
            "reference_id": h.reference_id, "description": "Reward reserved",
        })
    for h in holds.filter(Q(released_at__isnull=False) & window("released_at")):
        rows.append({
            "date": h.released_at, "type": "reservation_released", "category": h.reference_type,
            "amount": h.amount, "balance_after": "", "promotional": False,
            "reference_type": h.reference_type, "reference_id": h.reference_id,
            "description": "Reservation released",
        })
    rows.sort(key=lambda r: r["date"])
    return rows


LEDGER_HEADER = [
    "date", "type", "category", "amount", "balance_after",
    "promotional", "reference_type", "reference_id", "description",
]


def ledger_csv_row(row: dict) -> list:
    return [
        row["date"].isoformat(), row["type"], row["category"], str(row["amount"]), str(row["balance_after"]),
        "yes" if row["promotional"] else "no", row["reference_type"], row["reference_id"], row["description"],
    ]
