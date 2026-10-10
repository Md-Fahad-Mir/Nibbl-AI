"""Materialized analytics snapshots.

Dashboards read live aggregates (always accurate); these snapshot tables persist
periodic rollups for history/trends and are refreshed idempotently by the
`refresh_analytics` command (update_or_create keyed by entity/date).
"""

from django.db import models

from Apps.common.models import BaseModel
from Apps.common.money import MONEY_FIELD, ZERO


class CampaignStat(BaseModel):
    campaign = models.OneToOneField(
        "campaigns.Campaign", on_delete=models.CASCADE, related_name="stat"
    )
    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="campaign_stats"
    )
    reservations = models.PositiveIntegerField(default=0)
    active_reservations = models.PositiveIntegerField(default=0)
    approvals = models.PositiveIntegerField(default=0)
    rejected_receipts = models.PositiveIntegerField(default=0)
    redemptions = models.PositiveIntegerField(default=0)
    reward_spend = models.DecimalField(default=ZERO, **MONEY_FIELD)
    fee_spend = models.DecimalField(default=ZERO, **MONEY_FIELD)
    total_spend = models.DecimalField(default=ZERO, **MONEY_FIELD)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-total_spend"]

    def __str__(self):
        return f"Stat for campaign {self.campaign_id}"


class ProductStat(BaseModel):
    product = models.OneToOneField(
        "products.Product", on_delete=models.CASCADE, related_name="stat"
    )
    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="product_stats"
    )
    redemptions = models.PositiveIntegerField(default=0)
    reviews_count = models.PositiveIntegerField(default=0)
    average_rating = models.DecimalField(
        max_digits=3, decimal_places=2, null=True, blank=True
    )
    reward_spend = models.DecimalField(default=ZERO, **MONEY_FIELD)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-redemptions"]

    def __str__(self):
        return f"Stat for product {self.product_id}"


class PlatformStat(BaseModel):
    """A daily platform-wide snapshot (one row per date)."""

    date = models.DateField(unique=True)
    brands_total = models.PositiveIntegerField(default=0)
    active_brands = models.PositiveIntegerField(default=0)
    users_total = models.PositiveIntegerField(default=0)
    active_users = models.PositiveIntegerField(default=0)
    new_users = models.PositiveIntegerField(default=0)
    reservations_total = models.PositiveIntegerField(default=0)
    redemptions_total = models.PositiveIntegerField(default=0)
    reviews_total = models.PositiveIntegerField(default=0)
    total_reward_paid = models.DecimalField(default=ZERO, **MONEY_FIELD)
    total_fees = models.DecimalField(default=ZERO, **MONEY_FIELD)
    total_payouts = models.DecimalField(default=ZERO, **MONEY_FIELD)
    computed_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date"]

    def __str__(self):
        return f"Platform stat {self.date}"


class DiscoveryBrandRule(BaseModel):
    """Admin correction for Receipt Brand Discovery: the brand detected from a
    receipt's product text (its leading word, e.g. "KETTLE") can be renamed,
    merged into another brand, or ignored (e.g. store brands)."""

    token = models.CharField(max_length=40, unique=True)
    display_name = models.CharField(max_length=120, blank=True)
    ignored = models.BooleanField(default=False)

    def __str__(self):
        return self.display_name or self.token
