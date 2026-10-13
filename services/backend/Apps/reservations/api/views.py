"""Consumer HTTP layer for reservations (claiming offers)."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.accounts import risk
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.reservations import serializers as s
from Apps.reservations import services
from Apps.reservations.selectors import get_user_reservation, reservations_for_user
from Apps.reservations.services import ReservationError


@extend_schema(tags=["reservations"])
class ReservationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="reservations_list",
        parameters=[OpenApiParameter("status", str, description="Filter by status.")],
        responses={200: paginated_response_serializer(s.ReservationSerializer)},
    )
    def get(self, request):
        reservations = reservations_for_user(
            request.user, status=request.query_params.get("status", "")
        )
        return paginate(
            self, request, reservations, s.ReservationSerializer,
            context={"request": request},
        )

    @extend_schema(request=s.CreateReservationSerializer, responses={201: s.ReservationSerializer})
    def post(self, request):
        serializer = s.CreateReservationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Master "Reserve Offer": two distinct checked consents are required
        # (Nibbl email + SMS, Brand email + SMS) — "Required consent" pop-up.
        from Apps.reservations.restrictions import popup

        if not (serializer.validated_data["consent_nibbl"] and serializer.validated_data["consent_brand"]):
            from Apps.campaigns.models import Campaign

            campaign = Campaign.objects.select_related("brand").filter(id=serializer.validated_data["campaign"]).first()
            # A plain Response keeps numbers/dates typed (a ValidationError would stringify them).
            return Response({
                "detail": "Please agree to both Nibbl and brand email and SMS to claim this offer.",
                "code": "consent_required",
                **popup("consent_required", campaign=campaign),
            }, status=status.HTTP_400_BAD_REQUEST)
        try:
            reservation = services.create_reservation(
                user=request.user,
                campaign_id=serializer.validated_data["campaign"],
                consent_nibbl=serializer.validated_data["consent_nibbl"],
                consent_brand=serializer.validated_data["consent_brand"],
            )
        except ReservationError as exc:
            # `title` / `message` (+ days_remaining, starts_at, slot_limit, note)
            # are the Master pop-up copy; `detail` stays as before.
            return Response({"detail": str(exc), "code": exc.code,
                             **popup(exc.code, campaign=exc.campaign, user=request.user,
                                     slot_limit=exc.slot_limit)}, status=status.HTTP_400_BAD_REQUEST)
        risk.record(request, request.user, "claim")
        if serializer.validated_data["contact_phone"]:
            from Apps.accounts.services import remember_phone

            remember_phone(request.user, serializer.validated_data["contact_phone"],
                           serializer.validated_data["phone_country"])
        return Response(
            s.ReservationSerializer(reservation, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["reservations"])
class ClaimSlotsView(APIView):
    """The shopper's active-claim slot usage (e.g. 3 of 5)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ClaimSlotsSerializer})
    def get(self, request):
        return Response(
            s.ClaimSlotsSerializer(services.claim_slots(request.user)).data
        )


@extend_schema(tags=["reservations"])
class ReservationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReservationSerializer})
    def get(self, request, reservation_id):
        reservation = get_user_reservation(request.user, reservation_id)
        if reservation is None:
            raise NotFound("Reservation not found.")
        return Response(
            s.ReservationSerializer(reservation, context={"request": request}).data
        )
