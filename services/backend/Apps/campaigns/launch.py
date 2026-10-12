"""Wallet funding before launch (Master Brand Onboarding ⑪).

A campaign can't be submitted for Nibbl review — and so can't launch — until
Available Funds cover the estimated 7-day requirement (every active campaign
plus this one) and auto-replenishment is enabled with a saved card."""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings

from Apps.common.money import ZERO, to_money


def campaign_seven_day_need(campaign) -> Decimal:
    from Apps.billing.services import rebate_processing_fee
    from Apps.campaigns import deals
    from Apps.wallets.statements import CYCLES_PER_WEEK

    plan = campaign.brand.plan
    reward = deals.max_reward(campaign) or ZERO
    fee = rebate_processing_fee(plan, reward) if plan else ZERO
    return to_money((reward + fee) * (campaign.claim_capacity or 0) * CYCLES_PER_WEEK)


def readiness(campaign) -> dict:
    from Apps.billing.models import AutoRefill
    from Apps.campaigns.models import Campaign
    from Apps.wallets.services import get_or_create_brand_wallet
    from Apps.wallets.statements import campaign_funding

    brand = campaign.brand
    funding = campaign_funding(brand)  # active campaigns
    this_need = campaign_seven_day_need(campaign)
    requirement = Decimal(funding["seven_day_need"]) + (ZERO if campaign.status == Campaign.Status.ACTIVE else this_need)
    available = to_money(get_or_create_brand_wallet(brand).reward_available())
    refill = AutoRefill.objects.filter(brand=brand).first()
    auto_on = bool(refill and refill.enabled and refill.stripe_payment_method_id and refill.amount > ZERO)
    funded = available >= requirement
    return {
        "campaign_need": str(this_need),
        "seven_day_requirement": str(to_money(requirement)),
        "available": str(available),
        "minimum_needed": str(to_money(max(requirement - available, ZERO))),
        "auto_refill_enabled": auto_on,
        "auto_refill_amount": str(refill.amount) if refill else "0.00",
        "recommended_refill": str(to_money(max(requirement, this_need))),
        "payment_method_id": refill.stripe_payment_method_id if refill else "",
        "funded": funded,
        "ready": funded and auto_on,
    }


def require_ready(campaign) -> None:
    from Apps.campaigns.services import CampaignError

    if not getattr(settings, "LAUNCH_FUNDING_REQUIRED", True):
        return
    state = readiness(campaign)
    if not state["funded"]:
        raise CampaignError(
            f"Fund your campaign before launch: add at least ${state['minimum_needed']} so your wallet covers the "
            f"estimated 7-day requirement (${state['seven_day_requirement']})."
        )
    if not state["auto_refill_enabled"]:
        raise CampaignError("Enable auto-replenishment with a saved card before submitting this campaign.")
