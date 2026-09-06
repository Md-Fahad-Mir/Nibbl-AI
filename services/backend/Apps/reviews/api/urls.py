from django.urls import path

from Apps.reviews.api import views

app_name = "reviews"

urlpatterns = [
    # Consumer: generate (POST) + list own reviews (GET)
    path("reviews/", views.ReviewListCreateView.as_view(), name="review-list"),
    # Public product reviews + aggregate (consumer Screen 4)
    path(
        "products/<uuid:product_id>/reviews/",
        views.ProductReviewsView.as_view(),
        name="product-reviews",
    ),
    path(
        "products/<uuid:product_id>/review-summary/",
        views.ProductReviewSummaryView.as_view(),
        name="product-review-summary",
    ),
]
