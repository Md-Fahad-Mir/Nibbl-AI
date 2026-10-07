"""Billing logic: per-plan fee computation and subscription charging.

Design note: the *Plan* is the single source of truth for fees (a separate
FeeSchedule model would only invite drift). These helpers are the seam other
milestones call to compute what to charge.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from Apps.billing import stripe_gateway
from Apps.billing.models import Plan, Subscription
from Apps.brands.models import Brand
from Apps.common.dates import add_months
from Apps.common.money import ZERO, to_money
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


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
        wallet_services.debit(
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
