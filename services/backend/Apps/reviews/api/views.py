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

from Apps.brands.access import get_brand_or_404, require_membership
from Apps.common.exceptions import DomainError
from Apps.common.permissions import IsPlatformAdmin
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.reviews import campaigns as rc
from Apps.reviews import serializers as s
from Apps.reviews import services
from Apps.reviews.models import Review, ReviewCampaign, ReviewPrompt, ReviewSession
from Apps.reviews.selectors import (
    get_reviewable_product,
    product_review_overview,
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
        # ?sort=newest | highest | lowest | helpful
        return paginate(
            self, request, reviews_for_product(product_id, request.query_params.get("sort", "newest")),
            s.PublicReviewSerializer,
        )


@extend_schema(tags=["reviews"])
class ProductReviewSummaryView(APIView):
    """Aggregate rating + count for a product (also embedded in offers)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ProductReviewSummarySerializer})
    def get(self, request, product_id):
        return Response(
            s.ProductReviewSummarySerializer(product_review_overview(product_id)).data
        )


# ===========================================================================
# Review campaigns (Master #23–27)
# ===========================================================================


def _campaign(request, brand_id, campaign_id, *, manager=False):
    brand = get_brand_or_404(brand_id)
    require_membership(request.user, brand, manager=manager, active=manager)
    campaign = ReviewCampaign.objects.filter(brand=brand, id=campaign_id).first()
    if campaign is None:
        raise NotFound("Review campaign not found.")
    return campaign


def _ctx(request):
    return {"request": request}


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewCampaignSerializer(many=True)})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        qs = ReviewCampaign.objects.filter(brand=brand).exclude(status=ReviewCampaign.Status.ARCHIVED)
        return Response(s.ReviewCampaignSerializer(qs.prefetch_related("products", "prompts"), many=True, context=_ctx(request)).data)

    @extend_schema(request=s.ReviewCampaignWriteSerializer, responses={201: s.ReviewCampaignSerializer})
    def post(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        serializer = s.ReviewCampaignWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        if not data.get("name"):
            raise ValidationError({"name": "Enter the campaign name."})
        campaign = _run(rc.create_campaign, brand=brand, product_ids=data.pop("product_ids", None), **data)
        return Response(s.ReviewCampaignSerializer(campaign, context=_ctx(request)).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewCampaignSerializer})
    def get(self, request, brand_id, campaign_id):
        return Response(s.ReviewCampaignSerializer(_campaign(request, brand_id, campaign_id), context=_ctx(request)).data)

    @extend_schema(request=s.ReviewCampaignWriteSerializer, responses={200: s.ReviewCampaignSerializer})
    def patch(self, request, brand_id, campaign_id):
        campaign = _campaign(request, brand_id, campaign_id, manager=True)
        serializer = s.ReviewCampaignWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        campaign = _run(rc.update_campaign, campaign, product_ids=data.pop("product_ids", None), **data)
        return Response(s.ReviewCampaignSerializer(campaign, context=_ctx(request)).data)

    @extend_schema(responses={204: None})
    def delete(self, request, brand_id, campaign_id):
        rc.archive(_campaign(request, brand_id, campaign_id, manager=True))
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignProductsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.SetProductsSerializer, responses={200: s.ReviewCampaignSerializer})
    def put(self, request, brand_id, campaign_id):
        campaign = _campaign(request, brand_id, campaign_id, manager=True)
        serializer = s.SetProductsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = _run(rc.update_campaign, campaign, product_ids=serializer.validated_data["product_ids"])
        return Response(s.ReviewCampaignSerializer(campaign, context=_ctx(request)).data)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignPromptsView(APIView):
    """The brand question pool (one is rotated into each review)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewPromptSerializer(many=True)})
    def get(self, request, brand_id, campaign_id):
        return Response(s.ReviewPromptSerializer(_campaign(request, brand_id, campaign_id).prompts.all(), many=True).data)

    @extend_schema(request=s.AddPromptSerializer, responses={201: s.ReviewPromptSerializer})
    def post(self, request, brand_id, campaign_id):
        campaign = _campaign(request, brand_id, campaign_id, manager=True)
        serializer = s.AddPromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prompt = _run(rc.add_prompt, campaign, text=serializer.validated_data["text"])
        return Response(s.ReviewPromptSerializer(prompt).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignPromptDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, brand_id, campaign_id, prompt_id):
        campaign = _campaign(request, brand_id, campaign_id, manager=True)
        ReviewPrompt.objects.filter(review_campaign=campaign, id=prompt_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignSuggestPromptsView(APIView):
    """Suggested brand questions (not saved — the brand adds the ones it likes)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.SuggestPromptsSerializer, responses={200: None})
    def post(self, request, brand_id, campaign_id):
        campaign = _campaign(request, brand_id, campaign_id, manager=True)
        serializer = s.SuggestPromptsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response({"suggestions": _run(rc.suggest_prompts, campaign, count=serializer.validated_data["count"])})


@extend_schema(tags=["review-campaigns"])
class ReviewCampaignActionView(APIView):
    """POST …/activate/ or …/pause/."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: s.ReviewCampaignSerializer})
    def post(self, request, brand_id, campaign_id, action):
        campaign = _campaign(request, brand_id, campaign_id, manager=True)
        handler = {"activate": rc.activate, "pause": rc.pause}.get(action)
        if handler is None:
            raise NotFound()
        return Response(s.ReviewCampaignSerializer(_run(handler, campaign), context=_ctx(request)).data)


# --- Shopper: opportunities + conversation ---------------------------------
def _session(request, session_id) -> ReviewSession:
    session = ReviewSession.objects.filter(user=request.user, id=session_id).select_related(
        "product", "review_campaign__brand"
    ).first()
    if session is None:
        raise NotFound("Review opportunity not found.")
    return session


@extend_schema(tags=["reviews"])
class ReviewOpportunitiesView(APIView):
    """Open review opportunities ($1, 30 days) — shown in My Offers."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewSessionSerializer(many=True)})
    def get(self, request):
        from django.utils import timezone

        qs = ReviewSession.objects.filter(
            user=request.user, status=ReviewSession.Status.ACTIVE, expires_at__gt=timezone.now()
        ).select_related("product", "review_campaign__brand")
        return Response(s.ReviewSessionSerializer(qs, many=True, context=_ctx(request)).data)


@extend_schema(tags=["reviews"])
class ReviewSessionDetailView(APIView):
    """Opens the conversation (plans the questions on first open)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewSessionSerializer})
    def get(self, request, session_id):
        session = _session(request, session_id)
        if session.status == ReviewSession.Status.ACTIVE:
            rc.start(session)
        return Response(s.ReviewSessionSerializer(session, context=_ctx(request)).data)


