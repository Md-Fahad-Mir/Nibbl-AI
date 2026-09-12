"""Root URL configuration for the NibblAI backend.

API routes are versioned under /api/v1/. Each app contributes its own
`api/urls.py`, included here as milestones land.
"""
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

#=====================================================================
# Redirect to Docs Settings
#=====================================================================  
def redirect_to_docs(request):
    """Redirect root URL to API documentation"""
    return redirect('swagger-ui')


api_v1_patterns = [
    path("", include("Apps.common.api.urls")),
    path("", include("Apps.accounts.api.urls")),
    path("", include("Apps.billing.api.urls")),
    path("", include("Apps.brands.api.urls")),
    path("", include("Apps.wallets.api.urls")),
    path("", include("Apps.products.api.urls")),
    path("", include("Apps.campaigns.api.urls")),
    path("", include("Apps.offers.api.urls")),
    path("", include("Apps.reservations.api.urls")),
    path("", include("Apps.receipts.api.urls")),
    path("", include("Apps.rebates.api.urls")),
    path("", include("Apps.reviews.api.urls")),
    path("", include("Apps.payouts.api.urls")),
    path("", include("Apps.notifications.api.urls")),
    path("", include("Apps.analytics.api.urls")),
    path("", include("Apps.admin_panel.api.urls")),
    path("", include("Apps.content.api.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1_patterns, "v1"))),
    # OpenAPI schema + interactive docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),

        # Root redirect
    path('', redirect_to_docs, name='root-redirect'),
]
