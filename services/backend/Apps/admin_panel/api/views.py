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
from Apps.common.permissions import IsAdministrator, IsPlatformAdmin


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

    def get_permissions(self):
        # Master Admin Users: only Administrators change Admin Settings.
        if self.request.method == "PUT":
            return [IsAdministrator()]
        return super().get_permissions()

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
            "expired": qs.filter(status=Referral.Status.EXPIRED).count(),
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


# ---------------------------------------------------------------------------
# Master Admin pages (Apps.admin_panel.master)
# ---------------------------------------------------------------------------
def _user_or_404(user_id) -> User:
    user = User.objects.filter(id=user_id, is_deleted=False).first()
    if user is None:
        raise NotFound("Shopper not found.")
    return user


@extend_schema(tags=["admin"])
class AdminBrandBoardView(APIView):
    """Brands: KPIs + table. ?q&category&plan&status&sort=lowest|highest|recent"""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request):
        from Apps.admin_panel import master

        p = request.query_params
        return Response(master.brands_board(q=p.get("q", ""), category=p.get("category", ""),
                                            plan=p.get("plan", ""), status=p.get("status", ""),
                                            sort=p.get("sort", "lowest")))


@extend_schema(tags=["admin"])
class AdminBrandSummaryView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        from Apps.admin_panel import master

        return Response(master.brand_summary(get_brand_or_404(brand_id)))


@extend_schema(tags=["admin"])
class AdminBrandAccessView(APIView):
    """POST: open the brand dashboard in Nibbl Admin Mode (returns a one-time
    brand-app link; the session's writes are all logged)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, brand_id):
        from Apps.admin_panel import master

        url = master.start_brand_access(admin=request.user, brand=get_brand_or_404(brand_id))
        return Response({"url": url})


@extend_schema(tags=["admin"])
class AdminShopperListView(APIView):
    """Shoppers list. ?q (name, email, phone, Shopper ID) &status=active|suspended
    &page=1&page_size=10 → {results, count, page, page_size}"""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request):
        from Apps.admin_panel import master

        p = request.query_params
        page, size = p.get("page", "1"), p.get("page_size", "10")
        return Response(master.shoppers_list(q=p.get("q", ""), status=p.get("status", ""),
                                             page=int(page) if page.isdigit() else 1,
                                             page_size=int(size) if size.isdigit() else 10))


@extend_schema(tags=["admin"])
class AdminShopperDetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request, user_id):
        from Apps.admin_panel import master

        return Response(master.shopper_detail(_user_or_404(user_id)))


@extend_schema(tags=["admin"])
class AdminShopperNoteView(APIView):
    """POST {body}: add an internal note (never shown to the shopper)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, user_id):
        from Apps.admin_panel import master

        user = _user_or_404(user_id)
        _run(master.add_note, admin=request.user, user=user, body=str(request.data.get("body", "")))
        return Response(master.shopper_detail(user))


@extend_schema(tags=["admin"])
class AdminShopperWalletAdjustView(APIView):
    """POST {direction: credit|debit, amount, reason}: wallet adjustment."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, user_id):
        from Apps.admin_panel import master

        user = _user_or_404(user_id)
        direction = request.data.get("direction", "credit")
        if direction not in ("credit", "debit"):
            raise ValidationError({"detail": "direction must be credit or debit."})
        _run(master.adjust_wallet, admin=request.user, user=user, amount=request.data.get("amount", "0"),
             direction=direction, reason=str(request.data.get("reason", "")))
        return Response(master.shopper_detail(user))


@extend_schema(tags=["admin"])
class AdminReservationCancelView(APIView):
    """POST {reason}: cancel an open claim (Nibbl Admin only; audit-logged)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, reservation_id):
        from Apps.admin_panel import master
        from Apps.reservations.models import Reservation

        reservation = Reservation.objects.filter(id=reservation_id).select_related("hold").first()
        if reservation is None:
            raise NotFound("Claim not found.")
        _run(master.cancel_reservation, admin=request.user, reservation=reservation,
             reason=str(request.data.get("reason", "")))
        return Response(master.shopper_detail(reservation.user))


@extend_schema(tags=["admin"])
class AdminSuspensionBoardView(APIView):
    """Suspensions: summary + list. ?q&status=active|removed&days="""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request):
        from Apps.admin_panel import master

        p = request.query_params
        days = p.get("days", "")
        return Response(master.suspensions_board(q=p.get("q", ""), status=p.get("status", ""),
                                                 days=int(days) if days.isdigit() else None))


