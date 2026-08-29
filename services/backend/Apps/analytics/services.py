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
from Apps.reviews.models import Review, ReviewSession
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
    published = reviews.filter(status=Review.Status.PUBLISHED)
    avg = published.aggregate(a=Avg("rating"))["a"]
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
    reviews = Review.objects.filter(review_campaign__brand=brand)
    published = reviews.filter(status=Review.Status.PUBLISHED)
    avg = published.aggregate(a=Avg("rating"))["a"]

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
        "published_reviews": published.count(),
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
