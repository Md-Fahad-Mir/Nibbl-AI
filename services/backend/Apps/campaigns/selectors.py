"""Read-side queries for campaigns (brand-scoped)."""

from Apps.campaigns.models import Campaign


def campaigns_for_brand(brand):
    return Campaign.objects.filter(brand=brand).prefetch_related("products")


def get_brand_campaign(brand, campaign_id) -> Campaign | None:
    return Campaign.objects.filter(brand=brand, id=campaign_id).first()


def best_tier(campaign):
    """The premium (highest reward) tier, or None if no tiers configured."""
    return campaign.tiers.first()  # ordered by -reward_amount
