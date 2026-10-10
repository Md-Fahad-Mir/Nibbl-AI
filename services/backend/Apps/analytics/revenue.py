"""Admin dashboard: Nibbl revenue + operational items (Master: Admin
Dashboard, Sheet 1; Revenue analytics).

* Revenue Summary — subscription revenue, rebate fees and review fees, taken
  from brand wallet debits in the date range. Brand-funded shopper rewards
  are NOT revenue and are reported separately. Promotional credit applied to
  fees/plans is shown so cash revenue = revenue − credits applied.
* Needs Attention — counts that link to the admin queues.
* Brand Revenue — revenue per brand, lowest first by default; filter by
  status / plan.
"""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
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
        # Payout results aren't imported yet, so failures aren't tracked.
        "failed_payouts": None,
        "suspended_shoppers": User.objects.filter(role=User.Role.CONSUMER, is_active=False, is_deleted=False).count(),
        "brand_suspensions": BrandCustomerSuspension.objects.filter(is_active=True).count(),
        "flagged_reviews": Review.objects.filter(status=Review.Status.FLAGGED).count(),
    }


def revenue_dashboard(*, start=None, end=None, status: str = "", plan: str = "", sort: str = "lowest") -> dict:
    end = end or timezone.now()
    start = start or end - dt.timedelta(days=30)
    debits = _brand_debits(start, end)

    def total(qs, category, **extra):
        return qs.filter(category=category, **extra).aggregate(t=Sum("amount"))["t"] or ZERO

    revenue = {key: total(debits, cat) for key, cat in REVENUE.items()}
    credits = debits.filter(category__in=REVENUE.values(), is_promotional=True).aggregate(t=Sum("amount"))["t"] or ZERO
    gross = sum(revenue.values(), ZERO)
    rewards = {key: total(debits, cat) for key, cat in REWARDS.items()}

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
    brands = Brand.objects.select_related("plan")
    if status:
        brands = brands.filter(status=status)
    if plan:
        brands = brands.filter(plan__slug=plan)
    rows = []
    for brand in brands:
        by_cat = per_brand.get(brand.id, {})
        parts = {key: by_cat.get(cat, ZERO) for key, cat in REVENUE.items()}
        rows.append({
            "id": str(brand.id), "name": brand.name, "status": brand.status,
            "plan": brand.plan.name if brand.plan else None,
            **{k: _money(v) for k, v in parts.items()},
            "revenue": _money(sum(parts.values(), ZERO)),
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
    }
