"""Create a Referral for every shopper who was already referred.

Paid when their referrer already received the $5 under the old
pay-at-signup rule (no second payment — same idempotency key); otherwise
in progress, and the qualification steps fill in from their next activity.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Referral = apps.get_model("accounts", "Referral")
    LedgerEntry = apps.get_model("wallets", "LedgerEntry")
    for user in User.objects.filter(referred_by__isnull=False, is_deleted=False):
        if Referral.objects.filter(referred=user).exists():
            continue
        bonus = LedgerEntry.objects.filter(category="referral_bonus", reference_id=str(user.id)).first()
        Referral.objects.create(
            referrer_id=user.referred_by_id, referred=user,
            status="paid" if bonus else "in_progress",
            reward_amount=bonus.amount if bonus else None,
            paid_at=bonus.created_at if bonus else None,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0014_referrals"),
        ("wallets", "0001_initial"),
    ]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
