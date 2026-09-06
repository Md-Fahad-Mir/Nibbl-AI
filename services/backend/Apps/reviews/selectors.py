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
    agg = Review.objects.filter(**filter_kwargs).aggregate(
        avg=Avg("rating"), count=Count("id")
    )
    avg = agg["avg"]
    return {
        "rating": round(float(avg), 2) if avg is not None else None,
        "review_count": agg["count"] or 0,
    }


def reviews_for_product(product_id):
    """Reviews for a product (newest first)."""
    return (
        Review.objects.filter(product_id=product_id)
        .select_related("user", "product")
        .order_by("-created_at")
    )


def reviews_for_user(user):
    return Review.objects.filter(user=user).select_related("product", "brand")


def reviews_for_brand(brand):
    return Review.objects.filter(brand=brand).select_related("product", "user")


def get_user_review(user, product_id) -> Review | None:
    return Review.objects.filter(user=user, product_id=product_id).first()
