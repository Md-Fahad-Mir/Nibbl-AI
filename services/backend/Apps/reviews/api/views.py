"""HTTP layer for the reviews module (brand + consumer)."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.brands.access import get_brand_or_404, require_membership
from Apps.common.exceptions import DomainError
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.reviews import serializers as s
from Apps.reviews import services
from Apps.reviews.selectors import (
    active_sessions_for_user,
    get_brand_review,
    get_brand_review_campaign,
    get_user_session,
    product_rating_summary,
    published_reviews_for_product,
    review_campaigns_for_brand,
    reviews_for_brand,
    reviews_for_user,
)


def _run(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except DomainError as exc:
        raise ValidationError({"detail": str(exc)})


def _campaign(brand, campaign_id):
    campaign = get_brand_review_campaign(brand, campaign_id)
    if campaign is None:
        raise NotFound("Review campaign not found.")
    return campaign


# ---------------------------------------------------------------------------
# Brand: review campaign management
# ---------------------------------------------------------------------------
@extend_schema(tags=["review-campaigns"])
class ReviewCampaignListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewCampaignSerializer(many=True)})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        return Response(
            s.ReviewCampaignSerializer(review_campaigns_for_brand(brand), many=True).data
        )

    @extend_schema(request=s.CreateReviewCampaignSerializer, responses={201: s.ReviewCampaignSerializer})
    def post(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        serializer = s.CreateReviewCampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = _run(services.create_review_campaign, brand=brand, **serializer.validated_data)
        return Response(
            s.ReviewCampaignSerializer(campaign).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewCampaignSerializer})
    def get(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        return Response(s.ReviewCampaignSerializer(_campaign(brand, campaign_id)).data)

    @extend_schema(request=s.UpdateReviewCampaignSerializer, responses={200: s.ReviewCampaignSerializer})
    def patch(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _campaign(brand, campaign_id)
        serializer = s.UpdateReviewCampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = _run(services.update_review_campaign, campaign, **serializer.validated_data)
        return Response(s.ReviewCampaignSerializer(campaign).data)

    @extend_schema(responses={204: None})
    def delete(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        services.archive_review_campaign(_campaign(brand, campaign_id))
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignProductsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.SetProductsSerializer, responses={200: s.ReviewCampaignSerializer})
    def put(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _campaign(brand, campaign_id)
        serializer = s.SetProductsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = _run(services.set_products, campaign, serializer.validated_data["product_ids"])
        return Response(s.ReviewCampaignSerializer(campaign).data)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignPromptsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewPromptSerializer(many=True)})
    def get(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        campaign = _campaign(brand, campaign_id)
        return Response(s.ReviewPromptSerializer(campaign.prompts.all(), many=True).data)

    @extend_schema(request=s.AddPromptSerializer, responses={201: s.ReviewPromptSerializer})
    def post(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _campaign(brand, campaign_id)
        serializer = s.AddPromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prompt = services.add_custom_prompt(campaign, text=serializer.validated_data["text"])
        return Response(s.ReviewPromptSerializer(prompt).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignGeneratePromptsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.GeneratePromptsSerializer, responses={200: s.ReviewPromptSerializer(many=True)})
    def post(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _campaign(brand, campaign_id)
        serializer = s.GeneratePromptsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prompts = services.generate_ai_prompts(campaign, count=serializer.validated_data["count"])
        return Response(s.ReviewPromptSerializer(prompts, many=True).data)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignActivateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: s.ReviewCampaignSerializer})
    def post(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _run(services.activate_review_campaign, _campaign(brand, campaign_id))
        return Response(s.ReviewCampaignSerializer(campaign).data)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignPauseView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: s.ReviewCampaignSerializer})
    def post(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        campaign = _run(services.pause_review_campaign, _campaign(brand, campaign_id))
        return Response(s.ReviewCampaignSerializer(campaign).data)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewCampaignPreviewSerializer})
    def get(self, request, brand_id, campaign_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        preview = services.build_preview(_campaign(brand, campaign_id))
        return Response(s.ReviewCampaignPreviewSerializer(preview).data)


# ---------------------------------------------------------------------------
# Brand: moderation
# ---------------------------------------------------------------------------
@extend_schema(tags=["review-moderation"])
class BrandReviewListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter("status", str, description="Filter by status.")],
        responses={200: s.ReviewSerializer(many=True)},
    )
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        reviews = reviews_for_brand(brand, status=request.query_params.get("status", ""))
        return Response(s.ReviewSerializer(reviews, many=True).data)


@extend_schema(tags=["review-moderation"])
class BrandReviewRemoveView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.RemoveReviewSerializer, responses={200: s.ReviewSerializer})
    def post(self, request, brand_id, review_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        review = get_brand_review(brand, review_id)
        if review is None:
            raise NotFound("Review not found.")
        serializer = s.RemoveReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = _run(
            services.remove_review, review=review, moderator=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(s.ReviewSerializer(review).data)


# ---------------------------------------------------------------------------
# Consumer: opportunities, sessions, submission, history
# ---------------------------------------------------------------------------
@extend_schema(tags=["reviews"])
class ReviewOpportunitiesView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewSessionSerializer(many=True)})
    def get(self, request):
        return Response(
            s.ReviewSessionSerializer(active_sessions_for_user(request.user), many=True).data
        )


@extend_schema(tags=["reviews"])
class ReviewSessionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _session(self, user, session_id):
        session = get_user_session(user, session_id)
        if session is None:
            raise NotFound("Review session not found.")
        return session

    @extend_schema(responses={200: s.ReviewSessionSerializer})
    def get(self, request, session_id):
        return Response(s.ReviewSessionSerializer(self._session(request.user, session_id)).data)


@extend_schema(tags=["reviews"])
class ReviewSessionAnswerView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.AnswerSerializer, responses={200: s.AnswerResultSerializer})
    def post(self, request, session_id):
        session = get_user_session(request.user, session_id)
        if session is None:
            raise NotFound("Review session not found.")
        serializer = s.AnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = _run(services.append_message, session, text=serializer.validated_data["text"])
        return Response(result)


@extend_schema(tags=["reviews"])
class ReviewSessionSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.SubmitReviewSerializer, responses={201: s.ReviewSerializer})
    def post(self, request, session_id):
        session = get_user_session(request.user, session_id)
        if session is None:
            raise NotFound("Review session not found.")
        serializer = s.SubmitReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = _run(services.submit_review, session, **serializer.validated_data)
        return Response(s.ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["reviews"])
class MyReviewsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewSerializer(many=True)})
    def get(self, request):
        return Response(s.ReviewSerializer(reviews_for_user(request.user), many=True).data)


@extend_schema(tags=["reviews"])
class ProductReviewsView(APIView):
    """Public, paginated published reviews for a product (Screen 4 Top Reviews)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: paginated_response_serializer(s.PublicReviewSerializer)})
    def get(self, request, product_id):
        return paginate(
            self,
            request,
            published_reviews_for_product(product_id),
            s.PublicReviewSerializer,
        )


@extend_schema(tags=["reviews"])
class ProductReviewSummaryView(APIView):
    """Aggregate rating + count for a product (also embedded in offers)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ProductReviewSummarySerializer})
    def get(self, request, product_id):
        return Response(
            s.ProductReviewSummarySerializer(product_rating_summary(product_id)).data
        )
