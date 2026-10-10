from django.urls import path

from Apps.analytics.api import views

app_name = "analytics"

_ba = "brands/<uuid:brand_id>/analytics"

urlpatterns = [
    path(f"{_ba}/overview/", views.BrandOverviewView.as_view(), name="brand-overview"),
    path(f"{_ba}/dashboard/", views.BrandDashboardView.as_view(), name="brand-dashboard"),
    path(
        f"{_ba}/rebates/summary/",
        views.BrandRebatesSummaryView.as_view(),
        name="brand-rebates-summary",
    ),
    path(f"{_ba}/campaigns/", views.BrandCampaignAnalyticsView.as_view(), name="brand-campaigns"),
    path(f"{_ba}/products/", views.BrandProductAnalyticsView.as_view(), name="brand-products"),
    path("admin/analytics/overview/", views.PlatformOverviewView.as_view(), name="platform-overview"),
    path("admin/analytics/revenue/", views.AdminRevenueDashboardView.as_view(), name="admin-revenue"),
    path("admin/brand-discovery/", views.BrandDiscoveryView.as_view(), name="brand-discovery"),
    path("admin/brand-discovery/<str:brand>/", views.BrandDiscoveryInsightView.as_view(), name="brand-discovery-insight"),
    path("admin/analytics/snapshots/", views.PlatformSnapshotListView.as_view(), name="platform-snapshots"),
]
