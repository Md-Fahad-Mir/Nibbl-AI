from django.urls import path

from Apps.rebates.api import views

app_name = "rebates"

urlpatterns = [
    path("redemptions/", views.RedemptionListView.as_view(), name="redemption-list"),
    path(
        "redemptions/<uuid:redemption_id>/",
        views.RedemptionDetailView.as_view(),
        name="redemption-detail",
    ),
    path(
        "brands/<uuid:brand_id>/redemptions/",
        views.BrandRedemptionListView.as_view(),
        name="brand-redemption-list",
    ),
    path(
        "brands/<uuid:brand_id>/redemptions/<uuid:redemption_id>/",
        views.BrandRedemptionDetailView.as_view(),
        name="brand-redemption-detail",
    ),
]
