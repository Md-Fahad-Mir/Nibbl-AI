"""Replace the brand-campaign/chat-session review system with a flat,
AI-service-generated review + reward flow (Apps.reviews.services).

Drops ReviewCampaign, ReviewPrompt, ReviewSession and ReviewModeration
entirely -- no campaign budget, no fee, no receipt gate, no moderation hold
in the new flow -- and recreates Review from scratch with the fields the new
flow actually needs. This is a clean replacement, not a data migration: any
existing rows in the old tables are dropped along with them.
"""

import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("brands", "0001_initial"),
        ("products", "0003_alter_product_image_url"),
        ("reviews", "0002_reviewsession_ai_review_content"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Deleted in dependency order: leaf (most-referencing) models first.
        migrations.DeleteModel(name="ReviewModeration"),
        migrations.DeleteModel(name="Review"),
        migrations.DeleteModel(name="ReviewSession"),
        migrations.DeleteModel(name="ReviewPrompt"),
        migrations.DeleteModel(name="ReviewCampaign"),
        migrations.CreateModel(
            name="Review",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("title", models.CharField(blank=True, max_length=255)),
                ("content", models.TextField(blank=True)),
                ("rating", models.PositiveSmallIntegerField()),
                ("ai_generated", models.BooleanField(default=True)),
                ("disclosure", models.CharField(blank=True, max_length=255)),
                ("questions_and_answers", models.JSONField(blank=True, default=list)),
                ("ai_raw_response", models.JSONField(blank=True, default=dict)),
                ("brand", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reviews", to="brands.brand")),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="reviews", to="products.product")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="reviews", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="review",
            index=models.Index(fields=["product"], name="reviews_rev_product_a9ee0d_idx"),
        ),
        migrations.AddIndex(
            model_name="review",
            index=models.Index(fields=["brand"], name="reviews_rev_brand_i_c8b44b_idx"),
        ),
        migrations.AddConstraint(
            model_name="review",
            constraint=models.UniqueConstraint(fields=("user", "product"), name="uniq_review_per_user_product"),
        ),
    ]
