"""Reviews module: AI chat-based review collection with budget, rules & moderation.

Flow: a verified receipt unlocks review *opportunities* (ReviewSession) for the
eligible products on it (rules engine). Each session reserves the reward + fee
on the brand wallet (budget includes fee). The user completes a chat-based
session and submits a rating + text; the reward is issued regardless of rating,
then moderation publishes (3★+) or holds (1–2★) the review.
"""

from django.conf import settings
from django.db import models

from Apps.common.models import BaseModel
from Apps.common.money import MONEY_FIELD


class ReviewCampaign(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        COMPLETED = "completed", "Completed"
        ARCHIVED = "archived", "Archived"

    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="review_campaigns"
    )
    name = models.CharField(max_length=255)
    products = models.ManyToManyField(
        "products.Product", related_name="review_campaigns"
    )
    # Brand-supplied context the AI uses to generate prompts.
    product_context = models.TextField(blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    daily_budget = models.DecimalField(**MONEY_FIELD)
    reward_amount = models.DecimalField(**MONEY_FIELD)
    auto_paused = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["brand", "status"])]

    def __str__(self):
        return self.name

    @property
    def is_live(self) -> bool:
        return self.status == self.Status.ACTIVE


class ReviewPrompt(BaseModel):
    class Source(models.TextChoices):
        AI = "ai", "AI-generated"
        CUSTOM = "custom", "Brand custom"

    review_campaign = models.ForeignKey(
        ReviewCampaign, on_delete=models.CASCADE, related_name="prompts"
    )
    text = models.CharField(max_length=500)
    order = models.PositiveIntegerField(default=0)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.AI)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self):
        return self.text


class ReviewSession(BaseModel):
    """A reserved review opportunity + the chat container.

    Acts as the review's reservation: it holds the escrowed reward+fee and
    expires in 7 days (expiry does not restore budget).
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        EXPIRED = "expired", "Expired"

    BUDGET_CONSUMING = (Status.ACTIVE, Status.COMPLETED, Status.EXPIRED)

    review_campaign = models.ForeignKey(
        ReviewCampaign, on_delete=models.PROTECT, related_name="sessions"
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="review_sessions"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="review_sessions"
    )
    receipt = models.ForeignKey(
        "receipts.Receipt", on_delete=models.CASCADE, related_name="review_sessions"
    )

    reward_amount = models.DecimalField(**MONEY_FIELD)
    fee_amount = models.DecimalField(**MONEY_FIELD)
    hold = models.ForeignKey(
        "wallets.Hold", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="review_session",
    )

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE
    )
    expires_at = models.DateTimeField()
    messages = models.JSONField(default=list, blank=True)
    # Written by the AI review service from the Q&A above once every prompt is
    # answered. Shown to the reviewer straight after "thank you"; submitting
    # without edits publishes this text as-is.
    ai_review_content = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "product", "receipt"],
                name="uniq_review_session_per_receipt_product",
            )
        ]
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["review_campaign", "status"]),
        ]

    def __str__(self):
        return f"ReviewSession {self.id} ({self.status})"


class Review(BaseModel):
    class Status(models.TextChoices):
        PUBLISHED = "published", "Published"
        HELD = "held", "Held"
        REMOVED = "removed", "Removed"

    review_campaign = models.ForeignKey(
        ReviewCampaign, on_delete=models.PROTECT, related_name="reviews"
    )
    product = models.ForeignKey(
        "products.Product", on_delete=models.PROTECT, related_name="reviews"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews"
    )
    session = models.OneToOneField(
        ReviewSession, on_delete=models.PROTECT, related_name="review"
    )
    rating = models.PositiveSmallIntegerField()
    content = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product", "status"]),
            models.Index(fields=["user", "product"]),
        ]

    def __str__(self):
        return f"{self.rating}★ review of {self.product_id} ({self.status})"


class ReviewModeration(BaseModel):
    """Moderation detail/audit for a review (1–2★ hold, brand removal)."""

    review = models.OneToOneField(
        Review, on_delete=models.CASCADE, related_name="moderation"
    )
    auto_published = models.BooleanField(default=False)
    held_until = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)
    removed = models.BooleanField(default=False)
    removed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="removed_reviews",
    )
    removal_reason = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"Moderation for {self.review_id}"
