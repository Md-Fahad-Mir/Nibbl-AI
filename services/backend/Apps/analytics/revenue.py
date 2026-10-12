"""Admin dashboard: Nibbl revenue + operational items (Master: Admin
Dashboard, Sheet 1; Revenue analytics).

* Revenue Summary — subscription revenue, rebate fees and review fees, taken
  from brand wallet debits in the date range. Brand-funded shopper rewards
  are NOT revenue and are reported separately. Promotional credit applied to
  fees/plans is shown so cash revenue = revenue − credits applied.
* Needs Attention — counts that link to the admin queues.
* Brand Revenue — revenue per brand, lowest first by default; filter by
  status / plan / category (a brand's category = its most common product
  category).
* Net Revenue — revenue − promotional credits applied − processing costs.
  Processing costs are estimates: Stripe card fees on wallet funding
  (``STRIPE_FEE_PERCENT`` + ``STRIPE_FEE_FIXED`` per charge) and payout fees on
  paid withdrawals (``PAYOUT_FEE_ESTIMATE``). Refunds are brand wallet cash
  returned — reported, never deducted (that money was never revenue).
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, Max, Q, Sum
from django.db.models.functions import TruncDay, TruncMonth
from django.utils import timezone

from Apps.brands.models import Brand, BrandCustomerSuspension
from Apps.common.money import ZERO
from Apps.wallets.models import LedgerEntry, Wallet

C = LedgerEntry.Category
CENT = Decimal("0.01")
REVENUE = {"subscriptions": C.SUBSCRIPTION, "rebate_fees": C.REBATE_FEE, "review_fees": C.REVIEW_FEE}
REWARDS = {"rebate_rewards": C.REBATE_REWARD, "review_rewards": C.REVIEW_REWARD}


def _money(value) -> str:
    return str((value or ZERO).quantize(CENT))


def brand_categories() -> dict:
    """brand_id → the brand's most common product category ('' if none)."""
    from Apps.products.models import Product

    best: dict = {}
    for row in (Product.objects.exclude(category="").values("brand_id", "category")
                .annotate(n=Count("id")).order_by("brand_id", "-n", "category")):
        best.setdefault(row["brand_id"], row["category"])
    return best


def stripe_fees_by_brand(start, end) -> dict:
    """Estimated Stripe card fees on each brand's wallet funding."""
    percent = Decimal(str(settings.STRIPE_FEE_PERCENT)) / 100
    fixed = Decimal(str(settings.STRIPE_FEE_FIXED))
    fees: dict = {}
    for row in (LedgerEntry.objects.filter(
            wallet__kind=Wallet.Kind.BRAND, entry_type=LedgerEntry.EntryType.CREDIT, category=C.FUNDING,
            is_promotional=False, created_at__gte=start, created_at__lt=end)
            .values("wallet__brand_id").annotate(t=Sum("amount"), n=Count("id"))):
        fees[row["wallet__brand_id"]] = (row["t"] * percent + fixed * row["n"]).quantize(CENT)
    return fees


def _brand_debits(start, end):
    return LedgerEntry.objects.filter(
        wallet__kind=Wallet.Kind.BRAND, entry_type=LedgerEntry.EntryType.DEBIT,
        created_at__gte=start, created_at__lt=end,
    )


def needs_attention() -> dict:
    from Apps.accounts.models import User
    from Apps.campaigns.models import CampaignReview
    from Apps.payouts.models import WithdrawalRequest
    from Apps.reviews.models import Review

    W = WithdrawalRequest.Status
    return {
        "withdrawals_to_review": WithdrawalRequest.objects.filter(
            Q(status=W.FLAGGED) | Q(status=W.PENDING, needs_review=True)
        ).count(),
        "campaign_approvals": CampaignReview.objects.filter(status=CampaignReview.Status.PENDING).count(),
        "failed_payouts": WithdrawalRequest.objects.filter(status=WithdrawalRequest.Status.FAILED).count(),
        "suspended_shoppers": User.objects.filter(role=User.Role.CONSUMER, is_active=False, is_deleted=False).count(),
        "brand_suspensions": BrandCustomerSuspension.objects.filter(is_active=True).count(),
        "flagged_reviews": Review.objects.filter(status=Review.Status.FLAGGED).count(),
    }


