"""Read-side queries for the consumer offer feed."""

from django.db.models import Q

from Apps.brands.models import Brand
from Apps.campaigns.models import Campaign
from Apps.offers.models import Bookmark


def active_offers(*, search: str = "", category: str = ""):
    """Active campaigns from operational brands, optionally filtered.

    'explore' (or empty) means all categories.
    """
    qs = (
        Campaign.objects.filter(
            status=Campaign.Status.ACTIVE, brand__status=Brand.Status.ACTIVE
        )
        .select_related("brand", "restriction", "fallback_offer")
        .prefetch_related("tiers", "products")
    )
    if category and category.lower() not in ("explore", "all"):
        qs = qs.filter(products__category__iexact=category)
    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(brand__name__icontains=search)
            | Q(products__name__icontains=search)
        ).distinct()
    return qs.order_by("-created_at")


def bookmarks_for_user(user):
    return Bookmark.objects.filter(user=user).select_related("product", "brand")


def saved_offers_for_user(user) -> list[dict]:
    """Resolve a user's bookmarked products into active offer cards.

    Returns one card per active campaign whose product the user bookmarked,
    each carrying the originating ``bookmark_id`` (so the card can be removed).
    Inactive campaigns / suspended brands are excluded.
    """
    # Local import avoids an offers.services <-> offers.selectors cycle.
    from Apps.offers.services import resolve_offer

    product_to_bookmark = {
        b["product_id"]: str(b["id"])
        for b in Bookmark.objects.filter(
            user=user, product__isnull=False
        ).values("id", "product_id")
    }
    if not product_to_bookmark:
        return []

    campaigns = (
        Campaign.objects.filter(
            status=Campaign.Status.ACTIVE,
            brand__status=Brand.Status.ACTIVE,
            products__id__in=product_to_bookmark.keys(),
        )
        .select_related("brand", "restriction", "fallback_offer")
        .prefetch_related("tiers", "products")
        .order_by("-created_at")
        .distinct()
    )

    cards = []
    for campaign in campaigns:
        data = resolve_offer(campaign, user)
        matching_product_id = campaign.products.filter(id__in=product_to_bookmark.keys()).values_list("id", flat=True).first()
        data["bookmark_id"] = product_to_bookmark.get(matching_product_id)
        # `discount_label` is intentionally null until the "% OFF" product
        # decision lands; the key is present so the FE contract is stable.
        data["discount_label"] = None
        cards.append(data)
    return cards