@extend_schema(tags=["admin"])
class AdminSuspensionRemoveView(APIView):
    """POST {reason}: remove one brand suspension."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, suspension_id):
        from Apps.admin_panel import master
        from Apps.brands.models import BrandCustomerSuspension

        suspension = BrandCustomerSuspension.objects.filter(id=suspension_id).first()
        if suspension is None:
            raise NotFound("Suspension not found.")
        _run(master.remove_brand_suspension, admin=request.user, suspension=suspension,
             reason=str(request.data.get("reason", "")))
        return Response({"detail": "Brand suspension removed."})


@extend_schema(tags=["admin"])
class AdminStaffListView(APIView):
    """Admin Users: GET list (any admin); POST {email, full_name, role} adds
    one (Administrator only) and emails them a code to set a password."""

    permission_classes = [IsPlatformAdmin]

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdministrator()]
        return super().get_permissions()

    @extend_schema(responses={200: None})
    def get(self, request):
        from Apps.admin_panel import master

        return Response({"results": master.admin_users(), "me": str(request.user.id),
                         "my_role": request.user.admin_staff_role})

    @extend_schema(request=None, responses={201: None})
    def post(self, request):
        from Apps.admin_panel import master

        d = request.data
        _run(master.add_admin_user, admin=request.user, email=str(d.get("email", "")),
             full_name=str(d.get("full_name", "")), role=str(d.get("role", "")))
        return Response({"results": master.admin_users()}, status=201)


@extend_schema(tags=["admin"])
class AdminStaffDetailView(APIView):
    """PATCH {role} changes a staff role; DELETE removes Admin access."""

    permission_classes = [IsAdministrator]

    def _staff(self, user_id):
        user = User.objects.filter(id=user_id, is_deleted=False).first()
        if user is None or not user.is_platform_admin:
            raise NotFound("Admin user not found.")
        return user

    @extend_schema(request=None, responses={200: None})
    def patch(self, request, user_id):
        from Apps.admin_panel import master

        _run(master.change_admin_role, admin=request.user, user=self._staff(user_id),
             role=str(request.data.get("role", "")))
        return Response({"results": master.admin_users()})

    @extend_schema(request=None, responses={200: None})
    def delete(self, request, user_id):
        from Apps.admin_panel import master

        _run(master.remove_admin_user, admin=request.user, user=self._staff(user_id))
        return Response({"results": master.admin_users()})


# ---------------------------------------------------------------------------
# Product categories (Master Product Library #6: admin-managed)
# ---------------------------------------------------------------------------
def _category_payload():
    from django.db.models import Count

    from Apps.products.models import CategoryRequest, Product, ProductCategory

    counts = dict(Product.objects.filter(is_active=True).values_list("category").annotate(n=Count("id")))
    return {
        "categories": [{"id": str(c.id), "name": c.name, "is_active": c.is_active, "products": counts.get(c.name, 0)}
                       for c in ProductCategory.objects.all()],
        "requests": [{"id": str(r.id), "brand": r.brand.name, "name": r.name, "note": r.note, "status": r.status,
                      "decision_note": r.decision_note, "created_at": r.created_at}
                     for r in CategoryRequest.objects.select_related("brand").order_by("status", "-created_at")[:100]],
    }


@extend_schema(tags=["admin"])
class AdminProductCategoryView(APIView):
    """GET categories + brand requests; POST {name} adds a category."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request):
        return Response(_category_payload())

    @extend_schema(request=None, responses={201: None})
    def post(self, request):
        from Apps.common.models import AuditLog
        from Apps.products.models import ProductCategory

        name = str(request.data.get("name", "")).strip()[:100]
        if not name:
            raise ValidationError({"detail": "Enter a category name."})
        category = ProductCategory.objects.filter(name__iexact=name).first()
        if category is None:
            category = ProductCategory.objects.create(name=name)
        elif not category.is_active:
            category.is_active = True
            category.save(update_fields=["is_active", "updated_at"])
        services._audit(admin=request.user, action=AuditLog.Action.CREATE, target_type="product_category",
                        target_id=category.id, metadata={"event": "category_added", "name": category.name})
        return Response(_category_payload(), status=201)


@extend_schema(tags=["admin"])
class AdminProductCategoryDetailView(APIView):
    """PATCH {is_active}: hide or restore a category (products keep it)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def patch(self, request, category_id):
        from Apps.common.models import AuditLog
        from Apps.products.models import ProductCategory

        category = ProductCategory.objects.filter(id=category_id).first()
        if category is None:
            raise NotFound("Category not found.")
        category.is_active = bool(request.data.get("is_active"))
        category.save(update_fields=["is_active", "updated_at"])
        services._audit(admin=request.user, action=AuditLog.Action.UPDATE, target_type="product_category",
                        target_id=category.id, metadata={"event": "category_updated", "name": category.name,
                                                         "is_active": category.is_active})
        return Response(_category_payload())


@extend_schema(tags=["admin"])
class AdminCategoryRequestDecisionView(APIView):
    """POST approve | reject {note}. Approving adds the category."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: None})
    def post(self, request, request_id, action):
        from django.utils import timezone

        from Apps.common.models import AuditLog
        from Apps.products.models import CategoryRequest, ProductCategory

        req = CategoryRequest.objects.filter(id=request_id).first()
        if req is None:
            raise NotFound("Request not found.")
        if action not in ("approve", "reject"):
            raise NotFound()
        if req.status != CategoryRequest.Status.PENDING:
            raise ValidationError({"detail": "This request was already decided."})
        note = str(request.data.get("note", "")).strip()[:255]
        if action == "reject" and not note:
            raise ValidationError({"detail": "Tell the brand why (required)."})
        if action == "approve":
            category = ProductCategory.objects.filter(name__iexact=req.name).first()
            if category is None:
                ProductCategory.objects.create(name=req.name)
            elif not category.is_active:
                category.is_active = True
                category.save(update_fields=["is_active", "updated_at"])
        req.status = CategoryRequest.Status.APPROVED if action == "approve" else CategoryRequest.Status.REJECTED
        req.decision_note, req.decided_at = note, timezone.now()
        req.save(update_fields=["status", "decision_note", "decided_at", "updated_at"])
        services._audit(admin=request.user, action=AuditLog.Action.APPROVE if action == "approve" else AuditLog.Action.REJECT,
                        target_type="category_request", target_id=req.id,
                        metadata={"event": f"category_request_{action}d", "name": req.name, "brand": str(req.brand_id),
                                  "note": note})
        return Response(_category_payload())
