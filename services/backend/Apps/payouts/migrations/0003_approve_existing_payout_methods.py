from django.db import migrations


def approve_existing(apps, schema_editor):
    """Payout methods that already existed before the review hold are grandfathered
    in as approved, so current users can still withdraw."""
    PayoutMethod = apps.get_model("payouts", "PayoutMethod")
    PayoutMethod.objects.update(review_status="approved")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("payouts", "0002_payoutmethod_review_note_payoutmethod_review_status"),
    ]

    operations = [
        migrations.RunPython(approve_existing, noop),
    ]
