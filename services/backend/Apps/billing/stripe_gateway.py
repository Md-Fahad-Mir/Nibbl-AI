"""Thin wrapper around the Stripe SDK.

Isolates every ``stripe`` call behind one module so services stay testable
(tests patch these functions) and configuration lives in one place. Stripe is
optional until keys are set, so callers get a clear error when it is not.
"""

from __future__ import annotations

import stripe
from django.conf import settings

from Apps.billing.models import StripeCustomer


class StripeNotConfigured(Exception):
    """Stripe keys are missing for this environment."""


def _client():
    if not settings.STRIPE_SECRET_KEY:
        raise StripeNotConfigured("Stripe is not configured.")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


def ensure_customer(brand) -> str:
    """Return the brand's Stripe customer id, creating it on first use."""
    link = StripeCustomer.objects.filter(brand=brand).first()
    if link:
        return link.stripe_customer_id

    customer = _client().Customer.create(
        name=brand.name,
        email=brand.contact_email or None,
        metadata={"brand_id": str(brand.id)},
    )
    StripeCustomer.objects.create(brand=brand, stripe_customer_id=customer.id)
    return customer.id


def create_payment_intent(*, brand, amount_cents: int, purpose: str):
    """Create a PaymentIntent for ``brand``, tagged with its purpose."""
    customer_id = ensure_customer(brand)
    return _client().PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        customer=customer_id,
        metadata={"brand_id": str(brand.id), "purpose": purpose},
        payment_method_types=["card"],
    )


def create_setup_intent(*, brand):
    """Create a SetupIntent so the brand can save a card for future charges."""
    customer_id = ensure_customer(brand)
    return _client().SetupIntent.create(
        customer=customer_id,
        usage="off_session",
        payment_method_types=["card"],
        metadata={"brand_id": str(brand.id)},
    )


def list_payment_methods(*, brand):
    """List the brand's saved cards (empty list if no Stripe customer yet)."""
    link = StripeCustomer.objects.filter(brand=brand).first()
    if link is None:
        return []
    resp = _client().PaymentMethod.list(customer=link.stripe_customer_id, type="card")
    return list(resp.data)


def charge_saved_card(*, brand, amount_cents: int, payment_method_id: str, purpose: str):
    """Charge a saved card off-session (for auto-refill). Confirms immediately."""
    customer_id = ensure_customer(brand)
    return _client().PaymentIntent.create(
        amount=amount_cents,
        currency="usd",
        customer=customer_id,
        payment_method=payment_method_id,
        off_session=True,
        confirm=True,
        metadata={"brand_id": str(brand.id), "purpose": purpose},
    )


def construct_event(payload: bytes, sig_header: str):
    """Verify a webhook signature and return the parsed Stripe event."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise StripeNotConfigured("Stripe webhook secret is not configured.")
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )
