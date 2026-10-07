from django.urls import path
from rest_framework.routers import DefaultRouter

from Apps.billing.api.views import (
    AddFundsView,
    AutoRefillView,
    PlanViewSet,
    SavedCardsView,
    SetupCardView,
    StripeWebhookView,
)

app_name = "billing"

router = DefaultRouter()
router.register("plans", PlanViewSet, basename="plan")

urlpatterns = [
    path(
        "brands/<uuid:brand_id>/billing/add-funds/",
        AddFundsView.as_view(),
        name="add-funds",
    ),
    path(
        "brands/<uuid:brand_id>/billing/setup-intent/",
        SetupCardView.as_view(),
        name="setup-card",
    ),
    path(
        "brands/<uuid:brand_id>/billing/cards/",
        SavedCardsView.as_view(),
        name="saved-cards",
    ),
    path(
        "brands/<uuid:brand_id>/billing/auto-refill/",
        AutoRefillView.as_view(),
        name="auto-refill",
    ),
    path(
        "billing/webhooks/stripe/",
        StripeWebhookView.as_view(),
        name="stripe-webhook",
    ),
    *router.urls,
]
