"""Give existing products their permanent Product ID (PRD-001… per brand, in
creation order) and seed Nibbl's standard category list (owner-approved)."""

from django.db import migrations

STANDARD_CATEGORIES = [
    "Snacks", "Beverages", "Pantry", "Dairy", "Frozen", "Health & Wellness",
    "Beauty & Personal Care", "Household", "Baby", "Pet",
]


def forwards(apps, schema_editor):
    Product = apps.get_model("products", "Product")
    ProductCategory = apps.get_model("products", "ProductCategory")
    counters: dict = {}
    for product in Product.objects.filter(code="").order_by("brand_id", "created_at", "id"):
        counters[product.brand_id] = counters.get(product.brand_id, 0) + 1
        Product.objects.filter(pk=product.pk).update(code=f"PRD-{counters[product.brand_id]:03d}")
    for name in STANDARD_CATEGORIES:
        ProductCategory.objects.get_or_create(name=name)


class Migration(migrations.Migration):
    dependencies = [("products", "0004_categoryrequest_productcategory_and_more")]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
