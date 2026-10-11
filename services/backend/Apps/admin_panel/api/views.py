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
            campaign_serializers.AdminCampaignReviewSerializer(
                reviews, many=True, context={"request": request}
            ).data
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



@extend_schema(tags=["admin"])
class UserLinkedAccountsView(APIView):
    """Other accounts seen on this user's devices or networks, plus any
    current device / network risk (Master #51)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request, user_id):
        from Apps.accounts import risk

        user = User.objects.filter(id=user_id).first()
        if user is None:
            raise NotFound("User not found.")
        return Response({"risk": risk.risk_reasons(user), "linked_accounts": risk.linked_accounts(user)})


def _referral_row(referral):
    from Apps.accounts.referrals import steps

    def person(user):
        return {"id": str(user.id), "full_name": user.full_name, "email": user.email, "is_active": user.is_active}

    return {
        "id": str(referral.id), "status": referral.status, "referrer": person(referral.referrer),
        "referred": person(referral.referred), "campaign": referral.campaign.name if referral.campaign_id else None,
        "steps": steps(referral), "qualified_at": referral.qualified_at, "flag_reason": referral.flag_reason,
        "reward_amount": str(referral.reward_amount) if referral.reward_amount is not None else None,
        "paid_at": referral.paid_at, "decision_reason": referral.decision_reason, "created_at": referral.created_at,
    }


@extend_schema(tags=["admin"])
class AdminReferralListView(APIView):
    """Referral Management: summary + list. ?status=in_progress|qualified|
    flagged|paid|rejected (qualified = all steps done)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request):
        from Apps.accounts.models import Referral

        qs = Referral.objects.select_related("referrer", "referred", "campaign")
        summary = {
            "in_progress": qs.filter(status=Referral.Status.IN_PROGRESS).count(),
            "qualified": qs.filter(qualified_at__isnull=False).count(),
            "flagged": qs.filter(status=Referral.Status.FLAGGED).count(),
            "paid": qs.filter(status=Referral.Status.PAID).count(),
            "rejected": qs.filter(status=Referral.Status.REJECTED).count(),
        }
        status_filter = request.query_params.get("status", "")
        if status_filter == "qualified":
            qs = qs.filter(qualified_at__isnull=False)
        elif status_filter:
            qs = qs.filter(status=status_filter)
        return Response({"summary": summary, "results": [_referral_row(r) for r in qs[:500]]})


@extend_schema(tags=["admin"])
class AdminReferralActionView(APIView):
    """POST …/approve/, …/reject/ {reason}, …/suspend/ {target: referred|referrer, reason}."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, referral_id, action):
        from Apps.accounts import referrals
        from Apps.accounts.models import Referral

        referral = Referral.objects.select_related("referrer", "referred", "campaign").filter(id=referral_id).first()
        if referral is None or action not in ("approve", "reject", "suspend"):
            raise NotFound("Referral not found.")
        reason = str(request.data.get("reason", ""))
        try:
            if action == "approve":
                referrals.approve(referral, admin=request.user)
            elif action == "reject":
                referrals.reject(referral, admin=request.user, reason=reason)
            else:
                referrals.suspend(referral, admin=request.user, target=str(request.data.get("target", "")),
                                  reason=reason)
        except referrals.ReferralError as exc:
            raise ValidationError({"detail": str(exc)})
        referral.refresh_from_db()
        return Response(_referral_row(referral))


@extend_schema(tags=["admin"])
class AdminRefundRequestListView(APIView):
    """Brand refund requests. ?status=pending|refunded|rejected"""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request):
        from Apps.wallets import refunds
        from Apps.wallets.models import RefundRequest

        qs = RefundRequest.objects.select_related("brand", "requested_by", "wallet")
        summary = {status: qs.filter(status=status).count() for status in RefundRequest.Status.values}
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        results = []
        for refund in qs[:500]:
            results.append({**refunds.row(refund), "available_cash": str(refunds.refundable(refund.wallet))})
        return Response({"summary": summary, "results": results})


@extend_schema(tags=["admin"])
class AdminRefundRequestActionView(APIView):
    """POST …/refunded/ {reference, note} after returning the money in Stripe,
    or …/reject/ {note} (shown to the brand)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, refund_id, action):
        from Apps.wallets import refunds
        from Apps.wallets.models import RefundRequest

        refund = RefundRequest.objects.select_related("brand", "wallet", "requested_by").filter(id=refund_id).first()
        if refund is None or action not in ("refunded", "reject"):
            raise NotFound("Refund request not found.")
        note = str(request.data.get("note", ""))
        try:
            if action == "refunded":
                refund = refunds.mark_refunded(
                    refund, admin=request.user, reference=str(request.data.get("reference", "")), note=note,
                )
            else:
                refund = refunds.reject(refund, admin=request.user, note=note)
        except refunds.RefundError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(refunds.row(refund))
