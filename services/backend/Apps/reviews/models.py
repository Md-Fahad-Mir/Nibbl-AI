"""Reviews module: AI-generated product reviews + flat per-review reward.

Flow: the frontend calls the AI service's own /reviews/questions endpoint
directly to get questions for a product, collects the user's answers, and
posts product + questions + answers to this app. This app sends that to the
AI service's /reviews/generate endpoint, saves the result as a Review, and
pays a flat reward from the product's brand wallet to the reviewer -- once
per (user, product), idempotently (Apps.reviews.services).
"""

from django.conf import settings
from django.db import models

from Apps.common.models import BaseModel


class Review(BaseModel):
    """An AI-generated review of a product, written from a user's own Q&A."""

    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="reviews"
    )
    # Denormalized for tenant-scoped brand queries and the reward's wallet
    # lookup, matching Apps.receipts.models.Receipt's convention.
    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="reviews"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews"
    )

    title = models.CharField(max_length=255, blank=True)
    content = models.TextField(blank=True)
    rating = models.PositiveSmallIntegerField()

    # The AI service's own disclosure of whether this text was invented
    # (no answers) or grounded in the user's stated experience (answers
    # supplied -- always true here, since answers are required to submit).
    # See services/ai's app/schemas/review.py:GeneratedReview.
    ai_generated = models.BooleanField(default=True)
    disclosure = models.CharField(max_length=255, blank=True)

    # The exact (question, answer) pairs submitted -- audit trail and lets
    # the review be re-displayed alongside the Q&A that produced it.
    questions_and_answers = models.JSONField(default=list, blank=True)
    # The AI service's complete response envelope for this generation call.
    # Kept alongside the parsed fields above for audit/support, same
    # rationale as Apps.receipts.models.OCRResult.raw.
    ai_raw_response = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "product"], name="uniq_review_per_user_product"
            ),
        ]
        indexes = [
            models.Index(fields=["product"]),
            models.Index(fields=["brand"]),
        ]

    def __str__(self):
        return f"{self.rating}★ review of {self.product_id} by {self.user_id}"
