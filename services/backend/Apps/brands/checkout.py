"""Self-serve brand checkout (Master: Plan & Account Setup → Checkout &
Activation).

The brand's application records the chosen plan and company details. At
checkout the brand pays its first 30-day plan charge by card, less any promo
code credit, and the account activates immediately — no admin approval.
Paying funds the new brand wallet; the first subscription charge is then taken
from it (promotional credit first), so checkout shows up in the ledger like
every other plan charge. A $0 balance (promo covers the plan) activates
without a card.

Card payments complete through the Stripe ``payment_intent.succeeded``
webhook, which calls ``activate_from_intent``.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from Apps.billing import services as billing
from Apps.billing import stripe_gateway
from Apps.billing.models import Plan, PromoCode
from Apps.brands import services
from Apps.brands.models import Brand, BrandApplication
from Apps.common.money import ZERO, to_money
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

logger = logging.getLogger(__name__)

ACTIVATION = "brand_activation"


class CheckoutError(Exception):
    """Expected, user-facing checkout errors (HTTP 400)."""


def _require_open(application: BrandApplication) -> None:
    if application.status != BrandApplication.Status.PENDING:
        raise CheckoutError("This account has already been set up.")


def _plan(application: BrandApplication, plan_slug: str | None) -> Plan:
    if plan_slug:
        plan = Plan.objects.filter(slug=plan_slug, is_active=True).first()
        if plan is None:
            raise CheckoutError("Choose a plan.")
        return plan
    plan = application.requested_plan or services._default_plan()
    if plan is None:
        raise CheckoutError("Choose a plan.")
    return plan


def _promo(code: str) -> PromoCode | None:
    code = (code or "").strip().upper()
    if not code:
        return None
    promo = PromoCode.objects.filter(code=code).first()
    if promo is None:
        raise CheckoutError("Invalid promo code.")
    error = promo.availability_error()
    if error:
        raise CheckoutError(error)
    return promo


def quote(application: BrandApplication, *, plan_slug: str | None = None, promo_code: str = "") -> dict:
    _require_open(application)
    plan = _plan(application, plan_slug)
    promo = _promo(promo_code)
    price = to_money(plan.monthly_price)
    credit = to_money(promo.amount) if promo else ZERO
    return {
        "plan": plan.slug,
        "plan_name": plan.name,
        "price": str(price),
        "promo_code": promo.code if promo else "",
        "promo_credit": str(credit),
        # Credit beyond the plan price stays as promotional credit for fees.
        "due_today": str(max(price - credit, ZERO)),
    }


def start(application: BrandApplication, *, plan_slug: str | None = None, promo_code: str = "") -> dict:
    """Lock in the plan + promo code. Returns the Stripe client secret to pay
    ``due_today``, or activates straight away when nothing is due."""
    summary = quote(application, plan_slug=plan_slug, promo_code=promo_code)
    application.requested_plan = Plan.objects.get(slug=summary["plan"])
    application.checkout_promo_code = summary["promo_code"]
    due = Decimal(summary["due_today"])
    if due <= ZERO:
        application.save(update_fields=["requested_plan", "checkout_promo_code", "updated_at"])
        brand = activate(application, amount_paid=ZERO)
        return {**summary, "activated": True, "brand": str(brand.id), "client_secret": None}

    intent = stripe_gateway.create_checkout_intent(
        application=application, amount_cents=int(due * 100), purpose=ACTIVATION,
    )
    application.checkout_payment_intent_id = intent.id
    application.save(update_fields=[
        "requested_plan", "checkout_promo_code", "checkout_payment_intent_id", "updated_at",
    ])
    return {**summary, "activated": False, "brand": None, "client_secret": intent.client_secret}


@transaction.atomic
def activate(application: BrandApplication, *, amount_paid, payment_ref: str = "") -> Brand:
    """Create and activate the brand, fund its wallet with the payment, apply
    the promo code and take the first plan charge. Idempotent."""
    application = BrandApplication.objects.select_for_update().get(pk=application.pk)
    amount_paid = to_money(amount_paid)
    if application.status == BrandApplication.Status.APPROVED and application.brand_id:
        # Already active (webhook retry, or an admin approved it first): the
        # payment still belongs in the wallet — exactly once.
        _record_payment(application.brand, amount_paid, payment_ref)
        return application.brand
    _require_open(application)

    brand = services.approve_application(application=application, reviewer=None)
    _record_payment(brand, amount_paid, payment_ref)
    if application.checkout_promo_code:
        try:
            billing.redeem_promo_code(brand=brand, code=application.checkout_promo_code)
        except billing.BillingError:
            # The code lapsed between checkout and payment: the brand is still
            # activated; the plan charge simply uses what was paid.
            logger.warning("Checkout promo %s not applied for brand %s", application.checkout_promo_code, brand.id)

    subscription = billing.ensure_subscription(brand)
    billing._charge_one(subscription, timezone.now())
    return brand


def _record_payment(brand, amount_paid, payment_ref) -> None:
    if amount_paid <= ZERO:
        return
    wallet_services.credit(
        wallet=wallet_services.get_or_create_brand_wallet(brand), amount=amount_paid,
        category=LedgerEntry.Category.FUNDING, reference_type="stripe_payment_intent",
        reference_id=payment_ref, description="Plan checkout payment",
        idempotency_key=f"stripe:pi:{payment_ref}" if payment_ref else None,
    )


def activate_from_intent(intent) -> str:
    """Webhook: a succeeded activation PaymentIntent."""
    if hasattr(intent, "to_dict"):
        intent = intent.to_dict()
    metadata = intent.get("metadata") or {}
    if metadata.get("purpose") != ACTIVATION:
        return "ignored"
    application = BrandApplication.objects.filter(id=metadata.get("application_id")).first()
    if application is None:
        return "ignored"
    if application.status == BrandApplication.Status.REJECTED:
        logger.error("Paid checkout for rejected application %s (intent %s)", application.id, intent["id"])
        return "ignored"
    amount = to_money(Decimal(intent["amount_received"]) / 100)
    activate(application, amount_paid=amount, payment_ref=intent["id"])
    return "activated"
