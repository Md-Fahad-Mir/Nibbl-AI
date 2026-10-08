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
from Apps.billing import serializers as billing_serializers
from Apps.billing import services as billing_services
from Apps.billing.models import PromoCode
from Apps.brands.access import get_brand_or_404
from Apps.campaigns import approvals
from Apps.campaigns import serializers as campaign_serializers
from Apps.campaigns.models import CampaignReview
from Apps.campaigns.services import CampaignError
from Apps.common.models import PlatformSettings
from Apps.common.permissions import IsPlatformAdmin


def _run(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except AdminError as exc:
        raise ValidationError({"detail": str(exc)})


# ---------------------------------------------------------------------------
# Brand operations
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin"])
class AdminSettingsView(APIView):
    """Get or update platform-wide settings (withdrawal thresholds, referrals)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: s.PlatformSettingsSerializer})
    def get(self, request):
        return Response(s.PlatformSettingsSerializer(PlatformSettings.load()).data)

    @extend_schema(
        request=s.PlatformSettingsSerializer,
        responses={200: s.PlatformSettingsSerializer},
    )
    def put(self, request):
        settings_obj = PlatformSettings.load()
        serializer = s.PlatformSettingsSerializer(
            settings_obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(s.PlatformSettingsSerializer(settings_obj).data)


@extend_schema(tags=["admin"])
class AdminPromoCodeListCreateView(APIView):
    """Create and list reusable promo codes (platform admin)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: billing_serializers.PromoCodeSerializer(many=True)})
    def get(self, request):
        codes = PromoCode.objects.all()
        return Response(billing_serializers.PromoCodeSerializer(codes, many=True).data)

    @extend_schema(
        request=billing_serializers.CreatePromoCodeSerializer,
        responses={201: billing_serializers.PromoCodeSerializer},
    )
    def post(self, request):
        payload = billing_serializers.CreatePromoCodeSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        try:
            promo = billing_services.create_promo_code(
                created_by=request.user, **payload.validated_data
            )
        except billing_services.BillingError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(
            billing_serializers.PromoCodeSerializer(promo).data,
            status=201,
        )


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
class ResetUserPhoneView(APIView):
    """Clear a shopper's phone (e.g. lost phone) so they can verify a new one.
    Audited; the next number they verify counts as a change (48h pause)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=s.SuspendUserSerializer, responses={200: None})
    def post(self, request, user_id):
        from Apps.accounts import services as account_services

        user = User.objects.filter(id=user_id, is_deleted=False).first()
        if user is None:
            raise NotFound("User not found.")
        serializer = s.SuspendUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account_services.reset_phone(
            user=user, admin=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response({"detail": "Phone number reset."})


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
class AdminApproveBrandView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: s.AdminUserSerializer})
    def post(self, request, user_id):
        user = User.objects.filter(id=user_id, is_deleted=False).first()
        if user is None:
            raise NotFound("User not found.")
        user = _run(services.approve_brand_user, user=user, admin=request.user)
        return Response(s.AdminUserSerializer(user).data)


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


@extend_schema(tags=["admin"])
class CampaignApprovalQueueView(APIView):
    """Campaigns and revisions waiting for Nibbl review (?kind=new|revision)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        parameters=[OpenApiParameter("kind", str)],
        responses={200: campaign_serializers.AdminCampaignReviewSerializer(many=True)},
    )
    def get(self, request):
        reviews = approvals.pending_reviews(kind=request.query_params.get("kind", ""))
        return Response(
            campaign_serializers.AdminCampaignReviewSerializer(reviews, many=True).data
        )


@extend_schema(tags=["admin"])
class CampaignApprovalDecisionView(APIView):
    """POST .../approve/, .../reject/ or .../request-changes/ with {comment}."""

    permission_classes = [IsPlatformAdmin]
    ACTIONS = {
        "approve": approvals.approve,
        "reject": approvals.reject,
        "request-changes": approvals.request_changes,
    }

    @extend_schema(request=campaign_serializers.ReviewDecisionSerializer, responses={200: None})
    def post(self, request, review_id, action):
        handler = self.ACTIONS.get(action)
        review = CampaignReview.objects.filter(id=review_id).first()
        if handler is None or review is None:
            raise NotFound("Review not found.")
        serializer = campaign_serializers.ReviewDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            note = handler(review, admin=request.user, comment=serializer.validated_data["comment"])
        except CampaignError as exc:
            raise ValidationError({"detail": str(exc)})
        review.refresh_from_db()
        return Response({"id": str(review.id), "status": review.status, "detail": note or ""})


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

