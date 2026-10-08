"""Billing configuration.

M2 introduces the subscription *plan* definitions only. Subscriptions,
wallets, fees-in-motion and charges arrive in M3.
"""

from django.db import models

from Apps.common.models import BaseModel
from Apps.common.money import MONEY_FIELD, ZERO


class Plan(BaseModel):
    """A subscription tier a brand can be on (Starter / Pro / Scale).

    Encodes the per-plan economics referenced throughout the spec:
    monthly subscription price, rebate processing fee %, review fee, and the
    customer-data access level (Starter = anonymized, Pro/Scale = full).
    """

    class Slug(models.TextChoices):
        STARTER = "starter", "Starter"
        PRO = "pro", "Pro"
        SCALE = "scale", "Scale"

    class DataAccess(models.TextChoices):
        ANONYMIZED = "anonymized", "Anonymized"
        FULL = "full", "Full"

    slug = models.SlugField(unique=True, choices=Slug.choices)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)

    # Economics — all money/percentages are Decimal, never float.
    monthly_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    rebate_fee_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    review_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Plan-based feature gating.
    data_access_level = models.CharField(
        max_length=20, choices=DataAccess.choices, default=DataAccess.ANONYMIZED
    )
    customer_data_module = models.BooleanField(
        default=False,
        help_text="Whether the brand can access the Customers module.",
    )
    max_active_campaigns = models.PositiveIntegerField(
        default=1,
        help_text="How many campaigns a brand on this plan may run at once.",
    )

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "monthly_price"]

    def __str__(self):
        return self.name


class Subscription(BaseModel):
    """A brand's recurring subscription to a plan.

    The monthly charge is pulled from the brand's funded wallet by the
    ``charge_subscriptions`` command. If the wallet can't cover it the
    subscription goes PAST_DUE (and, from M5, the brand's campaigns pause).
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAST_DUE = "past_due", "Past due"
        CANCELED = "canceled", "Canceled"

    brand = models.OneToOneField(
        "brands.Brand", on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.ForeignKey(
        Plan, on_delete=models.PROTECT, related_name="subscriptions"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )

    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    next_charge_at = models.DateTimeField(db_index=True)
    last_charged_at = models.DateTimeField(null=True, blank=True)

    # Cumulative amount successfully charged (for quick reporting).
    total_charged = models.DecimalField(default=ZERO, **MONEY_FIELD)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.brand_id} → {self.plan.slug} ({self.status})"


class StripeCustomer(BaseModel):
    """Links a brand to its Stripe customer so card payments can fund the wallet.

    Money flows in via Stripe (card → wallet); all existing wallet deductions
    (subscriptions, rebate fees) stay unchanged.
    """

    brand = models.OneToOneField(
        "brands.Brand", on_delete=models.CASCADE, related_name="stripe_customer"
    )
    stripe_customer_id = models.CharField(max_length=255, unique=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.brand_id} → {self.stripe_customer_id}"


class AutoRefill(BaseModel):
    """Per-brand automatic wallet top-up from a saved card.

    When enabled and the brand wallet drops below ``threshold``, the
    ``run_auto_refill`` job charges the saved card for ``amount`` (off-session);
    the resulting payment credits the wallet via the normal Stripe webhook.
    """

    brand = models.OneToOneField(
        "brands.Brand", on_delete=models.CASCADE, related_name="auto_refill"
    )
    enabled = models.BooleanField(default=False)
    threshold = models.DecimalField(default=ZERO, **MONEY_FIELD)
    amount = models.DecimalField(default=ZERO, **MONEY_FIELD)
    # The saved Stripe PaymentMethod to charge (set after a card is saved).
    stripe_payment_method_id = models.CharField(max_length=255, blank=True)
    last_refilled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.brand_id} auto-refill ({'on' if self.enabled else 'off'})"
