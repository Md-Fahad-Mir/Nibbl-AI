from django.db import migrations
from django.db.models import F


def backfill(apps, schema_editor):
    """Shoppers already verified before this change keep their number as the
    'last verified' one, so re-verifying it later isn't treated as a change."""
    User = apps.get_model("accounts", "User")
    User.objects.filter(is_phone_verified=True, phone__isnull=False).update(
        last_verified_phone=F("phone"), phone_verified_at=F("updated_at")
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0008_user_last_verified_phone_user_phone_verified_at_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
