"""Analytics aggregation: live metric functions + idempotent snapshot refresh.

Spend is derived from the wallet ledger (the authoritative money record), so it
always reconciles with actual debits.
"""

from __future__ import annotations

import datetime as dt

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from Apps.accounts.models import User
from Apps.analytics.models import CampaignStat, PlatformStat, ProductStat
from Apps.brands.models import Brand
from Apps.campaigns.models import Campaign
from Apps.common.money import ZERO
from Apps.products.models import Product
from Apps.rebates.models import Redemption
from Apps.receipts.models import Receipt
from Apps.reservations.models import Reservation
from Apps.reviews.models import Review
from Apps.wallets.models import LedgerEntry, Wallet


def _sum(qs, field) -> "Decimal":  # noqa: F821
    return qs.aggregate(t=Sum(field))["t"] or ZERO


# ---------------------------------------------------------------------------
# Campaign + product metrics
# ---------------------------------------------------------------------------
def campaign_metrics(campaign: Campaign) -> dict:
    reservations = Reservation.objects.filter(campaign=campaign)
    receipts = Receipt.objects.filter(campaign=campaign)
    redemptions = Redemption.objects.filter(campaign=campaign)
    return {
        "reservations": reservations.count(),
        "active_reservations": reservations.filter(
            status=Reservation.Status.ACTIVE
        ).count(),
        "approvals": receipts.filter(status=Receipt.Status.VERIFIED).count(),
        "rejected_receipts": receipts.filter(status=Receipt.Status.REJECTED).count(),
        "redemptions": redemptions.count(),
        "reward_spend": _sum(redemptions, "reward_amount"),
        "fee_spend": _sum(redemptions, "fee_amount"),
        "total_spend": _sum(redemptions, "reward_amount") + _sum(redemptions, "fee_amount"),
    }


def product_metrics(product: Product) -> dict:
    redemptions = Redemption.objects.filter(campaign__products=product)
    reviews = Review.objects.filter(product=product)
    avg = reviews.aggregate(a=Avg("rating"))["a"]
    return {
        "redemptions": redemptions.count(),
        "reviews_count": reviews.count(),
        "average_rating": round(avg, 2) if avg is not None else None,
        "reward_spend": _sum(redemptions, "reward_amount"),
    }


# ---------------------------------------------------------------------------
# Brand overview (live dashboard)
# ---------------------------------------------------------------------------
def _spend_by_category(brand: Brand) -> dict:
    wallet = Wallet.objects.filter(brand=brand).first()
    by_cat = {}
    if wallet:
        rows = (
            LedgerEntry.objects.filter(
                wallet=wallet, entry_type=LedgerEntry.EntryType.DEBIT
            )
            .values("category")
            .annotate(total=Sum("amount"))
        )
        by_cat = {r["category"]: r["total"] for r in rows}
    return by_cat


def brand_overview(brand: Brand) -> dict:
    reservations = Reservation.objects.filter(campaign__brand=brand)
    receipts = Receipt.objects.filter(brand=brand)
    redemptions = Redemption.objects.filter(brand=brand)
    reviews = Review.objects.filter(brand=brand)
    avg = reviews.aggregate(a=Avg("rating"))["a"]

    spend = _spend_by_category(brand)
    C = LedgerEntry.Category
    reward_spend = spend.get(C.REBATE_REWARD, ZERO)
    rebate_fee = spend.get(C.REBATE_FEE, ZERO)
    review_reward = spend.get(C.REVIEW_REWARD, ZERO)
    review_fee = spend.get(C.REVIEW_FEE, ZERO)
    subscription = spend.get(C.SUBSCRIPTION, ZERO)
    total_spend = sum(spend.values(), ZERO)

    return {
        "reservations": reservations.count(),
        "active_reservations": reservations.filter(
            status=Reservation.Status.ACTIVE
        ).count(),
        "approvals": receipts.filter(status=Receipt.Status.VERIFIED).count(),
        "rejected_receipts": receipts.filter(status=Receipt.Status.REJECTED).count(),
        "redemptions": redemptions.count(),
        "reviews": reviews.count(),
        # No moderation step in the current review flow -- every saved
        # review is immediately final, so this equals `reviews`. Kept as a
        # separate key for API stability (existing consumers of this field).
        "published_reviews": reviews.count(),
        "average_rating": round(avg, 2) if avg is not None else None,
        "spend": {
            "rebate_reward": reward_spend,
            "rebate_fee": rebate_fee,
            "review_reward": review_reward,
            "review_fee": review_fee,
            "subscription": subscription,
            "total": total_spend,
        },
    }


