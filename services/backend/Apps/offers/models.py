"""Consumer-facing offer layer: bookmarks, view tracking, and cooldowns.

Offers themselves are *dynamic* (computed from active campaigns) and therefore
cannot be saved. Instead users bookmark products or brands. Cooldowns record
that a user claimed a campaign's premium reward, gating them for a window.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from Apps.common.models import BaseModel


class Bookmark(BaseModel):
    """A user's saved product or brand (offers can't be saved — they're dynamic)."""

    class Kind(models.TextChoices):
        PRODUCT = "product", "Product"
        BRAND = "brand", "Brand"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookmarks"
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    product = models.ForeignKey(
        "products.Product",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="+",
    )
    brand = models.ForeignKey(
        "brands.Brand",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="+",
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(product__isnull=False, brand__isnull=True)
                    | Q(product__isnull=True, brand__isnull=False)
                ),
                name="bookmark_exactly_one_target",
            ),
            models.UniqueConstraint(
                fields=["user", "product"],
                condition=Q(product__isnull=False),
                name="uniq_user_product_bookmark",
            ),
            models.UniqueConstraint(
                fields=["user", "brand"],
                condition=Q(brand__isnull=False),
                name="uniq_user_brand_bookmark",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} bookmarked {self.kind}"


class OfferView(BaseModel):
    """Records a view/scan of an offer. user is null for anonymous (no-account) views."""

    class Source(models.TextChoices):
        FEED = "feed", "Feed"
        DETAIL = "detail", "Detail"
        QR = "qr", "QR code"
        URL = "url", "Direct URL"
        PREVIEW = "preview", "Brand preview"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="offer_views",
    )
    campaign = models.ForeignKey(
        "campaigns.Campaign", on_delete=models.CASCADE, related_name="views"
    )
    source = models.CharField(max_length=10, choices=Source.choices)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["campaign", "-created_at"]),
        ]

    def __str__(self):
        return f"{self.source} view of {self.campaign_id}"


class CooldownRecord(BaseModel):
    """A per-(user, campaign) premium-reward cooldown window.

    Created when a user claims a campaign's premium reward; while active the
    premium offer is hidden (fallback may still show if the brand enabled it).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="cooldowns"
    )
    campaign = models.ForeignKey(
        "campaigns.Campaign", on_delete=models.CASCADE, related_name="cooldowns"
    )
    started_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "campaign", "expires_at"]),
        ]

    def __str__(self):
        return f"cooldown {self.user_id}/{self.campaign_id} → {self.expires_at:%Y-%m-%d}"

    @property
    def is_active(self) -> bool:
        return timezone.now() < self.expires_at


class ZipCode(models.Model):
    """US ZIP → state + centroid (GeoNames, CC BY 4.0; see offers/data)."""

    zip = models.CharField(max_length=5, primary_key=True)
    state = models.CharField(max_length=2, db_index=True)
    lat = models.FloatField()
    lng = models.FloatField()

    class Meta:
        indexes = [models.Index(fields=["lat", "lng"])]

    def __str__(self):
        return self.zip


class ShopperLocation(BaseModel):
    """A shopper's saved discovery location (ZIP or device position resolved
    to its nearest ZIP), so they aren't asked again (Master)."""

    class Source(models.TextChoices):
        ZIP = "zip", "Entered ZIP"
        DEVICE = "device", "Device location"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="discovery_location"
    )
    zip = models.CharField(max_length=5)
    state = models.CharField(max_length=2)
    lat = models.FloatField()
    lng = models.FloatField()
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.ZIP)

    def __str__(self):
        return f"{self.user_id} @ {self.zip}"
