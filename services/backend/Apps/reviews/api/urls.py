from django.urls import path

from Apps.reviews.api import views

app_name = "reviews"

_rc = "brands/<uuid:brand_id>/review-campaigns"

urlpatterns = [
    # Brand: review campaigns
    path(f"{_rc}/", views.ReviewCampaignListCreateView.as_view(), name="campaign-list"),
    path(f"{_rc}/<uuid:campaign_id>/", views.ReviewCampaignDetailView.as_view(), name="campaign-detail"),
    path(f"{_rc}/<uuid:campaign_id>/image/", views.ReviewCampaignImageView.as_view(), name="campaign-image"),
    path(f"{_rc}/<uuid:campaign_id>/products/", views.ReviewCampaignProductsView.as_view(), name="campaign-products"),
    path(f"{_rc}/<uuid:campaign_id>/prompts/", views.ReviewCampaignPromptsView.as_view(), name="campaign-prompts"),
    path(f"{_rc}/<uuid:campaign_id>/prompts/<uuid:prompt_id>/", views.ReviewCampaignPromptDeleteView.as_view(), name="campaign-prompt"),
    path(f"{_rc}/<uuid:campaign_id>/generate-prompts/", views.ReviewCampaignSuggestPromptsView.as_view(), name="campaign-suggest-prompts"),
    path(f"{_rc}/<uuid:campaign_id>/<str:action>/", views.ReviewCampaignActionView.as_view(), name="campaign-action"),
    # Brand: review management
    path("brands/<uuid:brand_id>/reviews/", views.BrandReviewListView.as_view(), name="brand-review-list"),
    path("brands/<uuid:brand_id>/reviews/export/", views.BrandReviewExportView.as_view(), name="brand-review-export"),
    path("brands/<uuid:brand_id>/reviews/<uuid:review_id>/<str:action>/", views.BrandReviewActionView.as_view(), name="brand-review-action"),
    # Admin: brand-flagged reviews
    path("admin/reviews/flagged/", views.AdminFlaggedReviewListView.as_view(), name="admin-flagged"),
    path("admin/reviews/<uuid:review_id>/<str:action>/", views.AdminFlagDecisionView.as_view(), name="admin-flag-decision"),
    # Shopper: opportunities + conversation
    path("reviews/opportunities/", views.ReviewOpportunitiesView.as_view(), name="opportunities"),
    path("reviews/sessions/<uuid:session_id>/", views.ReviewSessionDetailView.as_view(), name="session-detail"),
    path("reviews/sessions/<uuid:session_id>/answer/", views.ReviewSessionAnswerView.as_view(), name="session-answer"),
    path("reviews/sessions/<uuid:session_id>/regenerate/", views.ReviewSessionRegenerateView.as_view(), name="session-regenerate"),
    path("reviews/sessions/<uuid:session_id>/submit/", views.ReviewSessionSubmitView.as_view(), name="session-submit"),
    path("reviews/<uuid:review_id>/helpful/", views.ReviewHelpfulView.as_view(), name="review-helpful"),
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
