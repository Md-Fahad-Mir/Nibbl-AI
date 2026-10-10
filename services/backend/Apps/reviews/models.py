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
from Apps.common.money import MONEY_FIELD


class ReviewCampaign(BaseModel):
    """A brand's review campaign (Master: Create Review Campaign). Each
    eligible product found on a verified rebate receipt may create one
    review opportunity; the shopper reward is always the platform amount
    ($1) and the brand also pays its plan's review fee."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        ENDED = "ended", "Ended"
        ARCHIVED = "archived", "Archived"

    COOLDOWN_CHOICES = (0, 30, 60, 90)

    brand = models.ForeignKey("brands.Brand", on_delete=models.CASCADE, related_name="review_campaigns")
    name = models.CharField(max_length=255)
    image = models.ImageField(upload_to="review_campaign_images/%Y/%m/", blank=True, null=True)
    products = models.ManyToManyField("products.Product", related_name="review_campaigns", blank=True)
    # Extra context for the AI questions (optional; product data is used too).
    product_context = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)
    # Desired number of review opportunities per day.
    daily_opportunities = models.PositiveIntegerField(default=25)
    # Per shopper + product: 0 (none) / 30 / 60 / 90 (recommended), or once ever.
    product_cooldown_days = models.PositiveIntegerField(default=90)
    one_time_only = models.BooleanField(default=False)
    auto_paused = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    @property
    def is_live(self) -> bool:
        from django.utils import timezone

        if self.status != self.Status.ACTIVE:
            return False
        now = timezone.now()
        return not (self.start_at and now < self.start_at) and not (self.end_at and now >= self.end_at)


class ReviewPrompt(BaseModel):
    """A brand question in the campaign's pool; one is rotated into each
    review conversation (least-used first)."""

    class Source(models.TextChoices):
        BRAND = "brand", "Brand"
        AI = "ai", "AI suggestion"

    review_campaign = models.ForeignKey(ReviewCampaign, on_delete=models.CASCADE, related_name="prompts")
    text = models.CharField(max_length=500)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.BRAND)
    times_used = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.text[:60]


class ReviewSession(BaseModel):
    """A review opportunity (Master: Shopper Review Opportunity): created
    from a verified rebate receipt, reserves the reward + fee, 30 days to
    complete. Holds the conversation and the AI draft."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Open"
        COMPLETED = "completed", "Completed"
        EXPIRED = "expired", "Expired"

    review_campaign = models.ForeignKey(ReviewCampaign, on_delete=models.PROTECT, related_name="sessions")
    product = models.ForeignKey("products.Product", on_delete=models.PROTECT, related_name="review_sessions")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="review_sessions")
    receipt = models.ForeignKey(
        "receipts.Receipt", on_delete=models.SET_NULL, null=True, blank=True, related_name="review_sessions"
    )
    reward_amount = models.DecimalField(**MONEY_FIELD)
    fee_amount = models.DecimalField(**MONEY_FIELD)
    hold = models.ForeignKey("wallets.Hold", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    expires_at = models.DateTimeField()
    # Planned questions (product questions + one rotated brand question).
    questions = models.JSONField(default=list, blank=True)
    brand_question = models.CharField(max_length=500, blank=True)
    # Chat transcript: [{"role": "assistant"|"user", "content": "..."}].
    messages = models.JSONField(default=list, blank=True)
    ai_review_title = models.CharField(max_length=255, blank=True)
    ai_review_content = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "status"]), models.Index(fields=["review_campaign", "created_at"])]

    def __str__(self):
        return f"review opportunity {self.id} ({self.status})"


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

    # --- Review campaigns + moderation (Master #23–27) -----------------------
    class Status(models.TextChoices):
        PUBLISHED = "published", "Published"
        HELD = "held", "Held for brand response"  # 1–3★, 7 days
        FLAGGED = "flagged", "Flagged by brand (Nibbl reviewing)"
        REMOVED = "removed", "Removed"

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PUBLISHED)
    published_at = models.DateTimeField(null=True, blank=True)
    held_until = models.DateTimeField(null=True, blank=True)
    review_campaign = models.ForeignKey(
        ReviewCampaign, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviews"
    )
    session = models.OneToOneField(
        ReviewSession, null=True, blank=True, on_delete=models.SET_NULL, related_name="review"
    )
    # Captured in the conversation (Master: recommendation / repurchase intent).
    would_recommend = models.BooleanField(null=True, blank=True)
    # Brand's public response (shown with the review).
    brand_response = models.TextField(blank=True)
    brand_response_at = models.DateTimeField(null=True, blank=True)
    flag_reason = models.CharField(max_length=100, blank=True)
    flag_note = models.TextField(blank=True)
    flagged_at = models.DateTimeField(null=True, blank=True)
    helpful_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # Direct (non-campaign) reviews stay one per shopper + product.
            # Campaign reviews may repeat after the campaign's cooldown.
            models.UniqueConstraint(
                fields=["user", "product"], condition=models.Q(session__isnull=True),
                name="uniq_direct_review_per_user_product",
            ),
        ]
        indexes = [
            models.Index(fields=["product"]),
            models.Index(fields=["brand"]),
        ]

    def __str__(self):
        return f"{self.rating}★ review of {self.product_id} by {self.user_id}"


class ReviewHelpfulVote(BaseModel):
    """A shopper marking a review helpful (once per shopper)."""

    review = models.ForeignKey(Review, on_delete=models.CASCADE, related_name="helpful_votes")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["review", "user"], name="uniq_helpful_vote")]