# ---------------------------------------------------------------------------
# Brand rebates summary (period-over-period)
# ---------------------------------------------------------------------------
def _change_percent(current, previous) -> float:
    """Period-over-period change. A zero baseline returns 0.0 (no div-by-zero)."""
    prev = float(previous)
    if prev == 0:
        return 0.0
    return round((float(current) - prev) / prev * 100, 1)


def _rebate_window(brand: Brand, start, end) -> dict:
    """Raw rebate metrics for a single [start, end) window."""
    reservations = Reservation.objects.filter(
        campaign__brand=brand, created_at__gte=start, created_at__lt=end
    )
    receipts = Receipt.objects.filter(
        brand=brand, created_at__gte=start, created_at__lt=end
    )
    redemptions = Redemption.objects.filter(
        brand=brand, created_at__gte=start, created_at__lt=end
    )

    reservation_count = reservations.count()
    redemption_count = redemptions.count()
    total_cashback = _sum(redemptions, "reward_amount")
    spend = total_cashback + _sum(redemptions, "fee_amount")
    redemption_rate = (
        round(redemption_count / reservation_count * 100, 1) if reservation_count else 0.0
    )

    # Average claim time: a redemption's issued_at minus its reservation's created_at.
    deltas = [
        (r.issued_at - r.reservation.created_at).total_seconds() / 60.0
        for r in redemptions.select_related("reservation")
        if r.issued_at and r.reservation_id and r.reservation.created_at
    ]
    avg_claim_time = round(sum(deltas) / len(deltas)) if deltas else 0

    # Active users: distinct across reservations, receipts and redemptions.
    user_ids: set = set()
    user_ids.update(reservations.values_list("user_id", flat=True))
    user_ids.update(receipts.values_list("user_id", flat=True))
    user_ids.update(redemptions.values_list("user_id", flat=True))

    return {
        "total_cashback": total_cashback,
        "redemption_rate": redemption_rate,
        "avg_claim_time_minutes": avg_claim_time,
        "active_users": len(user_ids),
        "spend": spend,
    }


def _budget_savings(brand: Brand, start, end, spend) -> "Decimal":  # noqa: F821
    """Budgeted allowance for the window minus actual reward+fee spend.

    ``active_days`` per campaign is approximated as the days its
    [start_at|created_at, end_at|now] window overlaps the period -- the codebase
    keeps no pause history, so a finer figure is not available. Documented
    assumption; change here if the product defines active_days differently.
    """
    period_days = max((end - start).days, 1)
    budgeted = ZERO
    for campaign in brand.campaigns.all():
        c_start = campaign.start_at or campaign.created_at
        c_end = campaign.end_at or end
        overlap_start = max(c_start, start)
        overlap_end = min(c_end, end)
        active_days = max(0, min((overlap_end - overlap_start).days, period_days))
        budgeted += campaign.daily_budget * active_days
    return budgeted - spend


