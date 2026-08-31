# Generated for the full-data receipt fingerprint (Apps.receipts.ocr).

import django.db.models.deletion
from django.db import migrations, models


def clear_legacy_fingerprints(apps, schema_editor):
    """Retire fingerprints produced by the previous (5-field) algorithm.

    The new fingerprint hashes the complete normalized OCR payload (merchant,
    transaction, every item, totals, payment, ...), not just product/shop/
    date/time/receipt-number — an entirely different input, so old and new
    hashes are not comparable. Clearing avoids the false impression that a
    `full_fingerprint` value already on a row was produced by the current
    algorithm when it in fact predates this migration.
    """
    Receipt = apps.get_model("receipts", "Receipt")
    Receipt.objects.exclude(full_fingerprint=None).update(full_fingerprint=None)


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0003_alter_product_image_url"),
        ("receipts", "0002_receipt_receipt_number_alter_receipt_fingerprint"),
    ]

    operations = [
        migrations.RenameField(
            model_name="receipt",
            old_name="fingerprint",
            new_name="full_fingerprint",
        ),
        migrations.AlterField(
            model_name="receipt",
            name="full_fingerprint",
            field=models.CharField(
                blank=True, db_index=True, max_length=64, null=True, unique=True
            ),
        ),
        migrations.AddField(
            model_name="receipt",
            name="matched_product",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="matched_receipts",
                to="products.product",
            ),
        ),
        migrations.AddField(
            model_name="ocrresult",
            name="canonical_data",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="ocrresult",
            name="confidence",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.RunPython(
            clear_legacy_fingerprints, migrations.RunPython.noop
        ),
    ]
