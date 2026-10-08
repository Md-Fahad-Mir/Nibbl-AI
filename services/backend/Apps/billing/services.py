"""Billing logic: per-plan fee computation and subscription charging.

Design note: the *Plan* is the single source of truth for fees (a separate
FeeSchedule model would only invite drift). These helpers are the seam other
milestones call to compute what to charge.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone

from Apps.billing import stripe_gateway
from Apps.billing.models import (
    AutoRefill,
    Plan,
    PromoCode,
    PromoCodeRedemption,
    Subscription,
)
from Apps.brands.models import Brand
from Apps.common.dates import add_months
from Apps.common.money import ZERO, to_money
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

logger = logging.getLogger(__name__)

# Wallet outflows that count toward a brand's spend (what the 7-day estimate
# and the auto-refill trigger are based on).
_SPEND_CATEGORIES = [
    LedgerEntry.Category.REBATE_REWARD,
    LedgerEntry.Category.REBATE_FEE,
    LedgerEntry.Category.REVIEW_REWARD,
    LedgerEntry.Category.REVIEW_FEE,
    LedgerEntry.Category.SUBSCRIPTION,
]
# Master spec: refill when Available Funds reaches 25% of the 7-day estimate.
AUTO_REFILL_TRIGGER_FRACTION = Decimal("0.25")


class BillingError(Exception):
    """A billing operation could not be completed."""


# ---------------------------------------------------------------------------
# Fee computation (used by rebates/reviews in later milestones)
# ---------------------------------------------------------------------------
def rebate_processing_fee(plan: Plan, reward_amount) -> Decimal:
    reward_amount = to_money(reward_amount)
    return to_money(reward_amount * plan.rebate_fee_percent / 100)


def review_fee(plan: Plan) -> Decimal:
    return to_money(plan.review_fee)


# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------
def ensure_subscription(brand) -> Subscription | None:
    """Create an ACTIVE subscription for a brand that has a plan (idempotent)."""
    if brand.plan_id is None:
        return None
    now = timezone.now()
    subscription, _ = Subscription.objects.get_or_create(
        brand=brand,
        defaults={
            "plan": brand.plan,
            "status": Subscription.Status.ACTIVE,
            "current_period_start": now,
            "current_period_end": add_months(now, 1),
            "next_charge_at": now,  # charge on the next run
        },
    )
    return subscription


def ensure_all_subscriptions() -> int:
    from Apps.brands.models import Brand

    count = 0
    for brand in Brand.objects.filter(
        status=Brand.Status.ACTIVE, plan__isnull=False
    ):
        if ensure_subscription(brand) is not None:
            count += 1
    return count


@transaction.atomic
def _charge_one(subscription: Subscription, now) -> str:
    plan = subscription.plan
    amount = to_money(plan.monthly_price)

    # Free plan: nothing to charge, just roll the period forward.
    if amount <= ZERO:
        _advance_period(subscription, now, charged=ZERO)
        return "free"

    wallet = wallet_services.get_or_create_brand_wallet(subscription.brand)
    period_key = subscription.current_period_start.date().isoformat()
    try:
        # Subscription is an eligible charge: spend promotional credit first.
        wallet_services.charge_eligible(
            wallet=wallet,
            amount=amount,
            category=LedgerEntry.Category.SUBSCRIPTION,
            reference_type="subscription",
            reference_id=subscription.id,
            description=f"{plan.name} subscription",
            idempotency_key=f"subscription:{subscription.id}:{period_key}",
        )
    except wallet_services.InsufficientFunds:
        subscription.status = Subscription.Status.PAST_DUE
        subscription.save(update_fields=["status", "updated_at"])
        return "past_due"

    _advance_period(subscription, now, charged=amount)
    return "charged"


def _advance_period(subscription: Subscription, now, *, charged) -> None:
    subscription.status = Subscription.Status.ACTIVE
    subscription.last_charged_at = now
    subscription.total_charged = to_money(subscription.total_charged + charged)
    subscription.current_period_start = subscription.next_charge_at
    subscription.current_period_end = add_months(subscription.next_charge_at, 1)
    subscription.next_charge_at = add_months(subscription.next_charge_at, 1)
    subscription.save(
        update_fields=[
            "status",
            "last_charged_at",
            "total_charged",
            "current_period_start",
            "current_period_end",
            "next_charge_at",
            "updated_at",
        ]
    )


def charge_due_subscriptions(now=None) -> dict:
    """Charge every subscription whose next_charge_at has passed.

    Idempotent per billing period via the wallet debit's idempotency key.
    Returns a summary count by outcome.
    """
    # Ensure subscriptions exist *before* sampling `now`, so a freshly-created
    # subscription (next_charge_at set to its own creation time) reads as due.
    ensure_all_subscriptions()
    now = now or timezone.now()

    summary = {"charged": 0, "past_due": 0, "free": 0}
    due = Subscription.objects.filter(
        status__in=[Subscription.Status.ACTIVE, Subscription.Status.PAST_DUE],
        next_charge_at__lte=now,
    ).select_related("brand", "plan")
    for subscription in due:
        outcome = _charge_one(subscription, now)
        summary[outcome] += 1
    return summary


# ---------------------------------------------------------------------------
# Stripe: card payments that fund the brand wallet (money IN)
# ---------------------------------------------------------------------------
WALLET_TOPUP = "wallet_topup"


def create_wallet_topup_intent(*, brand, amount) -> dict:
    """Create a Stripe PaymentIntent to add ``amount`` (USD) to the wallet.

    Returns the client_secret the frontend uses to confirm the card. The wallet
    is credited only when the ``payment_intent.succeeded`` webhook arrives.
    """
    amount = to_money(amount)
    if amount <= ZERO:
        raise BillingError("Amount must be positive.")

    intent = stripe_gateway.create_payment_intent(
        brand=brand,
        amount_cents=int(amount * 100),
        purpose=WALLET_TOPUP,
    )
    return {
        "client_secret": intent.client_secret,
        "payment_intent_id": intent.id,
        "amount": amount,
    }


def handle_stripe_event(event) -> str:
    """Route a verified Stripe webhook event. Returns a short outcome string."""
    if event["type"] == "payment_intent.succeeded":
        return _credit_wallet_from_payment(event["data"]["object"])
    return "ignored"


def _credit_wallet_from_payment(intent) -> str:
    """Credit a brand wallet from a succeeded wallet-topup PaymentIntent.

    Idempotent per PaymentIntent, so Stripe's at-least-once delivery is safe.
    """
    # A real webhook delivers a StripeObject (which has no .get()); normalize
    # to a plain dict so field access matches the test fixtures.
    if hasattr(intent, "to_dict"):
        intent = intent.to_dict()
    metadata = intent.get("metadata") or {}
    if metadata.get("purpose") != WALLET_TOPUP:
        return "ignored"

    brand = Brand.objects.filter(id=metadata.get("brand_id")).first()
    if brand is None:
        return "ignored"

    amount = to_money(Decimal(intent["amount_received"]) / 100)
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet,
        amount=amount,
        category=LedgerEntry.Category.FUNDING,
        reference_type="stripe_payment_intent",
        reference_id=intent["id"],
        description="Wallet funding via Stripe",
        idempotency_key=f"stripe:pi:{intent['id']}",
    )
    return "credited"


# ---------------------------------------------------------------------------
# Phase 2: saved card + automatic wallet refill
# ---------------------------------------------------------------------------
def create_card_setup_intent(*, brand) -> dict:
    """Start saving a card. Returns the client_secret the frontend confirms."""
    intent = stripe_gateway.create_setup_intent(brand=brand)
    return {"client_secret": intent.client_secret, "setup_intent_id": intent.id}


def list_saved_cards(*, brand) -> list[dict]:
    """Return the brand's saved cards as simple dicts for the UI."""
    cards = []
    for pm in stripe_gateway.list_payment_methods(brand=brand):
        if hasattr(pm, "to_dict"):
            pm = pm.to_dict()
        card = pm.get("card") or {}
        cards.append(
            {
                "id": pm.get("id"),
                "brand": card.get("brand"),
                "last4": card.get("last4"),
                "exp_month": card.get("exp_month"),
                "exp_year": card.get("exp_year"),
            }
        )
    return cards


