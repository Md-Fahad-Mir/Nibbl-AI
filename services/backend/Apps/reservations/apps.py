from django.apps import AppConfig


class ReservationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "Apps.reservations"
    label = "reservations"
    verbose_name = "Reservations"

    def ready(self):
        from Apps.reservations import signals  # noqa: F401
