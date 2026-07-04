"""Read-side queries for the reviews module."""

from django.db.models import Avg, Count

from Apps.reviews.models import (
    Review,
    ReviewCampaign,
    ReviewSession,
)


def product_rating_summary(product_id) -> dict:
    """Average rating + count of *published* reviews for a product or products."""
    if isinstance(product_id, (list, tuple, set)):
        filter_kwargs = {"product_id__in": product_id}
    else:
        filter_kwargs = {"product_id": product_id}
    agg = Review.objects.filter(
        status=Review.Status.PUBLISHED, **filter_kwargs
    ).aggregate(avg=Avg("rating"), count=Count("id"))
    avg = agg["avg"]
    return {
        "rating": round(float(avg), 2) if avg is not None else None,
        "review_count": agg["count"] or 0,
    }


def published_reviews_for_product(product_id):
    """Public, published reviews for a product (newest first)."""
    return (
        Review.objects.filter(product_id=product_id, status=Review.Status.PUBLISHED)
        .select_related("user", "product")
        .order_by("-published_at", "-created_at")
    )


def review_campaigns_for_brand(brand):
    return ReviewCampaign.objects.filter(brand=brand).prefetch_related("products")


def get_brand_review_campaign(brand, campaign_id) -> ReviewCampaign | None:
    return ReviewCampaign.objects.filter(brand=brand, id=campaign_id).first()


def active_sessions_for_user(user):
    return (
        ReviewSession.objects.filter(user=user, status=ReviewSession.Status.ACTIVE)
        .select_related("review_campaign", "product")
        .prefetch_related("review_campaign__prompts")
    )


def get_user_session(user, session_id) -> ReviewSession | None:
    return (
        ReviewSession.objects.filter(user=user, id=session_id)
        .select_related("review_campaign", "product")
        .prefetch_related("review_campaign__prompts")
        .first()
    )


def reviews_for_user(user):
    return Review.objects.filter(user=user).select_related("product", "review_campaign")


def reviews_for_brand(brand, *, status: str = ""):
    qs = Review.objects.filter(review_campaign__brand=brand).select_related(
        "product", "user", "review_campaign"
    )
    if status:
        qs = qs.filter(status=status)
    return qs


def get_brand_review(brand, review_id) -> Review | None:
    return Review.objects.filter(
        review_campaign__brand=brand, id=review_id
    ).select_related("review_campaign").first()
