"""Business logic for rebate campaign configuration."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from Apps.campaigns import deals
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


# Deal-model fields a brand may set (Master builder ③④⑦⑧).
DEAL_FIELDS = (
    "deal_type", "max_rebate", "fixed_reward", "required_quantity",
    "offer_headline", "offer_description", "desired_redemptions",
    "estimated_redemption_rate", "cooldown_days", "one_time_only",
)


def _apply_deal(campaign: Campaign, *, regenerate_wording: bool) -> None:
    """Validate the deal, derive capacity etc., and fill suggested wording
    for anything the brand left blank (or when the offer type changed)."""
    deals.normalize(campaign)
    try:
        deals.validate(campaign)
        deals.validate_cooldown(campaign.cooldown_days, campaign.one_time_only)
    except deals.DealError as exc:
        raise CampaignError(str(exc))
    headline, description = deals.suggested_wording_for(campaign)
    if regenerate_wording or not campaign.offer_headline:
        campaign.offer_headline = headline
    if regenerate_wording or not campaign.offer_description:
        campaign.offer_description = description


@transaction.atomic
def create_campaign(*, brand, product_ids, name, daily_budget=None, description="",
                    min_purchase_units=1, is_bogo=False, cooldown_days=30,
                    start_at=None, end_at=None, **deal) -> Campaign:
    products = _resolve_products(brand, product_ids)
    deal = {k: v for k, v in deal.items() if k in DEAL_FIELDS and v is not None}
    is_deal_model = "deal_type" in deal

    if not is_deal_model:
        # Old builder: $ daily budget now; reward tiers arrive via set_tiers.
        if daily_budget is None:
            raise CampaignError("Choose an offer type.")
        daily_budget = to_money(daily_budget)
        if daily_budget <= ZERO:
            raise CampaignError("Daily budget must be positive.")

    campaign = Campaign(
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
    if is_deal_model:
        for key, value in deal.items():
            setattr(campaign, key, value)
    else:
        campaign.deal_type = (
            Campaign.DealType.BOGO_FREE if is_bogo else Campaign.DealType.FREE
        )
    campaign.save()
    campaign.products.set(products)
    if is_deal_model:
        _apply_deal(campaign, regenerate_wording=False)
        campaign.save()
    regenerate_restriction(campaign)
    ensure_access(campaign)
    return campaign


def update_campaign(campaign: Campaign, *, submitted_by=None, **fields) -> Campaign:
    """Edit a campaign. Once Nibbl has approved it, edits are held as a
    revision for re-review and the approved version stays live
    (Apps.campaigns.approvals)."""
    if campaign.status in (Campaign.Status.COMPLETED, Campaign.Status.ARCHIVED):
        raise CampaignError("This campaign can no longer be edited.")
    if campaign.review_status == Campaign.ReviewStatus.APPROVED:
        from Apps.campaigns import approvals

        if fields:
            approvals.propose_revision(campaign, fields, user=submitted_by)
        return campaign
    if campaign.review_status in (
        Campaign.ReviewStatus.PENDING_REVIEW, Campaign.ReviewStatus.REJECTED
    ):
        raise CampaignError(
            "This campaign is with Nibbl for review and can't be edited right now."
            if campaign.review_status == Campaign.ReviewStatus.PENDING_REVIEW
            else "This campaign was rejected and can no longer be edited."
        )
    return apply_update(campaign, **fields)


def apply_update(campaign: Campaign, **fields) -> Campaign:
    """Write edits straight to the campaign (drafts, or an approved revision)."""
    product_ids = fields.pop("product", None)
    if product_ids is not None:
        products = _resolve_products(campaign.brand, product_ids)

    if "daily_budget" in fields:
        fields["daily_budget"] = to_money(fields["daily_budget"])
        if fields["daily_budget"] <= ZERO:
            raise CampaignError("Daily budget must be positive.")

    deal_changed = any(key in DEAL_FIELDS for key in fields)
    # Changing the offer type regenerates the suggested wording unless the
    # brand sends its own in the same edit (the builder warns first).
    type_changed = (
        "deal_type" in fields and fields["deal_type"] != campaign.deal_type
        and "offer_headline" not in fields and "offer_description" not in fields
    )

    restriction_changed = deal_changed
    for key, value in fields.items():
        if key in ("min_purchase_units", "is_bogo"):
            restriction_changed = True
        setattr(campaign, key, value)

    if product_ids is not None:
        campaign.products.set(products)
    if deal_changed:
        _apply_deal(campaign, regenerate_wording=type_changed)
    elif "daily_budget" in fields:
        deals.apply_legacy_inputs(campaign)
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
def set_tiers(campaign: Campaign, tiers: list[dict], *, submitted_by=None) -> list[RewardTier]:
    if campaign.review_status in (
        Campaign.ReviewStatus.PENDING_REVIEW, Campaign.ReviewStatus.REJECTED
    ):
        raise CampaignError("This campaign can't be edited right now.")
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

    if campaign.review_status == Campaign.ReviewStatus.APPROVED:
        # Old builder on an approved campaign: the top tier is the new
        # maximum rebate, reviewed as a revision.
        from Apps.campaigns import approvals

        approvals.propose_revision(
            campaign, {"max_rebate": max(r for r, _ in cleaned)}, user=submitted_by
        )
        return list(campaign.tiers.all())

    campaign.tiers.all().delete()
    RewardTier.objects.bulk_create(
        [
            RewardTier(
                campaign=campaign, reward_amount=reward, allocation_percent=allocation
            )
            for reward, allocation in cleaned
        ]
    )
    # Old builder: the top tier becomes the deal's maximum rebate.
    deals.apply_legacy_inputs(campaign)
    campaign.save()
    regenerate_restriction(campaign)
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
def _funding_threshold(campaign: Campaign):
    """Real funds needed to run: a legacy campaign keeps its one-day budget;
    a deal-model campaign must cover at least one claim's maximum reward."""
    return campaign.daily_budget or deals.max_reward(campaign) or ZERO