@extend_schema(tags=["reviews"])
class ReviewSessionAnswerView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.AnswerSerializer, responses={200: None})
    def post(self, request, session_id):
        serializer = s.AnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(_run(rc.answer, _session(request, session_id), text=serializer.validated_data["text"]))


@extend_schema(tags=["reviews"])
class ReviewSessionRegenerateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, session_id):
        return Response(_run(rc.regenerate, _session(request, session_id)))


@extend_schema(tags=["reviews"])
class ReviewSessionSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.SubmitSessionSerializer, responses={201: s.ReviewSerializer})
    def post(self, request, session_id):
        serializer = s.SubmitSessionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        review = _run(
            rc.submit, _session(request, session_id), rating=data["rating"], content=data["content"],
            title=data["title"], would_recommend=data["would_recommend"],
        )
        return Response(s.ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["reviews"])
class ReviewHelpfulView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, review_id):
        from django.db import IntegrityError, transaction
        from django.db.models import F

        from Apps.reviews.models import ReviewHelpfulVote

        review = Review.objects.filter(id=review_id, status=Review.Status.PUBLISHED).first()
        if review is None:
            raise NotFound("Review not found.")
        try:
            with transaction.atomic():
                ReviewHelpfulVote.objects.create(review=review, user=request.user)
                Review.objects.filter(pk=review.pk).update(helpful_count=F("helpful_count") + 1)
        except IntegrityError:
            pass  # already marked helpful
        review.refresh_from_db()
        return Response({"helpful_count": review.helpful_count})


# --- Brand: review management -----------------------------------------------
def _brand_review(request, brand_id, review_id, *, manager=False) -> Review:
    brand = get_brand_or_404(brand_id)
    require_membership(request.user, brand, manager=manager, active=manager)
    review = Review.objects.filter(brand=brand, id=review_id).first()
    if review is None:
        raise NotFound("Review not found.")
    return review


