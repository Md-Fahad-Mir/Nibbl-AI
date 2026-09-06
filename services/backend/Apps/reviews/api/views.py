"""HTTP layer for the reviews module.

Question generation is not implemented here on purpose: the frontend calls
the AI service's own ``/reviews/questions`` endpoint directly. This backend
only ever receives the finished (question, answer) pairs, generates the
review via the AI service's ``/reviews/generate`` endpoint, saves it, and
pays the reward.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.common.exceptions import DomainError
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.reviews import serializers as s
from Apps.reviews import services
from Apps.reviews.selectors import (
    get_reviewable_product,
    product_rating_summary,
    reviews_for_product,
    reviews_for_user,
)


class Conflict(APIException):
    """409 — this user has already reviewed this product."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "You have already reviewed this product."


class ServiceUnavailable(APIException):
    """503 — the AI review service (or the reward) is temporarily unavailable."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "The review service is temporarily unavailable."


def _run(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except services.DuplicateReview as exc:
        raise Conflict(str(exc))
    except (services.ReviewGenerationUnavailable, services.RewardUnavailable) as exc:
        raise ServiceUnavailable(str(exc))
    except DomainError as exc:
        raise ValidationError({"detail": str(exc)})


@extend_schema(tags=["reviews"])
class ReviewListCreateView(APIView):
    """GET: the caller's own reviews. POST: generate + save + reward one."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewSerializer(many=True)})
    def get(self, request):
        return Response(
            s.ReviewSerializer(reviews_for_user(request.user), many=True).data
        )

    @extend_schema(
        request=s.GenerateReviewSerializer,
        responses={
            201: s.ReviewSerializer,
            409: None,  # already reviewed this product
            503: None,  # AI service or reward unavailable
        },
    )
    def post(self, request):
        serializer = s.GenerateReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        product = get_reviewable_product(data["product"])
        if product is None:
            raise NotFound("Product not found.")

        answers = [(a["question"], a["answer"]) for a in data["answers"]]
        review = _run(
            services.generate_and_submit_review,
            user=request.user,
            product=product,
            answers=answers,
            rating=data.get("rating"),
        )
        return Response(s.ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["reviews"])
class ProductReviewsView(APIView):
    """Public, paginated reviews for a product (Screen 4 Top Reviews)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: paginated_response_serializer(s.PublicReviewSerializer)})
    def get(self, request, product_id):
        return paginate(
            self, request, reviews_for_product(product_id), s.PublicReviewSerializer
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
