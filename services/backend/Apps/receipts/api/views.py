"""HTTP layer: consumer receipt upload/history + brand manual review queue."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.accounts.models import User
from Apps.brands.access import get_brand_or_404, require_membership
from Apps.common.exceptions import DomainError
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.receipts import serializers as s
from Apps.receipts import services
from Apps.receipts.selectors import (
    get_brand_review_item,
    get_user_receipt,
    receipts_for_user,
    review_queue_for_brand,
)


class Conflict(APIException):
    """409 — the receipt has already been used."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "This receipt has already been used."


class Unprocessable(APIException):
    """422 — the image was processed but is not a usable receipt."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_detail = "The receipt could not be read."


class ServiceUnavailable(APIException):
    """503 — the OCR provider is down; the claim is untouched, retry later."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "The receipt service is temporarily unavailable."


def _run(func, *args, **kwargs):
    # Catches receipt errors *and* redemption errors raised by the
    # receipt_verified signal receiver (both subclass DomainError).
    try:
        return func(*args, **kwargs)
    except services.DuplicateReceipt as exc:
        # Deliberately generic: never reveal who used the receipt first.
        raise Conflict(str(exc))
    except services.ReceiptUnreadable as exc:
        raise Unprocessable(str(exc))
    except services.OCRUnavailable as exc:
        raise ServiceUnavailable(str(exc))
    except DomainError as exc:
        raise ValidationError({"detail": str(exc)})


# ---------------------------------------------------------------------------
# Consumer
# ---------------------------------------------------------------------------
@extend_schema(tags=["receipts"])
class ReceiptListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="receipts_list",
        responses={200: paginated_response_serializer(s.ReceiptSerializer)},
    )
    def get(self, request):
        return paginate(
            self, request, receipts_for_user(request.user), s.ReceiptSerializer
        )

    @extend_schema(
        request=s.UploadReceiptSerializer,
        responses={
            201: s.ReceiptSerializer,
            409: None,  # duplicate receipt
            422: None,  # unreadable image
            503: None,  # OCR provider unavailable
        },
    )
    def post(self, request):
        serializer = s.UploadReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        receipt = _run(
            services.upload_receipt,
            user=request.user,
            reservation_id=data["reservation"],
            image=data["image"],
        )
        return Response(
            s.ReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["receipts"])
class ReceiptDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReceiptSerializer})
    def get(self, request, receipt_id):
        receipt = get_user_receipt(request.user, receipt_id)
        if receipt is None:
            raise NotFound("Receipt not found.")
        return Response(s.ReceiptSerializer(receipt).data)


# ---------------------------------------------------------------------------
# Brand manual review queue
# ---------------------------------------------------------------------------
def _get_item(brand, item_id):
    item = get_brand_review_item(brand, item_id)
    if item is None:
        raise NotFound("Review item not found.")
    return item


@extend_schema(tags=["review-queue"])
class ReviewQueueView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReviewItemSerializer(many=True)})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        return Response(
            s.ReviewItemSerializer(review_queue_for_brand(brand), many=True).data
        )


@extend_schema(tags=["review-queue"])
class ReviewItemApproveView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: s.ReceiptSerializer})
    def post(self, request, brand_id, item_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        item = _get_item(brand, item_id)
        receipt = _run(services.approve_review, item=item, reviewer=request.user)
        return Response(s.ReceiptSerializer(receipt).data)


@extend_schema(tags=["review-queue"])
class ReviewItemDeclineView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.DeclineSerializer, responses={200: s.ReceiptSerializer})
    def post(self, request, brand_id, item_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        item = _get_item(brand, item_id)
        serializer = s.DeclineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        receipt = _run(
            services.decline_review,
            item=item,
            reviewer=request.user,
            reason=serializer.validated_data["reason"],
        )
        return Response(s.ReceiptSerializer(receipt).data)


@extend_schema(tags=["review-queue"])
class ReviewItemAddAliasView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.AddAliasInlineSerializer, responses={201: None})
    def post(self, request, brand_id, item_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        item = _get_item(brand, item_id)
        serializer = s.AddAliasInlineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        alias = _run(
            services.add_alias_from_review,
            item=item,
            line_item_id=serializer.validated_data["line_item"],
            product_id=serializer.validated_data["product"],
        )
        return Response(
            {"alias_id": str(alias.id), "alias_text": alias.alias_text},
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["review-queue"])
class FlagUserView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.FlagUserSerializer, responses={201: None})
    def post(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        serializer = s.FlagUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = User.objects.filter(
            id=serializer.validated_data["user"], is_deleted=False
        ).first()
        if target is None:
            raise NotFound("User not found.")
        flag = services.flag_user(
            brand=brand,
            user=target,
            reason=serializer.validated_data["reason"],
            detail=serializer.validated_data.get("detail", ""),
            flagged_by=request.user,
        )
        return Response({"flag_id": str(flag.id)}, status=status.HTTP_201_CREATED)
