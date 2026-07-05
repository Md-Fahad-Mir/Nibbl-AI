"""Platform-admin oversight endpoints (all gated by IsPlatformAdmin)."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.accounts.models import User
from Apps.admin_panel import selectors
from Apps.admin_panel import serializers as s
from Apps.admin_panel import services
from Apps.admin_panel.services import AdminError
from Apps.brands.access import get_brand_or_404
from Apps.common.permissions import IsPlatformAdmin
from Apps.reviews.models import Review


def _run(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except AdminError as exc:
        raise ValidationError({"detail": str(exc)})


# ---------------------------------------------------------------------------
# Brand operations
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin"])
class PromoCreditView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=s.PromoCreditSerializer, responses={200: None})
    def post(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        serializer = s.PromoCreditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = _run(
            services.promo_credit, brand=brand,
            amount=serializer.validated_data["amount"],
            note=serializer.validated_data.get("note", ""),
            admin=request.user,
        )
        return Response({"ledger_entry_id": str(entry.id), "balance_after": str(entry.balance_after)})


@extend_schema(tags=["admin"])
class ChangePlanView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=s.ChangePlanSerializer, responses={200: None})
    def post(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        serializer = s.ChangePlanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        brand = _run(services.change_plan, brand=brand, plan_slug=serializer.validated_data["plan"], admin=request.user)
        return Response({"brand": str(brand.id), "plan": brand.plan.slug})


# ---------------------------------------------------------------------------
# User monitoring
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin"])
class AdminUserListView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        parameters=[
            OpenApiParameter("suspended", str), OpenApiParameter("flagged", str),
        ],
        responses={200: s.AdminUserSerializer(many=True)},
    )
    def get(self, request):
        users = selectors.all_users(
            suspended=request.query_params.get("suspended", ""),
            flagged=request.query_params.get("flagged", ""),
        )
        return Response(s.AdminUserSerializer(users, many=True).data)


@extend_schema(tags=["admin"])
class SuspendUserView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=s.SuspendUserSerializer, responses={200: None})
    def post(self, request, user_id):
        user = User.objects.filter(id=user_id, is_deleted=False).first()
        if user is None:
            raise NotFound("User not found.")
        serializer = s.SuspendUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(services.suspend_user, user=user, admin=request.user, reason=serializer.validated_data.get("reason", ""))
        return Response({"detail": "User suspended."})


@extend_schema(tags=["admin"])
class ReactivateUserView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, user_id):
        user = User.objects.filter(id=user_id, is_deleted=False).first()
        if user is None:
            raise NotFound("User not found.")
        _run(services.reactivate_user, user=user, admin=request.user)
        return Response({"detail": "User reactivated."})


@extend_schema(tags=["admin"])
class AdminUserWalletCreditView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=s.UserWalletCreditSerializer, responses={200: None})
    def post(self, request, user_id):
        user = User.objects.filter(id=user_id, is_deleted=False).first()
        if user is None:
            raise NotFound("User not found.")
        serializer = s.UserWalletCreditSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = _run(
            services.credit_user_wallet,
            user=user,
            amount=serializer.validated_data["amount"],
            note=serializer.validated_data.get("note", ""),
            admin=request.user,
        )
        return Response({"ledger_entry_id": str(entry.id), "balance_after": str(entry.balance_after)})


@extend_schema(tags=["admin"])
class FraudFlagListView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        parameters=[OpenApiParameter("resolved", str)],
        responses={200: s.FraudFlagSerializer(many=True)},
    )
    def get(self, request):
        flags = selectors.all_fraud_flags(resolved=request.query_params.get("resolved", ""))
        return Response(s.FraudFlagSerializer(flags, many=True).data)


# ---------------------------------------------------------------------------
# Campaign oversight
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin"])
class AdminCampaignListView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        parameters=[OpenApiParameter("status", str)],
        responses={200: s.AdminCampaignSerializer(many=True)},
    )
    def get(self, request):
        campaigns = selectors.all_campaigns(status=request.query_params.get("status", ""))
        return Response(s.AdminCampaignSerializer(campaigns, many=True).data)


# ---------------------------------------------------------------------------
# Financial oversight
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin"])
class AdminTransactionListView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        parameters=[OpenApiParameter("category", str)],
        responses={200: s.AdminLedgerEntrySerializer(many=True)},
    )
    def get(self, request):
        entries = selectors.all_transactions(category=request.query_params.get("category", ""))
        return Response(s.AdminLedgerEntrySerializer(entries, many=True).data)


# ---------------------------------------------------------------------------
# Review moderation
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin"])
class AdminHeldReviewListView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: s.HeldReviewSerializer(many=True)})
    def get(self, request):
        return Response(s.HeldReviewSerializer(selectors.held_reviews(), many=True).data)


@extend_schema(tags=["admin"])
class AdminRemoveReviewView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=s.SuspendUserSerializer, responses={200: None})
    def post(self, request, review_id):
        review = Review.objects.filter(id=review_id).first()
        if review is None:
            raise NotFound("Review not found.")
        serializer = s.SuspendUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(services.remove_review, review=review, admin=request.user, reason=serializer.validated_data.get("reason", ""))
        return Response({"detail": "Review removed."})


# ---------------------------------------------------------------------------
# Audit logs + announcements
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin"])
class AuditLogListView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        parameters=[OpenApiParameter("target_type", str), OpenApiParameter("actor_id", str)],
        responses={200: s.AuditLogSerializer(many=True)},
    )
    def get(self, request):
        logs = selectors.audit_logs(
            target_type=request.query_params.get("target_type", ""),
            actor_id=request.query_params.get("actor_id", ""),
        )
        return Response(s.AuditLogSerializer(logs, many=True).data)


@extend_schema(tags=["admin"])
class BroadcastView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=s.BroadcastSerializer, responses={200: None})
    def post(self, request):
        serializer = s.BroadcastSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sent = services.broadcast(admin=request.user, **serializer.validated_data)
        return Response({"recipients": sent})


@extend_schema(tags=["admin"])
class RoleStatisticsView(APIView):
    """Return user counts grouped by role (consumers, brands, admins)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: s.RoleStatisticsSerializer})
    def get(self, request):
        return Response(selectors.role_statistics())

