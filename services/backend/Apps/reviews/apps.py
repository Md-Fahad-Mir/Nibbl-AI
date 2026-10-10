from django.apps import AppConfig


class ReviewsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "Apps.reviews"
    label = "reviews"
    verbose_name = "Reviews"

    def ready(self):
        from Apps.reviews import signals  # noqa: F401
