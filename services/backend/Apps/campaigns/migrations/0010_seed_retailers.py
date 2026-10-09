"""Seed Nibbl's retailer directory with major US grocery / mass / drug /
club retailers, and mark campaigns that already restrict receipts by
merchant (free-text ``allowed_merchants``) as Retailer Required."""

from django.db import migrations

RETAILERS = [
    "7-Eleven", "Albertsons", "Aldi", "Amazon", "Amazon Fresh", "BJ's Wholesale Club",
    "Costco", "CVS", "Dollar General", "Dollar Tree", "Food Lion", "Fred Meyer",
    "Giant Eagle", "Giant Food", "H-E-B", "Harris Teeter", "Hy-Vee", "Jewel-Osco",
    "King Soopers", "Kroger", "Meijer", "Publix", "Ralphs", "Rite Aid", "Safeway",
    "Sam's Club", "ShopRite", "Smart & Final", "Sprouts Farmers Market", "Stop & Shop",
    "Target", "Trader Joe's", "Vons", "Walgreens", "Walmart", "Wegmans", "Whole Foods Market",
    "WinCo Foods",
]


def forwards(apps, schema_editor):
    Retailer = apps.get_model("campaigns", "Retailer")
    Campaign = apps.get_model("campaigns", "Campaign")
    for name in RETAILERS:
        Retailer.objects.get_or_create(name=name, defaults={"is_verified": True})
    Campaign.objects.exclude(allowed_merchants="").update(retailer_required=True)


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0009_retailer_directory"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