def revenue_dashboard(*, start=None, end=None, status: str = "", plan: str = "", sort: str = "lowest",
                      category: str = "") -> dict:
    end = end or timezone.now()
    start = start or end - dt.timedelta(days=30)
    debits = _brand_debits(start, end)

    def total(qs, category, **extra):
        return qs.filter(category=category, **extra).aggregate(t=Sum("amount"))["t"] or ZERO

    revenue = {key: total(debits, cat) for key, cat in REVENUE.items()}
    credits = debits.filter(category__in=REVENUE.values(), is_promotional=True).aggregate(t=Sum("amount"))["t"] or ZERO
    gross = sum(revenue.values(), ZERO)
    rewards = {key: total(debits, cat) for key, cat in REWARDS.items()}
    from Apps.payouts.models import WithdrawalRequest

    stripe_fees = stripe_fees_by_brand(start, end)
    paid_payouts = WithdrawalRequest.objects.filter(
        status=WithdrawalRequest.Status.PAID, paid_at__gte=start, paid_at__lt=end).count()
    payout_fees = (Decimal(str(settings.PAYOUT_FEE_ESTIMATE)) * paid_payouts).quantize(CENT)
    processing = sum(stripe_fees.values(), ZERO) + payout_fees
    refunds = total(debits, C.REFUND)

    # Daily trend for the Revenue Trend chart.
    daily: dict = {}
    for row in (debits.filter(category__in=REVENUE.values()).annotate(day=TruncDay("created_at"))
                .values("day", "category").annotate(t=Sum("amount")).order_by("day")):
        day = daily.setdefault(row["day"].date().isoformat(), {k: ZERO for k in REVENUE})
        day[next(k for k, c in REVENUE.items() if c == row["category"])] += row["t"]

    # Revenue Trend: each source by month.
    trend: dict = {}
    for row in (debits.filter(category__in=REVENUE.values()).annotate(month=TruncMonth("created_at"))
                .values("month", "category").annotate(t=Sum("amount")).order_by("month")):
        month = trend.setdefault(row["month"].date().isoformat()[:7], {k: ZERO for k in REVENUE})
        month[next(k for k, c in REVENUE.items() if c == row["category"])] += row["t"]

    # Revenue per brand (one grouped query).
    per_brand: dict = {}
    for row in debits.filter(category__in=REVENUE.values()).values("wallet__brand_id", "category").annotate(t=Sum("amount")):
        per_brand.setdefault(row["wallet__brand_id"], {})[row["category"]] = row["t"]
    credits_by_brand = dict(
        debits.filter(category__in=REVENUE.values(), is_promotional=True)
        .values_list("wallet__brand_id").annotate(t=Sum("amount"))
    )
    last_activity = dict(
        LedgerEntry.objects.filter(wallet__kind=Wallet.Kind.BRAND)
        .values_list("wallet__brand_id").annotate(t=Max("created_at"))
    )
    categories = brand_categories()
    brands = Brand.objects.select_related("plan")
    if status:
        brands = brands.filter(status=status)
    if plan:
        brands = brands.filter(plan__slug=plan)
    rows = []
    for brand in brands:
        if category and categories.get(brand.id, "").lower() != category.lower():
            continue
        by_cat = per_brand.get(brand.id, {})
        parts = {key: by_cat.get(cat, ZERO) for key, cat in REVENUE.items()}
        brand_revenue = sum(parts.values(), ZERO)
        brand_credits = credits_by_brand.get(brand.id) or ZERO
        brand_processing = stripe_fees.get(brand.id, ZERO)
        rows.append({
            "id": str(brand.id), "name": brand.name, "status": brand.status,
            "plan": brand.plan.name if brand.plan else None,
            **{k: _money(v) for k, v in parts.items()},
            "revenue": _money(brand_revenue),
            "category": categories.get(brand.id, ""),
            "credits": _money(brand_credits),
            "processing_costs": _money(brand_processing),
            "net_revenue": _money(brand_revenue - brand_credits - brand_processing),
            "last_activity": last_activity.get(brand.id),
        })
    rows.sort(key=lambda r: Decimal(r["revenue"]), reverse=sort == "highest")

    return {
        "period": {"start": start, "end": end},
        "revenue": {
            **{k: _money(v) for k, v in revenue.items()},
            "total": _money(gross),
            "credits_applied": _money(credits),
            "cash_total": _money(gross - credits),
        },
        "brand_funded_rewards": {
            **{k: _money(v) for k, v in rewards.items()},
            "total": _money(sum(rewards.values(), ZERO)),
        },
        "trend": [
            {"month": month, **{k: _money(v) for k, v in values.items()},
             "total": _money(sum(values.values(), ZERO))}
            for month, values in trend.items()
        ],
        "needs_attention": needs_attention(),
        "brands": rows,
        "net_revenue": {
            "promo_credits_used": _money(credits),
            "refunds": _money(refunds),
            "processing_costs": _money(processing),
            "stripe_fees": _money(sum(stripe_fees.values(), ZERO)),
            "payout_fees": _money(payout_fees),
            "net": _money(gross - credits - processing),
        },
        "daily_trend": [
            {"day": day, **{k: _money(v) for k, v in values.items()},
             "total": _money(sum(values.values(), ZERO))}
            for day, values in daily.items()
        ],
        "categories": sorted(set(categories.values())),
    }
