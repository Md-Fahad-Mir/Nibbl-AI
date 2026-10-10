"""HTTP layer: consumer payout methods/withdrawals + admin processing."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.accounts import risk
from Apps.accounts.twilio_verify import TwilioNotConfigured
from Apps.common.exceptions import DomainError
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.common.permissions import IsPlatformAdmin
from Apps.payouts import serializers as s
from Apps.payouts import services
from Apps.payouts.models import PayoutMethod
from Apps.payouts.selectors import (
    all_batches,
    all_withdrawals,
    get_batch,
    get_user_withdrawal,
    get_withdrawal,
    methods_for_user,
    withdrawals_for_user,
)


def _run(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except DomainError as exc:
        body = {"detail": str(exc)}
        # Machine-readable reason (e.g. "phone_verification_required") so
        # clients can route the shopper to the phone-verification step.
        if getattr(exc, "code", None):
            body["code"] = exc.code
        raise ValidationError(body)


# ---------------------------------------------------------------------------
# Consumer: payout methods
# ---------------------------------------------------------------------------
@extend_schema(tags=["payout-methods"])
class PayoutMethodListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.PayoutMethodSerializer(many=True)})
    def get(self, request):
        return Response(
            s.PayoutMethodSerializer(methods_for_user(request.user), many=True).data
        )

    @extend_schema(request=s.AddPayoutMethodSerializer, responses={201: s.PayoutMethodSerializer})
    def post(self, request):
        serializer = s.AddPayoutMethodSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        risk.record(request, request.user, "payout_method")
        method = _run(services.add_payout_method, user=request.user, **serializer.validated_data)
        return Response(s.PayoutMethodSerializer(method).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["payout-methods"])
class PayoutMethodDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, method_id):
        method = request.user.payout_methods.filter(id=method_id).first()
        if method is None:
            raise NotFound("Payout method not found.")
        _run(services.remove_payout_method, method)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Consumer: withdrawals
# ---------------------------------------------------------------------------
@extend_schema(tags=["withdrawals"])
class WithdrawalListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="withdrawals_list",
        responses={200: paginated_response_serializer(s.WithdrawalSerializer)},
    )
    def get(self, request):
        return paginate(
            self, request, withdrawals_for_user(request.user), s.WithdrawalSerializer
        )

    @extend_schema(request=s.RequestWithdrawalSerializer, responses={201: s.WithdrawalSerializer})
    def post(self, request):
        serializer = s.RequestWithdrawalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        risk.record(request, request.user, "withdrawal")
        withdrawal = _run(
            services.request_withdrawal,
            user=request.user,
            payout_method_id=serializer.validated_data["payout_method"],
            amount=serializer.validated_data["amount"],
            code=serializer.validated_data.get("code", ""),
        )
        return Response(
            s.WithdrawalSerializer(withdrawal).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["withdrawals"])
class WithdrawalSendCodeView(APIView):
    """Send an SMS verification code for a pending withdrawal (Twilio Verify)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.SendWithdrawalCodeSerializer, responses={200: s.WithdrawalCodeSentSerializer})
    def post(self, request):
        serializer = s.SendWithdrawalCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            phone = _run(
                services.start_withdrawal_verification,
                user=request.user,
                payout_method_id=serializer.validated_data["payout_method"],
                amount=serializer.validated_data["amount"],
            )
        except TwilioNotConfigured:
            return Response(
                {"detail": "SMS verification is not available right now."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"phone": phone}, status=status.HTTP_200_OK)


@extend_schema(tags=["withdrawals"])
class WithdrawalDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.WithdrawalSerializer})
    def get(self, request, withdrawal_id):
        withdrawal = get_user_withdrawal(request.user, withdrawal_id)
        if withdrawal is None:
            raise NotFound("Withdrawal not found.")
        return Response(s.WithdrawalSerializer(withdrawal).data)


# ---------------------------------------------------------------------------
# Admin: processing
# ---------------------------------------------------------------------------
def _admin_withdrawal(withdrawal_id):
    withdrawal = get_withdrawal(withdrawal_id)
    if withdrawal is None:
        raise NotFound("Withdrawal not found.")
    return withdrawal


