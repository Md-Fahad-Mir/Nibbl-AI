"""Deal-model helpers: suggested wording, 25-hour Claim Capacity, validation,
and mapping the old builder's inputs (tiers, daily budget) onto the deal model.
"""

from __future__ import annotations

import datetime as dt
import math
from decimal import Decimal

from django.utils import timezone

from Apps.campaigns.models import Campaign
from Apps.rebates import reward_math as rm

CENT = Decimal("0.01")
CYCLE = dt.timedelta(hours=25)
ALLOWED_COOLDOWN_DAYS = (0, 30, 60, 90)
BOGO_TYPES = {Campaign.DealType.BOGO_FREE, Campaign.DealType.BOGO_HALF}
_WORDS = {1: "one", 2: "two", 3: "three"}


class DealError(Exception):
    """A deal configuration that breaks the locked rules."""


# ---------------------------------------------------------------------------
# Suggested shopper wording (Master: "Suggested output")
# ---------------------------------------------------------------------------
def _money(value) -> str:
    amount = Decimal(value).quantize(CENT)
    return f"${amount:.0f}" if amount == amount.to_integral_value() else f"${amount:.2f}"


def suggested_wording(*, deal_type, product_name, max_rebate=None,
                      fixed_reward=None, required_quantity=1) -> tuple[str, str]:
    """Nibbl's suggested headline and description for a deal type."""
    name = product_name or "this product"
    if deal_type == Campaign.DealType.FREE:
        cap = _money(max_rebate)
        return (
            f"Free {name} up to {cap}",
            f"Buy one eligible {name} product and receive the verified "
            f"purchase price back, up to {cap}.",
        )
    if deal_type == Campaign.DealType.BOGO_FREE:
        cap = _money(max_rebate)
        return (
            f"Buy 1 {name}, Get 1 Free",
            f"Buy two eligible {name} products and receive the lower-priced "
            f"product free, up to {cap}.",
        )
    if deal_type == Campaign.DealType.BOGO_HALF:
        cap = _money(max_rebate)
        return (
            f"Buy 1 {name}, Get 1 50% Off",
            f"Buy two eligible {name} products and receive 50% back on the "
            f"lower-priced product, up to {cap}.",
        )
    qty = int(required_quantity or 1)
    reward = _money(fixed_reward)
    noun = "product" if qty == 1 else "products"
    receipt = "" if qty == 1 else " on the same receipt"
    return (
        f"Buy {qty} {name}, Get {reward} Back",
        f"Buy {_WORDS.get(qty, qty)} eligible {name} {noun}{receipt} and "
        f"receive {reward} back.",
    )


def suggested_wording_for(campaign: Campaign) -> tuple[str, str]:
    product = campaign.products.first() if campaign.pk else None
    return suggested_wording(
        deal_type=campaign.deal_type,
        product_name=product.name if product else "",
        max_rebate=campaign.max_rebate,
        fixed_reward=campaign.fixed_reward,
        required_quantity=campaign.required_quantity,
    )


# ---------------------------------------------------------------------------
# Money + 25-Hour Claim Capacity
# ---------------------------------------------------------------------------
def max_reward(campaign: Campaign) -> Decimal | None:
    """Most one redemption can pay (what a claim reserves); None until set."""
    if campaign.deal_type == Campaign.DealType.BUY_X_GET_Y:
        value = campaign.fixed_reward
    else:
        value = campaign.max_rebate
    return Decimal(value).quantize(CENT) if value is not None else None


def compute_claim_capacity(desired_redemptions, rate_percent) -> int:
    """Desired Redemptions ÷ Estimated Redemption Rate, rounded up.
    e.g. 10 ÷ 30% = 34 claims per cycle."""
    return math.ceil(Decimal(desired_redemptions) * 100 / Decimal(rate_percent))


