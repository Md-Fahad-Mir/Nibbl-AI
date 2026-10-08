"""Campaigns that were already running before the approval workflow are
treated as approved (decision 2026-10-08); drafts start unsubmitted."""

from django.db import migrations


def forwards(apps, schema_editor):
    Campaign = apps.get_model("campaigns", "Campaign")
    Campaign.objects.exclude(status="draft").update(review_status="approved")


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0006_campaign_review_status_campaignreview"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
