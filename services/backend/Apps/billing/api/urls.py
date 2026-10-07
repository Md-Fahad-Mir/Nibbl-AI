from django.urls import path
from rest_framework.routers import DefaultRouter

from Apps.billing.api.views import AddFundsView, PlanViewSet, StripeWebhookView

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
        "billing/webhooks/stripe/",
        StripeWebhookView.as_view(),
        name="stripe-webhook",
    ),
    *router.urls,
]
