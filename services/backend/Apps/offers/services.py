"""Consumer offer logic: cooldown, best-offer resolution, bookmarks, views."""

from __future__ import annotations

import datetime as dt

from django.utils import timezone

from Apps.brands.models import Brand
from Apps.campaigns.models import Campaign
from Apps.offers.models import Bookmark, CooldownRecord, OfferView
from Apps.products.models import Product


class OfferError(Exception):
    """Expected, user-facing offer errors (mapped to HTTP 400)."""


# ---------------------------------------------------------------------------
# Cooldown
# ---------------------------------------------------------------------------
def is_in_cooldown(user, campaign: Campaign) -> bool:
    if user is None or not user.is_authenticated:
        return False
    return CooldownRecord.objects.filter(
        user=user, campaign=campaign, expires_at__gt=timezone.now()
    ).exists()


# "One time per customer" never lets the shopper redeem that campaign again.
ONE_TIME_COOLDOWN = dt.timedelta(days=365 * 100)


def enter_cooldown(user, campaign: Campaign, *, days=None, one_time=False) -> CooldownRecord | None:
    """Start the campaign cooldown after an approved redemption. ``days`` /
    ``one_time`` come from the claim's snapshotted terms (default: the
    campaign's current setting). No cooldown (0 days) records nothing."""
    days = campaign.cooldown_days if days is None else days
    if not one_time and not days:
        return None
    now = timezone.now()
    length = ONE_TIME_COOLDOWN if one_time else dt.timedelta(days=days)
    return CooldownRecord.objects.create(
        user=user, campaign=campaign, started_at=now, expires_at=now + length
    )


# ---------------------------------------------------------------------------
# Offer resolution (best available offer / fallback)
# ---------------------------------------------------------------------------
def resolve_offer(campaign: Campaign, user=None) -> dict:
    """Compute the offer to show a given user for a campaign.

    Claimable when the campaign is live, the shopper isn't in cooldown, and
    the current 25-hour cycle still has claim capacity. ``reward_amount`` is
    the most one redemption can pay (the actual reward comes from the
    verified receipt). Shoppers never see claim counts — only "going fast"
    and "temporarily unavailable" flags.
    """
    # Local imports avoid import cycles (reviews/reservations don't import offers).
    from Apps.campaigns import deals
    from Apps.reservations.selectors import active_reservation_for
    from Apps.reviews.selectors import product_rating_summary

    in_cd = is_in_cooldown(user, campaign)
    amount = deals.max_reward(campaign)
    remaining = deals.capacity_remaining(campaign)
    capacity_reached = remaining is not None and remaining <= 0
    going_fast = (
        remaining is not None and 0 < remaining
        and remaining <= max(1, -(-campaign.claim_capacity // 5))  # last 20%
    )

    available = campaign.is_live and bool(amount) and not in_cd and not capacity_reached
    offer_type = "premium" if available else None
    amount = amount if available else None

    restriction = getattr(campaign, "restriction", None)

    # Card credibility (Screens 1, 2, 4) — published-review aggregate.
    # Card credibility (Screens 1, 2, 4) — published-review aggregate.
    product_ids = list(campaign.products.values_list("id", flat=True))
    summary = product_rating_summary(product_ids)
    # Claim state (Screen 2 CTA) — the user's live reservation for this campaign.
    reservation = active_reservation_for(user, campaign)

    first_product = campaign.products.first()
    product_id = str(first_product.id) if first_product else None
    product_name = first_product.name if first_product else ""
    product_image = (
        first_product.image_url.url
        if first_product and first_product.image_url
        else ""
    )
    product_category = first_product.category if first_product else ""

    return {
        "campaign_id": str(campaign.id),
        "name": campaign.name,
        "brand_id": str(campaign.brand_id),
        "brand_name": campaign.brand.name,
        "product_id": product_id,
        "product_name": product_name,
        "product_image": product_image,
        "category": product_category,
        "offer_type": offer_type,
        "reward_amount": str(amount) if amount is not None else None,
        "restriction": restriction.description if restriction else "",
        "min_purchase_units": campaign.min_purchase_units,
        "is_bogo": campaign.is_bogo,
        "in_cooldown": in_cd,
        "claimable": offer_type is not None,
        "end_at": campaign.end_at,
        "rating": summary["rating"],
        "review_count": summary["review_count"],
        "is_claimed": reservation is not None,
        "reservation_id": str(reservation.id) if reservation else None,
        # Deal model (Master: Offer Type Inputs and Shopper Output).
        "deal_type": campaign.deal_type,
        "offer_headline": campaign.offer_headline,
        "offer_description": campaign.offer_description,
        "required_quantity": campaign.min_purchase_units,
        "going_fast": going_fast,
        "temporarily_unavailable": capacity_reached,
    }


def record_view(*, user, campaign: Campaign, source: str) -> OfferView:
    return OfferView.objects.create(
        user=user if (user and user.is_authenticated) else None,
        campaign=campaign,
        source=source,
    )


# ---------------------------------------------------------------------------
# Bookmarks
# ---------------------------------------------------------------------------
def add_bookmark(*, user, kind: str, product_id=None, brand_id=None) -> Bookmark:
    if kind == Bookmark.Kind.PRODUCT:
        if not product_id:
            raise OfferError("product is required to bookmark a product.")
        product = Product.objects.filter(id=product_id, is_active=True).first()
        if product is None:
            raise OfferError("Product not found.")
        bookmark, _ = Bookmark.objects.get_or_create(
            user=user, product=product, defaults={"kind": Bookmark.Kind.PRODUCT}
        )
        return bookmark

    if kind == Bookmark.Kind.BRAND:
        if not brand_id:
            raise OfferError("brand is required to bookmark a brand.")
        brand = Brand.objects.filter(
            id=brand_id, status=Brand.Status.ACTIVE
        ).first()
        if brand is None:
            raise OfferError("Brand not found.")
        bookmark, _ = Bookmark.objects.get_or_create(
            user=user, brand=brand, defaults={"kind": Bookmark.Kind.BRAND}
        )
        return bookmark

    raise OfferError("Invalid bookmark kind.")


def remove_bookmark(bookmark: Bookmark) -> None:
    bookmark.delete()


# ---------------------------------------------------------------------------
# Offer save + consumer details
# ---------------------------------------------------------------------------
# Platform-constant explainer shown on consumer offer/campaign pages (Screen 4).
HOW_IT_WORKS = [
    {"icon": "gift", "text": "Buy this product at any participating store or online retailer."},
    {"icon": "upload", "text": "Upload your receipt through NibblAI to verify your purchase."},
    {"icon": "wallet", "text": "Receive your instant reward directly in your Nibbl wallet."},
]


def save_offer(*, user, campaign: Campaign) -> Bookmark:
    """'Save My Reward' — offers are dynamic, so we save the underlying product."""
    first_product = campaign.products.first()
    return add_bookmark(
        user=user, kind=Bookmark.Kind.PRODUCT, product_id=first_product.id if first_product else None
    )


def build_offer_details(campaign: Campaign, user=None) -> dict:
    """Consumer campaign-detail content: offer resolution + description + steps."""
    data = resolve_offer(campaign, user)
    data["description"] = campaign.description
    data["how_it_works"] = HOW_IT_WORKS
    return data
