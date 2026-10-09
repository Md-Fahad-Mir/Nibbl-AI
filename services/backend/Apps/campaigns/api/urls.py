from django.urls import path

from Apps.campaigns.api import views

app_name = "campaigns"

_base = "brands/<uuid:brand_id>/campaigns"

urlpatterns = [
    path("retailers/", views.RetailerListView.as_view(), name="retailer-list"),
    path("brands/<uuid:brand_id>/retailers/", views.BrandRetailerCreateView.as_view(), name="brand-retailer-create"),
    path(f"{_base}/", views.CampaignListCreateView.as_view(), name="campaign-list"),
    path(
        f"{_base}/<uuid:campaign_id>/",
        views.CampaignDetailView.as_view(),
        name="campaign-detail",
    ),
    path(
        f"{_base}/<uuid:campaign_id>/tiers/",
        views.CampaignTiersView.as_view(),
        name="campaign-tiers",
    ),
    path(
        f"{_base}/<uuid:campaign_id>/fallback/",
        views.CampaignFallbackView.as_view(),
        name="campaign-fallback",
    ),
    path(
        f"{_base}/<uuid:campaign_id>/activate/",
        views.CampaignActivateView.as_view(),
        name="campaign-activate",
    ),
    path(
        f"{_base}/<uuid:campaign_id>/submit/",
        views.CampaignSubmitView.as_view(),
        name="campaign-submit",
    ),
    path(
        f"{_base}/<uuid:campaign_id>/image/",
        views.CampaignImageView.as_view(),
        name="campaign-image",
    ),
    path(
        f"{_base}/<uuid:campaign_id>/reviews/",
        views.CampaignReviewListView.as_view(),
        name="campaign-reviews",
    ),
    path(
        f"{_base}/<uuid:campaign_id>/pause/",
        views.CampaignPauseView.as_view(),
        name="campaign-pause",
    ),
    path(
        f"{_base}/<uuid:campaign_id>/access/",
        views.CampaignAccessView.as_view(),
        name="campaign-access",
    ),
    path(
        f"{_base}/<uuid:campaign_id>/preview/",
        views.CampaignPreviewView.as_view(),
        name="campaign-preview",
    ),
]
