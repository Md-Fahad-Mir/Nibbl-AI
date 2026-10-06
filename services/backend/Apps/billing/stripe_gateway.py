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
        automatic_payment_methods={"enabled": True},
    )


def construct_event(payload: bytes, sig_header: str):
    """Verify a webhook signature and return the parsed Stripe event."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise StripeNotConfigured("Stripe webhook secret is not configured.")
    return stripe.Webhook.construct_event(
        payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
    )
