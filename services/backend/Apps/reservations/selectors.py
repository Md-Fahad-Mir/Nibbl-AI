"""Read-side queries for reservations."""

from Apps.reservations.models import Reservation


def reservations_for_user(user, *, status: str = ""):
    qs = Reservation.objects.filter(user=user).select_related(
        "campaign", "campaign__brand"
    ).prefetch_related("campaign__products")
    if status:
        qs = qs.filter(status=status)
    return qs


def get_user_reservation(user, reservation_id) -> Reservation | None:
    return (
        Reservation.objects.filter(user=user, id=reservation_id)
        .select_related("campaign", "campaign__brand")
        .prefetch_related("campaign__products")
        .first()
    )


def active_reservation_for(user, campaign) -> Reservation | None:
    """The user's current (still-claimable) reservation for a campaign, if any."""
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return (
        Reservation.objects.filter(
            user=user, campaign=campaign, status=Reservation.Status.ACTIVE
        )
        .order_by("-created_at")
        .first()
    )