def cycle_start(campaign: Campaign, now=None):
    """Start of the current 25-hour cycle (anchored at activation), or None."""
    if campaign.activated_at is None:
        return None
    now = now or timezone.now()
    elapsed = max(now - campaign.activated_at, dt.timedelta(0))
    return campaign.activated_at + CYCLE * (elapsed // CYCLE)


def claims_this_cycle(campaign: Campaign, now=None) -> int:
    """Every claim made this cycle counts — expired or abandoned claims never
    give their slot back."""
    from Apps.reservations.models import Reservation

    start = cycle_start(campaign, now)
    if start is None:
        return 0
    return Reservation.objects.filter(campaign=campaign, created_at__gte=start).count()


def capacity_remaining(campaign: Campaign, now=None) -> int | None:
    """Claims still available this cycle; None when no capacity is set."""
    if not campaign.claim_capacity:
        return None
    return max(campaign.claim_capacity - claims_this_cycle(campaign, now), 0)


# ---------------------------------------------------------------------------
# Validation + derived fields
# ---------------------------------------------------------------------------
def normalize(campaign: Campaign) -> None:
    """Fill fields derived from the deal: unused amounts cleared, unit count,
    claim capacity, and the legacy is_bogo / min_purchase_units mirrors that
    the shopper API and receipt checks still read."""
    deal = campaign.deal_type
    if deal == Campaign.DealType.BUY_X_GET_Y:
        campaign.max_rebate = None
    else:
        campaign.fixed_reward = None
        campaign.required_quantity = rm.required_units(deal)
    campaign.is_bogo = deal in BOGO_TYPES
    campaign.min_purchase_units = rm.required_units(deal, campaign.required_quantity)
    if campaign.desired_redemptions and campaign.estimated_redemption_rate:
        campaign.claim_capacity = compute_claim_capacity(
            campaign.desired_redemptions, campaign.estimated_redemption_rate
        )


def validate(campaign: Campaign) -> None:
    deal = campaign.deal_type
    if deal not in Campaign.DealType.values:
        raise DealError("Choose a valid offer type.")
    if deal == Campaign.DealType.BUY_X_GET_Y:
        if not campaign.fixed_reward or campaign.fixed_reward <= 0:
            raise DealError("Enter the fixed reward for Buy X, Get $Y Off.")
        if campaign.required_quantity not in (1, 2, 3):
            raise DealError("Required quantity must be 1, 2 or 3.")
    elif not campaign.max_rebate or campaign.max_rebate <= 0:
        raise DealError("Enter the maximum rebate.")
    if campaign.desired_redemptions is not None and campaign.desired_redemptions < 1:
        raise DealError("Desired redemptions must be at least 1.")
    rate = campaign.estimated_redemption_rate
    if rate is not None and not (Decimal("0") < rate <= Decimal("100")):
        raise DealError("Estimated redemption rate must be between 0% and 100%.")


def validate_cooldown(cooldown_days, one_time_only) -> None:
    """Master's cooldown options: none, 30 (recommended), 60, 90, or one time."""
    if not one_time_only and cooldown_days not in ALLOWED_COOLDOWN_DAYS:
        raise DealError("Cooldown must be none, 30, 60 or 90 days, or one time per customer.")


def apply_legacy_inputs(campaign: Campaign) -> None:
    """Map the old builder's inputs onto the deal model: the top reward tier
    becomes the maximum rebate, and the $ daily budget becomes a 25-hour
    capacity of budget ÷ max rebate claims (at a 100% redemption rate)."""
    top = campaign.tiers.order_by("-reward_amount").first()
    if top is not None and campaign.deal_type != Campaign.DealType.BUY_X_GET_Y:
        campaign.max_rebate = top.reward_amount
    cap = max_reward(campaign)
    if campaign.daily_budget and cap:
        campaign.desired_redemptions = max(1, int(campaign.daily_budget // cap))
        campaign.estimated_redemption_rate = Decimal("100.00")
    legacy_units = campaign.min_purchase_units
    normalize(campaign)
    # Keep the old builder's minimum-units requirement (receipt check only;
    # the reward is still one unit's price, capped).
    campaign.min_purchase_units = max(campaign.min_purchase_units, legacy_units or 1)
    if not campaign.offer_headline and cap:
        campaign.offer_headline, campaign.offer_description = suggested_wording_for(campaign)
