from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "Apps.accounts"
    label = "accounts"
    verbose_name = "Accounts"

    def ready(self):
        # Referral qualification steps.
        from Apps.accounts import receivers  # noqa: F401