@extend_schema(tags=["admin-payouts"])
class AdminWithdrawalListView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        parameters=[OpenApiParameter("status", str, description="Filter by status.")],
        responses={200: s.WithdrawalSerializer(many=True)},
    )
    def get(self, request):
        return Response(
            s.WithdrawalSerializer(
                all_withdrawals(status=request.query_params.get("status", "")), many=True
            ).data
        )


@extend_schema(tags=["admin-payouts"])
class AdminWithdrawalActionView(APIView):
    """approve / reject / flag / mark-paid / note via the `action` kwarg."""

    permission_classes = [IsPlatformAdmin]

    _ACTIONS = {"approve", "reject", "flag", "mark-paid", "note"}

    @extend_schema(request=s.ReasonSerializer, responses={200: s.WithdrawalSerializer})
    def post(self, request, withdrawal_id, action):
        if action not in self._ACTIONS:
            raise NotFound("Unknown action.")
        withdrawal = _admin_withdrawal(withdrawal_id)

        if action == "approve":
            withdrawal = _run(services.approve_withdrawal, withdrawal=withdrawal, admin=request.user)
        elif action == "mark-paid":
            withdrawal = _run(services.mark_paid, withdrawal=withdrawal, admin=request.user)
        elif action == "note":
            note = s.NoteSerializer(data=request.data)
            note.is_valid(raise_exception=True)
            withdrawal = _run(services.add_note, withdrawal=withdrawal, note=note.validated_data["note"])
        else:  # reject / flag take an optional reason
            reason_ser = s.ReasonSerializer(data=request.data)
            reason_ser.is_valid(raise_exception=True)
            reason = reason_ser.validated_data.get("reason", "")
            fn = services.reject_withdrawal if action == "reject" else services.flag_withdrawal
            withdrawal = _run(fn, withdrawal=withdrawal, admin=request.user, reason=reason)

        return Response(s.WithdrawalSerializer(withdrawal).data)


# ---------------------------------------------------------------------------
# Admin: payout-method review
# ---------------------------------------------------------------------------
def _admin_payout_method(method_id):
    method = PayoutMethod.objects.filter(id=method_id).select_related("user").first()
    if method is None:
        raise NotFound("Payout method not found.")
    return method


@extend_schema(tags=["admin-payouts"])
class AdminPendingPayoutMethodListView(APIView):
    """Payout methods awaiting review (new methods beyond a user's first)."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: s.AdminPayoutMethodSerializer(many=True)})
    def get(self, request):
        return Response(
            s.AdminPayoutMethodSerializer(
                services.list_pending_payout_methods(), many=True
            ).data
        )


@extend_schema(tags=["admin-payouts"])
class AdminPayoutMethodReviewView(APIView):
    """Approve or reject a payout method held for review."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        request=s.ReviewPayoutMethodSerializer,
        responses={200: s.AdminPayoutMethodSerializer},
    )
    def post(self, request, method_id):
        method = _admin_payout_method(method_id)
        payload = s.ReviewPayoutMethodSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        method = _run(
            services.review_payout_method,
            method=method,
            approve=payload.validated_data["approve"],
            note=payload.validated_data.get("note", ""),
        )
        return Response(s.AdminPayoutMethodSerializer(method).data)


# ---------------------------------------------------------------------------
# Admin: batches
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin-payouts"])
class AdminBatchListCreateView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: s.PayoutBatchSerializer(many=True)})
    def get(self, request):
        return Response(s.PayoutBatchSerializer(all_batches(), many=True).data)

    @extend_schema(request=s.CreateBatchSerializer, responses={201: s.PayoutBatchSerializer})
    def post(self, request):
        serializer = s.CreateBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        batch = _run(
            services.create_batch,
            admin=request.user,
            withdrawal_ids=serializer.validated_data.get("withdrawal_ids") or None,
        )
        return Response(s.PayoutBatchSerializer(batch).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["admin-payouts"])
class AdminBatchExportView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request, batch_id):
        batch = get_batch(batch_id)
        if batch is None:
            raise NotFound("Batch not found.")
        return Response(services.export_batch(batch))
