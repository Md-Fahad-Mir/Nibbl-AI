"""Brand plan page + self-serve plan changes (Master: Plans §1, §2, §5).

* Every change (upgrade or downgrade) begins at the next 30-day renewal
  (``Subscription.next_charge_at``); current pricing and access stay until
  then. The brand can cancel a scheduled change before renewal.
* Downgrade over the new campaign limit: the brand chooses which rebate
  campaigns stay active; the others are paused when the new plan begins.
* Customer-data access follows ``brand.plan``, so it changes when the new
  plan begins. Downloads already made are not touched.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from Apps.billing.models import Plan, Subscription
from Apps.common.models import AuditLog
from Apps.common.money import ZERO, to_money
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

# Master: Starter below $1,000 / Pro $1,000–$5,000 / Scale above $5,000
# monthly Nibbl spend.
PRO_FROM = Decimal("1000")
SCALE_FROM = Decimal("5000")


class PlanChangeError(Exception):
    """Expected, user-facing plan-change errors (HTTP 400)."""


def running_campaigns(brand):
    """Rebate campaigns using an active slot: active, or paused only for low
    funds (those resume on their own when the wallet is refilled)."""
    from Apps.campaigns.models import Campaign

    return brand.campaigns.filter(
        Q(status=Campaign.Status.ACTIVE) | Q(status=Campaign.Status.PAUSED, auto_paused=True)
    )


def monthly_spend(brand, now=None) -> Decimal:
    """Nibbl spend over the last 30 days: rewards, fees and plan charges."""
    from Apps.billing.services import _SPEND_CATEGORIES

    now = now or timezone.now()
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    total = LedgerEntry.objects.filter(
        wallet=wallet, entry_type=LedgerEntry.EntryType.DEBIT, category__in=_SPEND_CATEGORIES,
        created_at__gte=now - timedelta(days=30),
    ).aggregate(t=Sum("amount"))["t"]
    return to_money(total or ZERO)


def recommend(brand, now=None) -> dict:
    """Plan fit from monthly spend, then enough room for the brand's active
    campaigns (Master §2). Spend ranges show fit, not guaranteed savings."""
    plans = {p.slug: p for p in Plan.objects.filter(is_active=True)}
    order = [slug for slug in ("starter", "pro", "scale") if slug in plans]
    if not order:
        return {"plan": None, "reason": ""}
    spend = monthly_spend(brand, now)
    tier = "scale" if spend > SCALE_FROM else "pro" if spend >= PRO_FROM else "starter"
    index = order.index(tier) if tier in order else 0
    reason = f"Your Nibbl spend over the last 30 days was ${spend:,.2f}."
    # Campaign capacity: room for every running campaign, plus one more when
    # the brand is already at its current limit.
    running = running_campaigns(brand).count()
    current = brand.plan
    needed = running + 1 if current is not None and running >= current.max_active_campaigns else running
    while index < len(order) - 1 and plans[order[index]].max_active_campaigns < needed:
        index += 1
    slug = order[index]
    plan = plans[slug]
    if current is not None and plan.slug == current.slug:
        reason += f" {plan.name} is the right fit for you."
    else:
        reason += (
            f" {plan.name} gives you {plan.max_active_campaigns} active rebate campaign(s), "
            f"a {plan.rebate_fee_percent:g}% rebate fee and ${plan.review_fee} per completed review."
        )
    return {"plan": plan.slug, "reason": reason}


def _subscription(brand) -> Subscription:
    from Apps.billing.services import ensure_subscription

    subscription = ensure_subscription(brand)
    if subscription is None:
        raise PlanChangeError("This brand has no plan yet.")
    return subscription


def _audit(brand, actor, **meta) -> None:
    AuditLog.objects.create(
        action=AuditLog.Action.UPDATE,
        actor_type="admin" if getattr(actor, "is_platform_admin", False) else "brand_user",
        actor_id=str(actor.id) if actor else "", target_type="brand", target_id=str(brand.id), metadata=meta,
    )


@transaction.atomic
def schedule_change(*, brand, plan_slug: str, keep_campaign_ids=None, actor=None) -> Subscription:
    plan = Plan.objects.filter(slug=plan_slug, is_active=True).first()
    if plan is None:
        raise PlanChangeError("Plan not found.")
    subscription = _subscription(brand)
    if plan.pk == subscription.plan_id:
        raise PlanChangeError(f"You're already on {plan.name}.")

    running = list(running_campaigns(brand).values_list("id", flat=True))
    keep: list[str] = []
    if len(running) > plan.max_active_campaigns:
        keep = [str(c) for c in (keep_campaign_ids or [])]
        allowed = {str(c) for c in running}
        if len(set(keep)) != len(keep) or not set(keep) <= allowed:
            raise PlanChangeError("Choose from your currently active rebate campaigns.")
        if len(keep) != plan.max_active_campaigns:
            raise PlanChangeError(
                f"{plan.name} allows {plan.max_active_campaigns} active rebate campaign(s). "
                f"Choose the {plan.max_active_campaigns} to keep active; the others pause when {plan.name} begins."
            )

    subscription.scheduled_plan = plan
    subscription.scheduled_at = timezone.now()
    subscription.scheduled_keep_campaign_ids = keep
    subscription.save(update_fields=["scheduled_plan", "scheduled_at", "scheduled_keep_campaign_ids", "updated_at"])
    _audit(brand, actor, event="plan_change_scheduled", to=plan.slug, keep=keep,
           effective_at=subscription.next_charge_at.isoformat())
    return subscription


@transaction.atomic
def cancel_change(*, brand, actor=None) -> Subscription:
    subscription = _subscription(brand)
    if subscription.scheduled_plan_id is None:
        raise PlanChangeError("There's no scheduled plan change.")
    old = subscription.scheduled_plan.slug
    subscription.scheduled_plan = None
    subscription.scheduled_at = None
    subscription.scheduled_keep_campaign_ids = []
    subscription.save(update_fields=["scheduled_plan", "scheduled_at", "scheduled_keep_campaign_ids", "updated_at"])
    _audit(brand, actor, event="plan_change_canceled", plan=old)
    return subscription


def apply_scheduled_change(subscription: Subscription) -> bool:
    """At renewal, before the renewal charge: switch the plan (so the new
    price is charged) and pause campaigns over the new limit. Returns True if
    a change was applied."""
    from Apps.campaigns.models import Campaign

    plan = subscription.scheduled_plan
    if plan is None:
        return False
    brand = subscription.brand
    old = brand.plan.slug if brand.plan else None
    keep = set(subscription.scheduled_keep_campaign_ids or [])
    running = list(running_campaigns(brand).order_by("activated_at", "created_at"))
    if len(running) > plan.max_active_campaigns:
        # The brand's choices first, then the longest-running campaigns.
        running.sort(key=lambda c: str(c.id) not in keep)
        for campaign in running[plan.max_active_campaigns:]:
            campaign.status = Campaign.Status.PAUSED
            campaign.auto_paused = False  # don't auto-resume over the limit
            campaign.save(update_fields=["status", "auto_paused", "updated_at"])

    brand.plan = plan
    brand.save(update_fields=["plan", "updated_at"])
    subscription.plan = plan
    subscription.scheduled_plan = None
    subscription.scheduled_at = None
    subscription.scheduled_keep_campaign_ids = []
    subscription.save(update_fields=[
        "plan", "scheduled_plan", "scheduled_at", "scheduled_keep_campaign_ids", "updated_at",
    ])
    _audit(brand, None, event="plan_change_applied", **{"from": old, "to": plan.slug})
    return True


def plan_overview(brand, now=None) -> dict:
    """Current Plan (Master §1) + recommendation + any scheduled change."""
    subscription = _subscription(brand)
    plan = subscription.plan
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    history = LedgerEntry.objects.filter(
        wallet=wallet, category=LedgerEntry.Category.SUBSCRIPTION, entry_type=LedgerEntry.EntryType.DEBIT,
    ).order_by("-created_at")[:24]
    scheduled = subscription.scheduled_plan
    return {
        "plan": plan.slug,
        "plan_name": plan.name,
        "price": str(plan.monthly_price),
        "status": subscription.status,
        "renewal_date": subscription.next_charge_at,
        "active_campaigns_used": running_campaigns(brand).count(),
        "active_campaign_limit": plan.max_active_campaigns,
        "spend_last_30_days": str(monthly_spend(brand, now)),
        "billing_history": [
            {"date": e.created_at, "amount": str(e.amount), "description": e.description,
             "paid_with_credit": e.is_promotional}
            for e in history
        ],
        "scheduled_change": None if scheduled is None else {
            "plan": scheduled.slug,
            "plan_name": scheduled.name,
            "effective_at": subscription.next_charge_at,
            "keep_campaign_ids": subscription.scheduled_keep_campaign_ids,
        },
        "recommendation": recommend(brand, now),
    }