def get_or_create_auto_refill(brand) -> AutoRefill:
    config, _ = AutoRefill.objects.get_or_create(brand=brand)
    return config


def set_auto_refill(*, brand, enabled: bool, amount, payment_method_id: str) -> AutoRefill:
    """Configure a brand's auto-refill. Enabling requires a saved card.

    There is no brand-set threshold: the Master triggers a refill when Available
    Funds reach 25% of the estimated 7-day requirement (see ``run_auto_refill``).
    """
    amount = to_money(amount)
    if enabled:
        if not payment_method_id:
            raise BillingError("A saved card is required to enable auto-refill.")
        if amount <= ZERO:
            raise BillingError("Refill amount must be positive.")

    config = get_or_create_auto_refill(brand)
    config.enabled = enabled
    config.amount = amount
    config.stripe_payment_method_id = payment_method_id
    config.save(
        update_fields=["enabled", "amount", "stripe_payment_method_id", "updated_at"]
    )
    return config


def estimate_seven_day_requirement(brand) -> Decimal:
    """Estimate a brand's 7-day funding need from its last 7 days of spend."""
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    since = timezone.now() - timedelta(days=7)
    total = (
        LedgerEntry.objects.filter(
            wallet=wallet,
            entry_type=LedgerEntry.EntryType.DEBIT,
            category__in=_SPEND_CATEGORIES,
            created_at__gte=since,
        ).aggregate(total=Sum("amount"))["total"]
        or ZERO
    )
    return to_money(total)


def auto_refill_status(brand) -> dict:
    """Config plus the computed 7-day estimate, trigger point, and recommendation."""
    config = get_or_create_auto_refill(brand)
    estimate = estimate_seven_day_requirement(brand)
    return {
        "enabled": config.enabled,
        "amount": config.amount,
        "payment_method_id": config.stripe_payment_method_id,
        "last_refilled_at": config.last_refilled_at,
        "estimated_seven_day": estimate,
        "trigger_at": to_money(estimate * AUTO_REFILL_TRIGGER_FRACTION),
        # Nibbl's recommendation: fund roughly a week at a time.
        "recommended_amount": estimate,
    }


