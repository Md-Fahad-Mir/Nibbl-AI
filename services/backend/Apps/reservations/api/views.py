"""Consumer HTTP layer for reservations (claiming offers)."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
        try:
            reservation = services.create_reservation(
                user=request.user,
                campaign_id=serializer.validated_data["campaign"],
            )
        except ReservationError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(
            s.ReservationSerializer(reservation, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
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
