"""Rebate campaign configuration (brand side).

A Campaign offers ONE deal type (Free, BOGO Free, Buy 1 Get 1 50% Off, Buy X
Get $Y) whose locked rules decide the payout from the verified receipt
(Apps.rebates.reward_math). Volume is limited by a 25-hour Claim Capacity
that resets every 25 hours from activation.

Legacy fields (reward tiers, fallback offer, daily budget) remain for
existing data and the old builder; their inputs are mapped onto the deal
model (Apps.campaigns.services) so there is a single reward engine.
"""

from django.conf import settings
from django.db import models

from Apps.common.models import BaseModel
from Apps.common.money import MONEY_FIELD
from Apps.common.text import random_code


class Retailer(BaseModel):
    """Nibbl's retailer directory (Master: Retailer Availability). Brands pick
    from it; a brand may add a missing retailer, flagged for Nibbl to verify."""

    name = models.CharField(max_length=120, unique=True)
    is_verified = models.BooleanField(default=True)
    added_by_brand = models.ForeignKey(
        "brands.Brand", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="added_retailers",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Campaign(BaseModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        PAUSED = "paused", "Paused"
        COMPLETED = "completed", "Completed"
        ARCHIVED = "archived", "Archived"

    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="campaigns"
    )
    products = models.ManyToManyField(
        "products.Product", related_name="campaigns"
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    # Shown at the top of the shopper offer (one product, several, or other
    # campaign creative).
    image = models.ImageField(upload_to="campaign_images/%Y/%m/", blank=True, null=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    # Legacy $-per-day budget (old builder). The deal model uses the 25-hour
    # Claim Capacity below; a legacy budget is converted into it.
    daily_budget = models.DecimalField(null=True, blank=True, **MONEY_FIELD)

    # --- Deal (Master: Offer Setup / Offer Details) ---------------------------
    class DealType(models.TextChoices):
        FREE = "free", "Free"
        BOGO_FREE = "bogo_free", "BOGO Free"
        BOGO_HALF = "bogo_half", "Buy 1, Get 1 50% Off"
        BUY_X_GET_Y = "buy_x_get_y", "Buy X, Get $Y Off"

    deal_type = models.CharField(
        max_length=20, choices=DealType.choices, default=DealType.FREE
    )
    # Most Nibbl reimburses per approved redemption (Free / BOGO types).
    max_rebate = models.DecimalField(null=True, blank=True, **MONEY_FIELD)
    # Buy X Get $Y: the fixed reward (also its maximum) and X (1-3).
    fixed_reward = models.DecimalField(null=True, blank=True, **MONEY_FIELD)
    required_quantity = models.PositiveSmallIntegerField(default=1)
    # Shopper wording — suggested by Nibbl per deal type, editable by the brand.
    offer_headline = models.CharField(max_length=255, blank=True)
    offer_description = models.TextField(blank=True)

    # --- 25-Hour Claim Capacity ------------------------------------------------
    desired_redemptions = models.PositiveIntegerField(null=True, blank=True)
    # Percent, e.g. 30.00 for 30%.
    estimated_redemption_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    # ceil(desired_redemptions / rate) — claims allowed per 25-hour cycle.
    claim_capacity = models.PositiveIntegerField(null=True, blank=True)
    # Cycle anchor: capacity resets every 25 hours from this moment.
    activated_at = models.DateTimeField(null=True, blank=True)

    # Minimum purchase logic (units, not currency) + BOGO (spec 2.15).
    min_purchase_units = models.PositiveIntegerField(default=1)
    is_bogo = models.BooleanField(default=False)

    # Customer cooldown after an APPROVED redemption: 0 (none), 30, 60 or 90
    # days — or one redemption ever when one_time_only is set.
    cooldown_days = models.PositiveIntegerField(default=30)
    one_time_only = models.BooleanField(default=False)

    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)

    # Optional merchant/store restriction (comma-separated, matched
    # case/punctuation-insensitively against the receipt's OCR merchant
    # name). Blank -- the default, and every campaign before this field
    # existed -- means no restriction: the platform's long-standing "any
    # shop" model (spec: receipts are verified by product match only, never
    # by shop) is unaffected unless a brand opts in. See
    # Apps.receipts.services._check_merchant.
    allowed_merchants = models.TextField(blank=True)

    # Retailer Availability (Where to Buy + discovery store match), up to
    # three Featured Retailers for the offer summary, and the receipt rule:
    # Retailer Required → the receipt must be from one of ``retailers``
    # (kept in ``allowed_merchants`` for receipt checks and claim snapshots).
    retailers = models.ManyToManyField(Retailer, blank=True, related_name="campaigns")
    featured_retailers = models.ManyToManyField(Retailer, blank=True, related_name="featured_in")
    retailer_required = models.BooleanField(default=False)

    # Discovery Geography (Master): where the campaign appears in discovery.
    # It never affects direct entry (URL / QR / ads) or receipt rules.
    class Geography(models.TextChoices):
        NATIONWIDE = "nationwide", "Nationwide"
        STATES = "states", "Selected States"
        ZIP_RADIUS = "zip_radius", "ZIP + Radius"

    geography = models.CharField(max_length=12, choices=Geography.choices, default=Geography.NATIONWIDE)
    # Selected States: two-letter codes, e.g. ["CA", "NV"].
    geography_states = models.JSONField(default=list, blank=True)
    # ZIP + Radius: [{"zip": "94103", "radius_miles": 25}, ...].
    geography_areas = models.JSONField(default=list, blank=True)

    # True when paused automatically due to insufficient wallet funds, so the
    # funding sync can safely resume it (vs a manual pause).
    auto_paused = models.BooleanField(default=False)
    # Master: Meta Pixel Tracking — the brand turns tracking on per campaign.
    meta_pixel_enabled = models.BooleanField(default=False)

    # --- Nibbl approval (Master: Submission and revision rules) ---------------
    # Separate from `status` (draft/active/...): a campaign can only be
    # activated once approved; later edits are reviewed as a CampaignReview
    # revision while this approved version stays live.
    class ReviewStatus(models.TextChoices):
        NOT_SUBMITTED = "not_submitted", "Not submitted"
        PENDING_REVIEW = "pending_review", "Pending review"
        CHANGES_REQUESTED = "changes_requested", "Changes requested"
        REJECTED = "rejected", "Rejected"
        APPROVED = "approved", "Approved"

    review_status = models.CharField(
        max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.NOT_SUBMITTED
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["brand", "status"]),
        ]

    def __str__(self):
        return self.name

    @property
    def is_live(self) -> bool:
        """Claimable now: active and inside its start/end dates."""
        if self.status != self.Status.ACTIVE:
            return False
        from django.utils import timezone

        now = timezone.now()
        if self.start_at and now < self.start_at:
            return False
        return not (self.end_at and now >= self.end_at)

    @property
    def display_status(self) -> str:
        """Brand-facing status (Master: Pending Review, Changes Requested,
        Scheduled, Active, Paused, Ended...)."""
        if self.review_status != self.ReviewStatus.APPROVED:
            return {
                self.ReviewStatus.NOT_SUBMITTED: "draft",
            }.get(self.review_status, self.review_status)
        if self.status == self.Status.ACTIVE:
            from django.utils import timezone

            now = timezone.now()
            if self.start_at and now < self.start_at:
                return "scheduled"
            if self.end_at and now >= self.end_at:
                return "ended"
            return "active"
        if self.status in (self.Status.COMPLETED, self.Status.ARCHIVED):
            return "ended"
        # Approved but not live yet (e.g. waiting for wallet funds) / paused.
        return "approved" if self.status == self.Status.DRAFT else self.status


class CampaignReview(BaseModel):
    """One Nibbl review of a campaign: its first submission (NEW) or an edit
    to an approved campaign (REVISION). A revision holds the proposed changes
    and applies them only when approved. Doubles as the campaign's review
    activity history."""

    class Kind(models.TextChoices):
        NEW = "new", "New campaign"
        REVISION = "revision", "Revision"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending review"
        CHANGES_REQUESTED = "changes_requested", "Changes requested"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    OPEN = (Status.PENDING, Status.CHANGES_REQUESTED)

    campaign = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name="reviews"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    # REVISION only: the proposed field values (JSON-safe), e.g.
    # {"max_rebate": "6.00", "product": ["<uuid>"]}.
    changes = models.JSONField(default=dict, blank=True)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    submitted_at = models.DateTimeField()
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    # Nibbl's comment to the brand (required for reject / request changes).
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [models.Index(fields=["status", "kind"])]

    def __str__(self):
        return f"{self.kind} review of {self.campaign_id} ({self.status})"


class RewardTier(BaseModel):
    """A cashback tier within a campaign. Ordered high→low for waterfall."""

    campaign = models.ForeignKey(
        Campaign, on_delete=models.CASCADE, related_name="tiers"
    )
    reward_amount = models.DecimalField(**MONEY_FIELD)
    allocation_percent = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        ordering = ["-reward_amount"]

    def __str__(self):
        return f"{self.reward_amount} @ {self.allocation_percent}%"


class Restriction(BaseModel):
    """Auto-generated purchase condition for a campaign (not brand-editable)."""

    class Type(models.TextChoices):
        NONE = "none", "No minimum"
        MIN_UNITS = "min_units", "Minimum units"
        BOGO = "bogo", "Buy one get one"

    campaign = models.OneToOneField(
        Campaign, on_delete=models.CASCADE, related_name="restriction"
    )
    restriction_type = models.CharField(max_length=20, choices=Type.choices)
    min_units = models.PositiveIntegerField(default=1)
    description = models.CharField(max_length=255)

    def __str__(self):
        return self.description


class FallbackOffer(BaseModel):
    """Optional lower offer shown when a user can't claim the premium one
    (e.g. during cooldown). Brand toggles visibility per campaign."""

    campaign = models.OneToOneField(
        Campaign, on_delete=models.CASCADE, related_name="fallback_offer"
    )
    reward_amount = models.DecimalField(**MONEY_FIELD)
    is_enabled = models.BooleanField(default=False)
    description = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"fallback {self.reward_amount} ({'on' if self.is_enabled else 'off'})"


class CampaignURL(BaseModel):
    """The single shareable URL for a campaign (spec 1.4)."""

    campaign = models.OneToOneField(
        Campaign, on_delete=models.CASCADE, related_name="campaign_url"
    )
    token = models.CharField(max_length=16, unique=True, editable=False)

    def __str__(self):
        return self.full_url

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = _unique_token(CampaignURL)
        super().save(*args, **kwargs)

    @property
    def full_url(self) -> str:
        base = settings.PUBLIC_BASE_URL.rstrip("/")
        return f"{base}/c/{self.token}"


class QRCode(BaseModel):
    """The single QR code for a campaign; encodes the campaign URL (spec 1.4).

    Image rendering (PNG/SVG) is deferred — ``data`` is the payload a QR
    generator would encode.
    """

    campaign = models.OneToOneField(
        Campaign, on_delete=models.CASCADE, related_name="qr_code"
    )
    token = models.CharField(max_length=16, unique=True, editable=False)
    image_url = models.URLField(blank=True)

    def __str__(self):
        return self.token

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = _unique_token(QRCode)
        super().save(*args, **kwargs)

    @property
    def data(self) -> str:
        url = getattr(self.campaign, "campaign_url", None)
        return url.full_url if url else ""


def _unique_token(model) -> str:
    for _ in range(10):
        token = random_code(10)
        if not model.objects.filter(token=token).exists():
            return token
    return random_code(14)