def brand_rebates_summary(brand: Brand, period_days: int = 30) -> dict:
    now = timezone.now()
    cur_start = now - dt.timedelta(days=period_days)
    prev_start = now - dt.timedelta(days=2 * period_days)

    cur = _rebate_window(brand, cur_start, now)
    prev = _rebate_window(brand, prev_start, cur_start)

    total_cashback_change = _change_percent(cur["total_cashback"], prev["total_cashback"])
    redemption_rate_change = _change_percent(cur["redemption_rate"], prev["redemption_rate"])
    avg_claim_time_change = _change_percent(
        cur["avg_claim_time_minutes"], prev["avg_claim_time_minutes"]
    )
    active_users_change = _change_percent(cur["active_users"], prev["active_users"])

    # Headline movement: redemption rate, falling back to cashback when there was
    # no prior redemption rate to compare against.
    performance_change = (
        redemption_rate_change if prev["redemption_rate"] else total_cashback_change
    )

    return {
        "performance_change_percent": performance_change,
        "performance_change_label": "better" if performance_change >= 0 else "worse",
        "budget_savings": _budget_savings(brand, cur_start, now, cur["spend"]),
        "total_cashback": cur["total_cashback"],
        "total_cashback_change_percent": total_cashback_change,
        "redemption_rate": cur["redemption_rate"],
        "redemption_rate_change_percent": redemption_rate_change,
        "avg_claim_time_minutes": cur["avg_claim_time_minutes"],
        "avg_claim_time_change_percent": avg_claim_time_change,
        "active_users": cur["active_users"],
        "active_users_change_percent": active_users_change,
    }


# ---------------------------------------------------------------------------
# Platform overview (admin)
# ---------------------------------------------------------------------------
def platform_overview() -> dict:
    now = timezone.now()
    active_cutoff = now - dt.timedelta(days=30)
    today = timezone.localdate()

    customer_credits = LedgerEntry.objects.filter(
        wallet__kind=Wallet.Kind.CUSTOMER,
        entry_type=LedgerEntry.EntryType.CREDIT,
        category__in=[
            LedgerEntry.Category.REBATE_REWARD,
            LedgerEntry.Category.REVIEW_REWARD,
        ],
    )
    fees = LedgerEntry.objects.filter(
        entry_type=LedgerEntry.EntryType.DEBIT,
        category__in=[LedgerEntry.Category.REBATE_FEE, LedgerEntry.Category.REVIEW_FEE],
    )
    payouts = LedgerEntry.objects.filter(category=LedgerEntry.Category.PAYOUT)

    return {
        "brands_total": Brand.objects.count(),
        "active_brands": Brand.objects.filter(status=Brand.Status.ACTIVE).count(),
        "users_total": User.objects.filter(is_deleted=False).count(),
        "active_users": User.objects.filter(
            is_deleted=False, last_login__gte=active_cutoff
        ).count(),
        "new_users": User.objects.filter(created_at__date=today).count(),
        "reservations_total": Reservation.objects.count(),
        "redemptions_total": Redemption.objects.count(),
        "reviews_total": Review.objects.count(),
        "total_reward_paid": _sum(customer_credits, "amount"),
        "total_fees": _sum(fees, "amount"),
        "total_payouts": _sum(payouts, "amount"),
    }


# ---------------------------------------------------------------------------
# Idempotent snapshot refresh
# ---------------------------------------------------------------------------
def refresh_campaign_stats() -> int:
    count = 0
    for campaign in Campaign.objects.select_related("brand").all():
        CampaignStat.objects.update_or_create(
            campaign=campaign,
            defaults={"brand": campaign.brand, **campaign_metrics(campaign)},
        )
        count += 1
    return count


def refresh_product_stats() -> int:
    count = 0
    for product in Product.objects.select_related("brand").all():
        ProductStat.objects.update_or_create(
            product=product,
            defaults={"brand": product.brand, **product_metrics(product)},
        )
        count += 1
    return count


def refresh_platform_stat(date=None) -> PlatformStat:
    date = date or timezone.localdate()
    stat, _ = PlatformStat.objects.update_or_create(
        date=date, defaults=platform_overview()
    )
    return stat


def refresh_all() -> dict:
    return {
        "campaigns": refresh_campaign_stats(),
        "products": refresh_product_stats(),
        "platform_date": str(refresh_platform_stat().date),
    }
