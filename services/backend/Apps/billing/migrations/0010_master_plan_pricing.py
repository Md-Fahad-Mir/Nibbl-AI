from decimal import Decimal

from django.db import migrations

# Master Plans §3: price every 30 days, and the Nibbl review fee on top of the
# $1 shopper reward ($5 / $4 / $3 per completed review including the reward).
PRICING = {
    "starter": {"monthly_price": Decimal("39.00"), "review_fee": Decimal("4.00"), "rebate_fee_percent": Decimal("20.00")},
    "pro": {"monthly_price": Decimal("199.00"), "review_fee": Decimal("3.00"), "rebate_fee_percent": Decimal("15.00")},
    "scale": {"monthly_price": Decimal("999.00"), "review_fee": Decimal("2.00"), "rebate_fee_percent": Decimal("10.00")},
}


def set_pricing(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for slug, values in PRICING.items():
        Plan.objects.filter(slug=slug).update(**values)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0009_subscription_scheduled_plan_change"),
    ]

    operations = [
        migrations.RunPython(set_pricing, noop),
    ]
