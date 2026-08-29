"""Consumer-facing HTTP layer: offer feed, detail, entry points, bookmarks."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.campaigns.models import Campaign, CampaignURL, QRCode
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.offers import serializers as s
from Apps.offers import services
from Apps.offers.models import OfferView
from Apps.offers.selectors import (
    active_offers,
    bookmarks_for_user,
    saved_offers_for_user,
)
from Apps.offers.services import OfferError


def _run(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except OfferError as exc:
        raise ValidationError({"detail": str(exc)})


def _live_campaign_with_relations(**filters):
    # ``products`` is a M2M (a campaign can target several) — it must be
    # prefetched, not select_related.
    return (
        Campaign.objects.select_related("brand", "restriction", "fallback_offer")
        .prefetch_related("tiers", "products")
        .filter(**filters)
        .first()
    )


@extend_schema(tags=["offers"])
class OfferFeedView(generics.ListAPIView):
    """Searchable feed of active offers across all brands."""

    serializer_class = s.OfferSerializer
    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("search", str, description="Free-text search."),
            OpenApiParameter(
                "category", str, description="explore | food | beverages | ..."
            ),
        ]
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        return active_offers(
            search=self.request.query_params.get("search", ""),
            category=self.request.query_params.get("category", ""),
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["user"] = self.request.user
        return ctx


@extend_schema(tags=["offers"])
class OfferDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.OfferSerializer})
    def get(self, request, campaign_id):
        campaign = _live_campaign_with_relations(id=campaign_id)
        if campaign is None:
            raise NotFound("Offer not found.")
        services.record_view(
            user=request.user, campaign=campaign, source=OfferView.Source.DETAIL
        )
        return Response(
            s.OfferSerializer(campaign, context={"user": request.user}).data
        )


@extend_schema(tags=["offers"])
class OfferDetailsContentView(APIView):
    """Consumer campaign-detail page (description + how-it-works + rating)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.OfferDetailSerializer})
    def get(self, request, campaign_id):
        campaign = _live_campaign_with_relations(id=campaign_id)
        if campaign is None:
            raise NotFound("Offer not found.")
        services.record_view(
            user=request.user, campaign=campaign, source=OfferView.Source.DETAIL
        )
        data = services.build_offer_details(campaign, request.user)
        return Response(s.OfferDetailSerializer(data).data)


@extend_schema(tags=["offers"])
class OfferCategoriesView(APIView):
    """Distinct product categories present in the active offer feed."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.CategorySerializer(many=True)})
    def get(self, request):
        cats = sorted(
            {
                c
                for c in active_offers().values_list(
                    "products__category", flat=True
                )
                if c
            }
        )
        return Response([{"category": c} for c in cats])


@extend_schema(tags=["offers"])
class OfferSaveView(APIView):
    """'Save My Reward' — saves the offer's product to the user's bookmarks."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={201: s.BookmarkSerializer})
    def post(self, request, campaign_id):
        campaign = _live_campaign_with_relations(id=campaign_id)
        if campaign is None:
            raise NotFound("Offer not found.")
        bookmark = _run(services.save_offer, user=request.user, campaign=campaign)
        return Response(
            s.BookmarkSerializer(bookmark).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["offers"])
class OfferByURLView(APIView):
    """Public entry point: resolve a campaign URL token to its best offer."""

    permission_classes = [AllowAny]

    @extend_schema(responses={200: s.OfferSerializer})
    def get(self, request, token):
        link = CampaignURL.objects.select_related("campaign").filter(token=token).first()
        if link is None:
            raise NotFound("Offer not found.")
        campaign = _live_campaign_with_relations(id=link.campaign_id)
        user = request.user if request.user.is_authenticated else None
        services.record_view(
            user=user, campaign=campaign, source=OfferView.Source.URL
        )
        return Response(s.OfferSerializer(campaign, context={"user": user}).data)


@extend_schema(tags=["offers"])
class OfferByQRView(APIView):
    """Public entry point: resolve a QR token to its best offer."""

    permission_classes = [AllowAny]

    @extend_schema(responses={200: s.OfferSerializer})
    def get(self, request, token):
        qr = QRCode.objects.select_related("campaign").filter(token=token).first()
        if qr is None:
            raise NotFound("Offer not found.")
        campaign = _live_campaign_with_relations(id=qr.campaign_id)
        user = request.user if request.user.is_authenticated else None
        services.record_view(
            user=user, campaign=campaign, source=OfferView.Source.QR
        )
        return Response(s.OfferSerializer(campaign, context={"user": user}).data)


@extend_schema(tags=["offers"])
class SavedOffersView(APIView):
    """Saved-offer cards (Profile → Saved): bookmarked products' active offers."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="offers_saved",
        responses={200: paginated_response_serializer(s.SavedOfferSerializer)},
    )
    def get(self, request):
        return paginate(
            self, request, saved_offers_for_user(request.user), s.SavedOfferSerializer
        )


@extend_schema(tags=["bookmarks"])
class BookmarkListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="bookmarks_list",
        responses={200: paginated_response_serializer(s.BookmarkSerializer)},
    )
    def get(self, request):
        return paginate(
            self, request, bookmarks_for_user(request.user), s.BookmarkSerializer
        )

    @extend_schema(request=s.AddBookmarkSerializer, responses={201: s.BookmarkSerializer})
    def post(self, request):
        serializer = s.AddBookmarkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        bookmark = _run(
            services.add_bookmark,
            user=request.user,
            kind=data["kind"],
            product_id=data.get("product"),
            brand_id=data.get("brand"),
        )
        return Response(
            s.BookmarkSerializer(bookmark).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["bookmarks"])
class BookmarkDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, bookmark_id):
        bookmark = request.user.bookmarks.filter(id=bookmark_id).first()
        if bookmark is None:
            raise NotFound("Bookmark not found.")
        services.remove_bookmark(bookmark)
        return Response(status=status.HTTP_204_NO_CONTENT)
