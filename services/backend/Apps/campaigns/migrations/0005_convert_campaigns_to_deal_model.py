"""Convert existing tier/daily-budget campaigns onto the deal model.

top reward tier → max rebate; daily budget ÷ max rebate → desired redemptions
at a 100% redemption rate (so the 25-hour capacity matches the old daily
limit); BOGO campaigns → BOGO Free, the rest → Free. Live campaigns start
their first 25-hour cycle now. Inlined (not Apps.campaigns.deals) because
migrations must use historical models.
"""

from decimal import Decimal

from django.db import migrations
from django.utils import timezone

CENT = Decimal("0.01")


def _money(value):
    amount = Decimal(value).quantize(CENT)
    return f"${amount:.0f}" if amount == amount.to_integral_value() else f"${amount:.2f}"


def _wording(deal_type, name, cap):
    if deal_type == "bogo_free":
        return (
            f"Buy 1 {name}, Get 1 Free",
            f"Buy two eligible {name} products and receive the lower-priced "
            f"product free, up to {cap}.",
        )
    return (
        f"Free {name} up to {cap}",
        f"Buy one eligible {name} product and receive the verified "
        f"purchase price back, up to {cap}.",
    )


def forwards(apps, schema_editor):
    Campaign = apps.get_model("campaigns", "Campaign")
    now = timezone.now()
    for campaign in Campaign.objects.filter(max_rebate__isnull=True, fixed_reward__isnull=True):
        top = campaign.tiers.order_by("-reward_amount").first()
        if top is None:
            continue  # nothing to convert (draft without tiers)
        deal_type = "bogo_free" if campaign.is_bogo else "free"
        cap = Decimal(top.reward_amount).quantize(CENT)
        campaign.deal_type = deal_type
        campaign.max_rebate = cap
        campaign.fixed_reward = None
        campaign.required_quantity = 1
        campaign.min_purchase_units = max(campaign.min_purchase_units, 2 if deal_type == "bogo_free" else 1)
        if campaign.daily_budget and cap > 0:
            campaign.desired_redemptions = max(1, int(campaign.daily_budget // cap))
            campaign.estimated_redemption_rate = Decimal("100.00")
            campaign.claim_capacity = campaign.desired_redemptions  # ÷ 100%
        if not campaign.offer_headline:
            product = campaign.products.first()
            name = product.name if product else "this product"
            campaign.offer_headline, campaign.offer_description = _wording(
                deal_type, name, _money(cap)
            )
        if campaign.status in ("active", "paused") and campaign.activated_at is None:
            campaign.activated_at = now
        campaign.save()


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0004_campaign_activated_at_campaign_claim_capacity_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
