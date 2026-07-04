"""Business logic for rebate campaign configuration."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction

from Apps.campaigns.models import (
    Campaign,
    CampaignURL,
    FallbackOffer,
    QRCode,
    Restriction,
    RewardTier,
)
from Apps.common.money import ZERO, to_money
from Apps.products.models import Product
from Apps.wallets.services import get_or_create_brand_wallet

HUNDRED = Decimal("100.00")


class CampaignError(Exception):
    """Expected, user-facing campaign errors (mapped to HTTP 400)."""


# ---------------------------------------------------------------------------
# Restriction (auto-generated, not brand-editable)
# ---------------------------------------------------------------------------
def regenerate_restriction(campaign: Campaign) -> Restriction:
    if campaign.is_bogo:
        rtype = Restriction.Type.BOGO
        min_units = max(campaign.min_purchase_units, 2)
        description = "Buy one, get one (BOGO)"
    elif campaign.min_purchase_units > 1:
        rtype = Restriction.Type.MIN_UNITS
        min_units = campaign.min_purchase_units
        description = f"Buy {campaign.min_purchase_units} units required"
    else:
        rtype = Restriction.Type.NONE
        min_units = 1
        description = "No minimum purchase"

    restriction, _ = Restriction.objects.update_or_create(
        campaign=campaign,
        defaults={
            "restriction_type": rtype,
            "min_units": min_units,
            "description": description,
        },
    )
    return restriction


# ---------------------------------------------------------------------------
# Access (URL + QR) — 1 each per campaign
# ---------------------------------------------------------------------------
def ensure_access(campaign: Campaign):
    url, _ = CampaignURL.objects.get_or_create(campaign=campaign)
    qr, _ = QRCode.objects.get_or_create(campaign=campaign)
    return url, qr


# ---------------------------------------------------------------------------
# Create / update
# ---------------------------------------------------------------------------
def _resolve_products(brand, product_ids) -> list[Product]:
    products = list(Product.objects.filter(
        id__in=product_ids, brand=brand, is_active=True
    ))
    if len(products) != len(set(product_ids)):
        raise CampaignError("One or more products not found in this brand's active library.")
    return products


@transaction.atomic
def create_campaign(*, brand, product_ids, name, daily_budget, description="",
                    min_purchase_units=1, is_bogo=False, cooldown_days=30,
                    start_at=None, end_at=None) -> Campaign:
    products = _resolve_products(brand, product_ids)
    daily_budget = to_money(daily_budget)
    if daily_budget <= ZERO:
        raise CampaignError("Daily budget must be positive.")

    campaign = Campaign.objects.create(
        brand=brand,
        name=name,
        description=description,
        daily_budget=daily_budget,
        min_purchase_units=min_purchase_units,
        is_bogo=is_bogo,
        cooldown_days=cooldown_days,
        start_at=start_at,
        end_at=end_at,
    )
    campaign.products.set(products)
    regenerate_restriction(campaign)
    ensure_access(campaign)
    return campaign


def update_campaign(campaign: Campaign, **fields) -> Campaign:
    if campaign.status in (Campaign.Status.COMPLETED, Campaign.Status.ARCHIVED):
        raise CampaignError("This campaign can no longer be edited.")

    if "daily_budget" in fields:
        fields["daily_budget"] = to_money(fields["daily_budget"])
        if fields["daily_budget"] <= ZERO:
            raise CampaignError("Daily budget must be positive.")

    restriction_changed = False
    for key, value in fields.items():
        if key in ("min_purchase_units", "is_bogo"):
            restriction_changed = True
        setattr(campaign, key, value)
    campaign.save()

    if restriction_changed:
        regenerate_restriction(campaign)
    return campaign


def archive_campaign(campaign: Campaign) -> Campaign:
    campaign.status = Campaign.Status.ARCHIVED
    campaign.auto_paused = False
    campaign.save(update_fields=["status", "auto_paused", "updated_at"])
    return campaign


# ---------------------------------------------------------------------------
# Tiers (allocation must total 100%)
# ---------------------------------------------------------------------------
@transaction.atomic
def set_tiers(campaign: Campaign, tiers: list[dict]) -> list[RewardTier]:
    if not tiers:
        raise CampaignError("At least one reward tier is required.")

    total = Decimal("0.00")
    cleaned = []
    for tier in tiers:
        reward = to_money(tier["reward_amount"])
        allocation = Decimal(str(tier["allocation_percent"])).quantize(Decimal("0.01"))
        if reward <= ZERO:
            raise CampaignError("Each tier reward must be positive.")
        if allocation <= ZERO:
            raise CampaignError("Each tier allocation must be positive.")
        total += allocation
        cleaned.append((reward, allocation))

    if total != HUNDRED:
        raise CampaignError(
            f"Tier allocations must sum to 100% (got {total}%)."
        )

    campaign.tiers.all().delete()
    RewardTier.objects.bulk_create(
        [
            RewardTier(
                campaign=campaign, reward_amount=reward, allocation_percent=allocation
            )
            for reward, allocation in cleaned
        ]
    )
    # Return in waterfall order (highest reward first) per Meta.ordering.
    return list(campaign.tiers.all())


# ---------------------------------------------------------------------------
# Fallback offer
# ---------------------------------------------------------------------------
def set_fallback(campaign: Campaign, *, reward_amount, is_enabled, description="") -> FallbackOffer:
    reward_amount = to_money(reward_amount)
    if reward_amount <= ZERO:
        raise CampaignError("Fallback reward must be positive.")
    fallback, _ = FallbackOffer.objects.update_or_create(
        campaign=campaign,
        defaults={
            "reward_amount": reward_amount,
            "is_enabled": is_enabled,
            "description": description,
        },
    )
    return fallback


# ---------------------------------------------------------------------------
# Lifecycle (activate / pause) with wallet funding gate
# ---------------------------------------------------------------------------
def _validate_ready_to_activate(campaign: Campaign) -> None:
    tiers = list(campaign.tiers.all())
    if not tiers:
        raise CampaignError("Add reward tiers before activating.")
    total = sum((t.allocation_percent for t in tiers), Decimal("0.00"))
    if total != HUNDRED:
        raise CampaignError("Tier allocations must sum to 100% before activating.")
    if not campaign.products.filter(is_active=True).exists():
        raise CampaignError("All products in this campaign are archived.")


def activate_campaign(campaign: Campaign) -> Campaign:
    if campaign.status in (Campaign.Status.COMPLETED, Campaign.Status.ARCHIVED):
        raise CampaignError("This campaign can no longer be activated.")
    _validate_ready_to_activate(campaign)

    wallet = get_or_create_brand_wallet(campaign.brand)
    if wallet.available() < campaign.daily_budget:
        raise CampaignError(
            "Insufficient wallet funds to run this campaign. "
            "Fund the wallet to cover at least one day's budget."
        )

    campaign.status = Campaign.Status.ACTIVE
    campaign.auto_paused = False
    campaign.save(update_fields=["status", "auto_paused", "updated_at"])
    return campaign


def pause_campaign(campaign: Campaign) -> Campaign:
    if campaign.status != Campaign.Status.ACTIVE:
        raise CampaignError("Only an active campaign can be paused.")
    campaign.status = Campaign.Status.PAUSED
    campaign.auto_paused = False  # manual pause
    campaign.save(update_fields=["status", "auto_paused", "updated_at"])
    return campaign


def sync_funding_state(brand) -> dict:
    """Pause active campaigns the wallet can no longer fund, and resume
    auto-paused ones once funds return. Idempotent."""
    wallet = get_or_create_brand_wallet(brand)
    available = wallet.available()
    summary = {"paused": 0, "resumed": 0}

    for campaign in brand.campaigns.filter(status=Campaign.Status.ACTIVE):
        if available < campaign.daily_budget:
            campaign.status = Campaign.Status.PAUSED
            campaign.auto_paused = True
            campaign.save(update_fields=["status", "auto_paused", "updated_at"])
            summary["paused"] += 1

    for campaign in brand.campaigns.filter(
        status=Campaign.Status.PAUSED, auto_paused=True
    ):
        if available >= campaign.daily_budget:
            campaign.status = Campaign.Status.ACTIVE
            campaign.auto_paused = False
            campaign.save(update_fields=["status", "auto_paused", "updated_at"])
            summary["resumed"] += 1

    return summary


# ---------------------------------------------------------------------------
# Preview (read-only — never consumes budget or creates reservations)
# ---------------------------------------------------------------------------
def build_preview(campaign: Campaign) -> dict:
    tiers = list(campaign.tiers.all())  # waterfall order (-reward_amount)
    best = tiers[0].reward_amount if tiers else None
    fallback = getattr(campaign, "fallback_offer", None)
    url, qr = ensure_access(campaign)
    return {
        "campaign": campaign,
        "tiers": tiers,
        "restriction": getattr(campaign, "restriction", None),
        "fallback_offer": fallback if (fallback and fallback.is_enabled) else None,
        "best_offer": best,
        "campaign_url": url.full_url,
        "qr_data": qr.data,
        "consumes_budget": False,
        "creates_reservation": False,
    }