def _brand_reviews(request, brand):
    qs = Review.objects.filter(brand=brand).select_related("product", "user", "brand", "review_campaign", "session__receipt")
    params = request.query_params
    if params.get("status"):
        qs = qs.filter(status=params["status"])
    if params.get("rating"):
        qs = qs.filter(rating=params["rating"])
    if params.get("product"):
        qs = qs.filter(product_id=params["product"])
    if params.get("from"):
        qs = qs.filter(created_at__date__gte=params["from"])
    if params.get("to"):
        qs = qs.filter(created_at__date__lte=params["to"])
    return qs.order_by("-created_at")


@extend_schema(tags=["review-management"])
class BrandReviewListView(APIView):
    """?status=published|held|flagged|removed &rating= &product= &from= &to="""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.BrandReviewSerializer(many=True)})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        reviews = _brand_reviews(request, brand)
        all_reviews = Review.objects.filter(brand=brand)
        published = all_reviews.filter(status=Review.Status.PUBLISHED)
        from django.db.models import Avg

        avg = published.aggregate(a=Avg("rating"))["a"]
        return Response({
            "summary": {
                "total_reviews": all_reviews.exclude(status=Review.Status.REMOVED).count(),
                "low_rating_awaiting_action": all_reviews.filter(status=Review.Status.HELD).count(),
                "average_rating": round(avg, 2) if avg is not None else None,
            },
            "reviews": s.BrandReviewSerializer(reviews, many=True, context=_ctx(request)).data,
        })


@extend_schema(tags=["review-management"])
class BrandReviewExportView(APIView):
    """CSV with the verified-purchase + rewarded-review disclosure on every row."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        import csv
        import io

        from django.http import HttpResponse

        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["review_id", "product", "rating", "title", "review", "status", "published_at",
                         "would_recommend", "brand_response", "disclosure"])
        for r in _brand_reviews(request, brand):
            writer.writerow([
                r.id, r.product.name, r.rating, r.title, r.content, r.status,
                r.published_at.isoformat() if r.published_at else "",
                "" if r.would_recommend is None else ("yes" if r.would_recommend else "no"),
                r.brand_response,
                r.disclosure or "Verified purchase. This shopper received a reward for an honest review.",
            ])
        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{brand.slug}-reviews.csv"'
        return response


@extend_schema(tags=["review-management"])
class BrandReviewActionView(APIView):
    """POST …/respond/ {text} or …/flag/ {reason, note}."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: s.BrandReviewSerializer})
    def post(self, request, brand_id, review_id, action):
        review = _brand_review(request, brand_id, review_id, manager=True)
        if action == "respond":
            serializer = s.RespondSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            review = _run(rc.respond, review, text=serializer.validated_data["text"], actor=request.user)
        elif action == "flag":
            serializer = s.FlagSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            review = _run(rc.flag, review, actor=request.user, **serializer.validated_data)
        else:
            raise NotFound()
        return Response(s.BrandReviewSerializer(review, context=_ctx(request)).data)


# --- Nibbl admin: flagged reviews -------------------------------------------
@extend_schema(tags=["admin"])
class AdminFlaggedReviewListView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: s.BrandReviewSerializer(many=True)})
    def get(self, request):
        qs = Review.objects.filter(status=Review.Status.FLAGGED).select_related(
            "product", "user", "brand", "review_campaign", "session__receipt"
        ).order_by("flagged_at")
        return Response(s.BrandReviewSerializer(qs, many=True, context=_ctx(request)).data)


@extend_schema(tags=["admin"])
class AdminFlagDecisionView(APIView):
    """POST …/remove/ (uphold the brand's flag) or …/keep/ (publish)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=s.FlagDecisionSerializer, responses={200: None})
    def post(self, request, review_id, action):
        review = Review.objects.filter(id=review_id).first()
        if review is None or action not in ("remove", "keep"):
            raise NotFound()
        serializer = s.FlagDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = _run(rc.decide_flag, review, remove=action == "remove", admin=request.user,
                      note=serializer.validated_data["note"])
        return Response({"id": str(review.id), "status": review.status})
