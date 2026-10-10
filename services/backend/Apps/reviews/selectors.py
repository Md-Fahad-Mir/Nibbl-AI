"""Read-side queries for the reviews module."""

from django.db.models import Avg, Count

from Apps.products.models import Product
from Apps.reviews.models import Review


def get_reviewable_product(product_id) -> Product | None:
    return Product.objects.filter(id=product_id, is_active=True).select_related("brand").first()


def product_rating_summary(product_id) -> dict:
    """Average rating + count of reviews for a product or products."""
    if isinstance(product_id, (list, tuple, set)):
        filter_kwargs = {"product_id__in": product_id}
    else:
        filter_kwargs = {"product_id": product_id}
    # Only published reviews affect ratings (Master).
    agg = Review.objects.filter(status=Review.Status.PUBLISHED, **filter_kwargs).aggregate(
        avg=Avg("rating"), count=Count("id")
    )
    avg = agg["avg"]
    return {
        "rating": round(float(avg), 2) if avg is not None else None,
        "review_count": agg["count"] or 0,
    }


SORTS = {
    "newest": ("-published_at", "-created_at"),
    "highest": ("-rating", "-published_at"),
    "lowest": ("rating", "-published_at"),
    "helpful": ("-helpful_count", "-published_at"),
}


def reviews_for_product(product_id, sort: str = "newest"):
    """Published reviews for a product (Master sorts: newest / highest /
    lowest / most helpful)."""
    return (
        Review.objects.filter(product_id=product_id, status=Review.Status.PUBLISHED)
        .select_related("user", "product", "session")
        .order_by(*SORTS.get(sort, SORTS["newest"]))
    )


def product_review_overview(product_id) -> dict:
    """Lifetime rating, star distribution, recommendation rate and the AI
    summary (Master: Reviews Overview + AI Summary)."""
    from Apps.reviews import review_writer

    published = Review.objects.filter(product_id=product_id, status=Review.Status.PUBLISHED)
    distribution = {str(star): 0 for star in range(1, 6)}
    for rating, count in published.values_list("rating").annotate(c=Count("id")).values_list("rating", "c"):
        distribution[str(rating)] = count
    answered = published.exclude(would_recommend__isnull=True)
    recommend = (
        round(answered.filter(would_recommend=True).count() * 100 / answered.count(), 1)
        if answered.exists() else None
    )
    product = Product.objects.filter(id=product_id).first()
    summary = None
    if product is not None and published.exists():
        # Refreshes whenever the published reviews change (Master).
        from django.core.cache import cache

        latest = published.order_by("-updated_at").values_list("updated_at", flat=True).first()
        key = f"review-summary:{product_id}:{published.count()}:{latest.timestamp() if latest else 0}"
        summary = cache.get(key)
        if summary is None:
            summary = review_writer.summarize_reviews(
                product_name=product.name,
                reviews=[{"rating": r, "title": t, "body": b} for r, t, b in
                         published.order_by("-published_at").values_list("rating", "title", "content")[:200]],
            )
            if summary is not None:
                cache.set(key, summary, 60 * 60 * 24)
    return {
        **product_rating_summary(product_id),
        "star_distribution": distribution,
        "recommendation_rate": recommend,
        "ai_summary": summary,
    }


def reviews_for_user(user):
    return Review.objects.filter(user=user).select_related("product", "brand")


def reviews_for_brand(brand):
    return Review.objects.filter(brand=brand).select_related("product", "user")


def get_user_review(user, product_id) -> Review | None:
    return Review.objects.filter(user=user, product_id=product_id).first()
