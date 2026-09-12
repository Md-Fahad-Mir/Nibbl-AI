"""Public + admin endpoints for newsletter, FAQs and legal documents."""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.common.permissions import IsPlatformAdmin
from Apps.content import serializers as s
from Apps.content.models import FAQ, LegalDocument, NewsletterSubscription

_LEGAL_TITLES = {
    LegalDocument.Slug.TERMS: "Terms & Conditions",
    LegalDocument.Slug.PRIVACY: "Privacy Policy",
}


def _get_legal_doc(slug: str) -> LegalDocument:
    """Return the legal document for ``slug``, creating an empty one if absent."""
    doc, _ = LegalDocument.objects.get_or_create(
        slug=slug, defaults={"title": _LEGAL_TITLES.get(slug, slug)}
    )
    return doc


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------
@extend_schema(tags=["content"])
class NewsletterSubscribeView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=s.NewsletterSubscriptionSerializer,
        responses={201: s.NewsletterSubscriptionSerializer},
    )
    def post(self, request):
        serializer = s.NewsletterSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription, _ = NewsletterSubscription.objects.update_or_create(
            email=serializer.validated_data["email"],
            defaults={
                "source": serializer.validated_data.get("source", ""),
                "status": NewsletterSubscription.Status.SUBSCRIBED,
            },
        )
        return Response(
            s.NewsletterSubscriptionSerializer(subscription).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["content"])
class PublicFAQListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = s.PublicFAQSerializer
    pagination_class = None  # plain array, matching the frontend contract

    def get_queryset(self):
        return FAQ.objects.filter(is_active=True)


@extend_schema(tags=["content"])
class PublicLegalView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    slug: str = ""

    @extend_schema(responses={200: s.LegalDocumentSerializer})
    def get(self, request):
        return Response(s.LegalDocumentSerializer(_get_legal_doc(self.slug)).data)


# ---------------------------------------------------------------------------
# Admin (platform-admin only)
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin"])
class AdminFAQListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = s.FAQSerializer
    pagination_class = None
    queryset = FAQ.objects.all()


@extend_schema(tags=["admin"])
class AdminFAQDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPlatformAdmin]
    serializer_class = s.FAQSerializer
    queryset = FAQ.objects.all()
    lookup_url_kwarg = "faq_id"
    lookup_field = "id"


@extend_schema(tags=["admin"])
class AdminLegalView(APIView):
    permission_classes = [IsPlatformAdmin]
    slug: str = ""

    @extend_schema(responses={200: s.LegalDocumentSerializer})
    def get(self, request):
        return Response(s.LegalDocumentSerializer(_get_legal_doc(self.slug)).data)

    @extend_schema(
        request=s.LegalDocumentSerializer, responses={200: s.LegalDocumentSerializer}
    )
    def patch(self, request):
        doc = _get_legal_doc(self.slug)
        serializer = s.LegalDocumentSerializer(doc, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(s.LegalDocumentSerializer(doc).data)
