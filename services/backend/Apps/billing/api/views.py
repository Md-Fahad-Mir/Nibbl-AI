import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ReadOnlyModelViewSet

from stripe import SignatureVerificationError

from Apps.billing import serializers as s
from Apps.billing import services, stripe_gateway
from Apps.billing.models import Plan
from Apps.billing.serializers import PlanSerializer
from Apps.billing.stripe_gateway import StripeNotConfigured
from Apps.brands.access import get_brand_or_404, require_membership

logger = logging.getLogger(__name__)


@extend_schema(tags=["plans"])
class PlanViewSet(ReadOnlyModelViewSet):
    """Public, read-only catalogue of subscription plans."""

    queryset = Plan.objects.filter(is_active=True)
    serializer_class = PlanSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    lookup_field = "slug"


@extend_schema(tags=["billing"], request=s.AddFundsSerializer, responses=s.TopupIntentSerializer)
class AddFundsView(APIView):
    """Start a card payment that funds the brand wallet (money in)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)

        payload = s.AddFundsSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        try:
            result = services.create_wallet_topup_intent(
                brand=brand, amount=payload.validated_data["amount"]
            )
        except StripeNotConfigured:
            return Response(
                {"detail": "Payments are not available right now."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(s.TopupIntentSerializer(result).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["billing"], request=None, responses={200: None})
class StripeWebhookView(APIView):
    """Receive Stripe webhook events (signature-verified). Public endpoint."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        sig_header = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        try:
            event = stripe_gateway.construct_event(request.body, sig_header)
        except StripeNotConfigured:
            return Response(
                {"detail": "Webhooks are not configured."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except (ValueError, SignatureVerificationError) as exc:  # bad payload or signature
            logger.warning("Stripe webhook verification failed: %s", exc)
            return Response(status=status.HTTP_400_BAD_REQUEST)

        services.handle_stripe_event(event)
        return Response(status=status.HTTP_200_OK)