def _notify_refill_failed(brand, amount) -> None:
    """Alert the brand's managers (in-app) that their auto-refill payment failed."""
    from Apps.brands.models import BrandMembership
    from Apps.notifications import services as notifications

    managers = BrandMembership.objects.filter(
        brand=brand,
        is_active=True,
        role__in=[BrandMembership.Role.OWNER, BrandMembership.Role.ADMIN],
    ).select_related("user")
    for membership in managers:
        notifications.notify(
            user=membership.user,
            notification_type="auto_refill_failed",
            context={"brand": brand.name, "amount": str(amount)},
            reference_type="auto_refill",
            reference_id=brand.id,
        )


def run_auto_refill(now=None) -> dict:
    """Charge the saved card for every enabled brand whose Available Funds have
    reached 25% of their estimated 7-day requirement (Master spec).

    The off-session charge credits the wallet through the usual Stripe webhook,
    so this job only initiates the payment. On failure the brand is notified.
    Returns a summary count.
    """
    now = now or timezone.now()
    summary = {"charged": 0, "skipped": 0, "failed": 0}

    due = AutoRefill.objects.filter(enabled=True).select_related("brand")
    for config in due:
        if not config.stripe_payment_method_id or config.amount <= ZERO:
            summary["skipped"] += 1
            continue
        trigger_at = to_money(
            estimate_seven_day_requirement(config.brand) * AUTO_REFILL_TRIGGER_FRACTION
        )
        wallet = wallet_services.get_or_create_brand_wallet(config.brand)
        # No recent spend (estimate 0) means there is nothing to refill for.
        # Promo credit doesn't count toward the real funds that back rewards.
        if trigger_at <= ZERO or wallet.reward_available() >= trigger_at:
            summary["skipped"] += 1
            continue
        try:
            stripe_gateway.charge_saved_card(
                brand=config.brand,
                amount_cents=int(config.amount * 100),
                payment_method_id=config.stripe_payment_method_id,
                purpose=WALLET_TOPUP,
            )
        except Exception:  # card declined / auth required / Stripe error
            logger.warning("Auto-refill charge failed for brand %s", config.brand_id)
            _notify_refill_failed(config.brand, config.amount)
            summary["failed"] += 1
            continue
        config.last_refilled_at = now
        config.save(update_fields=["last_refilled_at", "updated_at"])
        summary["charged"] += 1
    return summary


# ---------------------------------------------------------------------------
# Promo codes (reusable promotional credit)
# ---------------------------------------------------------------------------
def create_promo_code(*, code, amount, note="", valid_from=None, valid_until=None,
                      max_redemptions=None, once_per_brand=True,
                      created_by=None) -> PromoCode:
    code = (code or "").strip().upper()
    if not code:
        raise BillingError("A code is required.")
    amount = to_money(amount)
    if amount <= ZERO:
        raise BillingError("Promo code amount must be positive.")
    if PromoCode.objects.filter(code=code).exists():
        raise BillingError("A promo code with this code already exists.")
    if valid_from and valid_until and valid_until < valid_from:
        raise BillingError("The end date must be after the start date.")
    if max_redemptions is not None and max_redemptions <= 0:
        raise BillingError("Max redemptions must be a positive number.")
    return PromoCode.objects.create(
        code=code, amount=amount, note=note,
        valid_from=valid_from, valid_until=valid_until,
        max_redemptions=max_redemptions, once_per_brand=once_per_brand,
        created_by=created_by,
    )


@transaction.atomic
def redeem_promo_code(*, brand, code) -> PromoCodeRedemption:
    code = (code or "").strip().upper()
    if not code:
        raise BillingError("Enter a promo code.")
    qs = PromoCode.objects.all()
    try:
        promo = qs.select_for_update().get(code=code)
    except PromoCode.DoesNotExist:
        raise BillingError("Invalid promo code.")

    error = promo.availability_error()
    if error:
        raise BillingError(error)
    if promo.once_per_brand and PromoCodeRedemption.objects.filter(
        promo_code=promo, brand=brand
    ).exists():
        raise BillingError("Your brand has already redeemed this promo code.")

    wallet = wallet_services.get_or_create_brand_wallet(brand)
    entry = wallet_services.credit(
        wallet=wallet,
        amount=promo.amount,
        category=LedgerEntry.Category.ADJUSTMENT,
        reference_type="promo_code",
        reference_id=promo.id,
        description=f"Promo code {promo.code}",
        idempotency_key=(
            f"promo-code:{promo.id}:{brand.id}" if promo.once_per_brand else None
        ),
        is_promotional=True,
    )
    PromoCode.objects.filter(pk=promo.pk).update(
        redemption_count=F("redemption_count") + 1
    )
    return PromoCodeRedemption.objects.create(
        promo_code=promo, brand=brand, amount=promo.amount, ledger_entry=entry,
    )
