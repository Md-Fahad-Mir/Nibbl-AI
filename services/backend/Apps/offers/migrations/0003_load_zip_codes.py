"""Load the US ZIP directory (GeoNames, CC BY 4.0) from offers/data."""

import csv
from pathlib import Path

from django.db import migrations

DATA = Path(__file__).resolve().parent.parent / "data" / "us_zip_codes.csv"


def forwards(apps, schema_editor):
    ZipCode = apps.get_model("offers", "ZipCode")
    if ZipCode.objects.exists():
        return
    with DATA.open(newline="") as f:
        rows = [
            ZipCode(zip=r["zip"], state=r["state"], lat=float(r["lat"]), lng=float(r["lng"]))
            for r in csv.DictReader(f)
        ]
    ZipCode.objects.bulk_create(rows, batch_size=2000)


def backwards(apps, schema_editor):
    apps.get_model("offers", "ZipCode").objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("offers", "0002_shopperlocation_zipcode"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
