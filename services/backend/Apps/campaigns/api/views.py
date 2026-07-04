"""Brand-scoped HTTP layer for rebate campaign configuration."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.brands.access import get_brand_or_404, require_membership
from Apps.campaigns import serializers as s
from Apps.campaigns import services
from Apps.campaigns.selectors import campaigns_for_brand, get_brand_campaign
from Apps.campaigns.services import CampaignError


def _run(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except CampaignError as exc:
        raise ValidationError({"detail": str(exc)})


def _get_campaign(brand, campaign_id):
    campaign = get_brand_campaign(brand, campaign_id)
    if campaign is None:
        raise NotFound("Campaign not found.")
    return campaign


@extend_schema(tags=["campaigns"])
class CampaignListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.CampaignSerializer(many=True)})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        return Response(
            s.CampaignSerializer(campaigns_for_brand(brand), many=True).data
        )

    @extend_schema(request=s.CampaignCreateSerializer, responses={201: s.CampaignSerializer})
    def post(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        serializer = s.CampaignCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        campaign = _run(
            services.create_campaign,
            brand=brand,
            product_ids=data.pop("product"),
            **data,
        )
        return Response(
            s.CampaignSerializer(campaign).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["campaigns"])
class CampaignDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.CampaignSerializer})
    def get(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        return Response(s.CampaignSerializer(_get_campaign(brand, campaign_id)).data)

    @extend_schema(request=s.CampaignUpdateSerializer, responses={200: s.CampaignSerializer})
    def patch(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _get_campaign(brand, campaign_id)
        serializer = s.CampaignUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = _run(services.update_campaign, campaign, **serializer.validated_data)
        return Response(s.CampaignSerializer(campaign).data)

    @extend_schema(responses={204: None})
    def delete(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        services.archive_campaign(_get_campaign(brand, campaign_id))
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["campaigns"])
class CampaignTiersView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.RewardTierSerializer(many=True)})
    def get(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        campaign = _get_campaign(brand, campaign_id)
        return Response(s.RewardTierSerializer(campaign.tiers.all(), many=True).data)

    @extend_schema(request=s.SetTiersSerializer, responses={200: s.RewardTierSerializer(many=True)})
    def put(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _get_campaign(brand, campaign_id)
        serializer = s.SetTiersSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tiers = _run(services.set_tiers, campaign, serializer.validated_data["tiers"])
        return Response(s.RewardTierSerializer(tiers, many=True).data)


@extend_schema(tags=["campaigns"])
class CampaignFallbackView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.SetFallbackSerializer, responses={200: s.FallbackOfferSerializer})
    def put(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _get_campaign(brand, campaign_id)
        serializer = s.SetFallbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fallback = _run(services.set_fallback, campaign, **serializer.validated_data)
        return Response(s.FallbackOfferSerializer(fallback).data)


@extend_schema(tags=["campaigns"])
class CampaignActivateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: s.CampaignSerializer})
    def post(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _run(services.activate_campaign, _get_campaign(brand, campaign_id))
        return Response(s.CampaignSerializer(campaign).data)


@extend_schema(tags=["campaigns"])
class CampaignPauseView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: s.CampaignSerializer})
    def post(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _run(services.pause_campaign, _get_campaign(brand, campaign_id))
        return Response(s.CampaignSerializer(campaign).data)


@extend_schema(tags=["campaigns"])
class CampaignAccessView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.CampaignAccessSerializer})
    def get(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        campaign = _get_campaign(brand, campaign_id)
        url, qr = services.ensure_access(campaign)
        return Response(
            s.CampaignAccessSerializer(
                {"campaign_url": url.full_url, "qr_data": qr.data}
            ).data
        )


@extend_schema(tags=["campaigns"])
class CampaignPreviewView(APIView):
    """Read-only preview — never consumes budget or creates reservations."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.CampaignPreviewSerializer})
    def get(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        preview = services.build_preview(_get_campaign(brand, campaign_id))
        return Response(s.CampaignPreviewSerializer(preview).data)