def validate_ready(campaign: Campaign) -> None:
    """Every required field is complete (submission and activation)."""
    tiers = list(campaign.tiers.all())
    if tiers:
        total = sum((t.allocation_percent for t in tiers), Decimal("0.00"))
        if total != HUNDRED:
            raise CampaignError("Tier allocations must sum to 100% before activating.")
    elif campaign.daily_budget and not campaign.max_rebate and not campaign.fixed_reward:
        raise CampaignError("Add reward tiers before activating.")
    if not campaign.products.filter(is_active=True).exists():
        raise CampaignError("All products in this campaign are archived.")
    if not deals.max_reward(campaign):
        raise CampaignError("Set the offer's reward before activating.")
    if not campaign.claim_capacity:
        raise CampaignError("Set the 25-hour claim capacity before activating.")


def activate_campaign(campaign: Campaign) -> Campaign:
    if campaign.status in (Campaign.Status.COMPLETED, Campaign.Status.ARCHIVED):
        raise CampaignError("This campaign can no longer be activated.")
    if campaign.review_status != Campaign.ReviewStatus.APPROVED:
        raise CampaignError(
            "Nibbl must approve this campaign before it can go live. Submit it for review."
        )
    validate_ready(campaign)

    # Per-plan active-campaign limit (Starter 1 / Pro 3 / Scale 10).
    plan = campaign.brand.plan
    if plan and campaign.status != Campaign.Status.ACTIVE:
        active_count = campaign.brand.campaigns.filter(
            status=Campaign.Status.ACTIVE
        ).count()
        if active_count >= plan.max_active_campaigns:
            raise CampaignError(
                f"Your plan allows {plan.max_active_campaigns} active "
                "campaign(s). Pause one or upgrade to activate another."
            )

    wallet = get_or_create_brand_wallet(campaign.brand)
    # Campaigns pay shopper rewards, so they must be backed by real funds —
    # promotional credit can't be used to run a campaign.
    if wallet.reward_available() < _funding_threshold(campaign):
        raise CampaignError(
            "Insufficient wallet funds to run this campaign. "
            "Fund the wallet to cover at least one day's budget."
        )

    campaign.status = Campaign.Status.ACTIVE
    campaign.auto_paused = False
    fields = ["status", "auto_paused", "updated_at"]
    if campaign.activated_at is None:
        # 25-hour claim cycles are anchored to the first activation.
        campaign.activated_at = timezone.now()
        fields.append("activated_at")
    campaign.save(update_fields=fields)
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
    available = wallet.reward_available()
    summary = {"paused": 0, "resumed": 0}

    for campaign in brand.campaigns.filter(status=Campaign.Status.ACTIVE):
        if available < _funding_threshold(campaign):
            campaign.status = Campaign.Status.PAUSED
            campaign.auto_paused = True
            campaign.save(update_fields=["status", "auto_paused", "updated_at"])
            summary["paused"] += 1

    for campaign in brand.campaigns.filter(
        status=Campaign.Status.PAUSED, auto_paused=True
    ):
        if available >= _funding_threshold(campaign):
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
