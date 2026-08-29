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


def enter_cooldown(user, campaign: Campaign) -> CooldownRecord:
    """Start a premium-reward cooldown. Called by the redemption flow (M7/M9)."""
    now = timezone.now()
    return CooldownRecord.objects.create(
        user=user,
        campaign=campaign,
        started_at=now,
        expires_at=now + dt.timedelta(days=campaign.cooldown_days),
    )


# ---------------------------------------------------------------------------
# Offer resolution (best available offer / fallback)
# ---------------------------------------------------------------------------
def resolve_offer(campaign: Campaign, user=None) -> dict:
    """Compute the offer to show a given user for a campaign.

    Premium (highest tier) is shown when the campaign is live, the user isn't
    in cooldown, and tiers exist. Otherwise the fallback offer is shown if the
    brand enabled it; else nothing is claimable.
    """
    # Local imports avoid import cycles (reviews/reservations don't import offers).
    from Apps.reservations.selectors import active_reservation_for
    from Apps.reviews.selectors import product_rating_summary

    in_cd = is_in_cooldown(user, campaign)

    tiers = list(campaign.tiers.all())  # ordered -reward_amount (waterfall)
    premium = tiers[0] if tiers else None
    fallback = getattr(campaign, "fallback_offer", None)
    fallback_active = bool(fallback and fallback.is_enabled)

    premium_available = campaign.is_live and premium is not None and not in_cd

    if premium_available:
        offer_type = "premium"
        amount = premium.reward_amount
    elif fallback_active:
        offer_type = "fallback"
        amount = fallback.reward_amount
    else:
        offer_type = None
        amount = None

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
