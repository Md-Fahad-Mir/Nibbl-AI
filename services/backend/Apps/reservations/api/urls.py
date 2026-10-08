from django.urls import path

from Apps.reservations.api import views

app_name = "reservations"

urlpatterns = [
    path(
        "reservations/",
        views.ReservationListCreateView.as_view(),
        name="reservation-list",
    ),
    path(
        "reservations/slots/",
        views.ClaimSlotsView.as_view(),
        name="claim-slots",
    ),
    path(
        "reservations/<uuid:reservation_id>/",
        views.ReservationDetailView.as_view(),
        name="reservation-detail",
    ),
]
