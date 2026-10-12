"""Review campaigns that already went live before Nibbl approval existed
count as approved, so they keep running and can be resumed after a pause."""

from django.db import migrations
from django.db.models import F


def forwards(apps, schema_editor):
    ReviewCampaign = apps.get_model("reviews", "ReviewCampaign")
    ReviewCampaign.objects.filter(status__in=["active", "paused", "ended"], approved_at__isnull=True).update(
        approved_at=F("created_at")
    )


class Migration(migrations.Migration):
    dependencies = [("reviews", "0006_review_would_buy_again_reviewcampaign_approved_at_and_more")]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
