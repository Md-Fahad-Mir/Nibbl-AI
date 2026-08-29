"""Receipts: upload → OCR → product/alias matching → fraud → review/approval.

A receipt is tied to a reservation (the open claim). After OCR + matching it is
either auto-VERIFIED, auto-REJECTED (duplicate), or routed to the brand's
manual review queue. Reward issuance happens in M9 once a receipt is VERIFIED.
"""

from django.conf import settings
from django.db import models

from Apps.common.models import BaseModel
from Apps.common.money import MONEY_FIELD


class Receipt(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="receipts"
    )
    reservation = models.ForeignKey(
        "reservations.Reservation", on_delete=models.PROTECT, related_name="receipts"
    )
    # Denormalized for tenant-scoped brand queries / isolation.
    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="receipts"
    )
    campaign = models.ForeignKey(
        "campaigns.Campaign", on_delete=models.PROTECT, related_name="receipts"
    )

    image = models.FileField(upload_to="receipts/", null=True, blank=True)
    merchant = models.CharField(max_length=255, blank=True)
    purchased_at = models.DateTimeField(null=True, blank=True)
    total = models.DecimalField(null=True, blank=True, **MONEY_FIELD)

    # The receipt's own identifier as printed on it (invoice/transaction no.).
    # One of the five fingerprint components; blank when OCR could not read it.
    receipt_number = models.CharField(max_length=100, blank=True)

    # SHA-256 of the five identifying components (product, shop, date, time,
    # receipt number). UNIQUE at the database level so two customers submitting
    # the same physical receipt concurrently cannot both be rewarded — the
    # loser hits an IntegrityError rather than a lost race.
    #
    # NULL when the fingerprint could not be built (e.g. no receipt number).
    # NULLs are exempt from UNIQUE in both SQLite and PostgreSQL, so those
    # receipts simply carry no duplicate protection and go to manual review.
    fingerprint = models.CharField(
        max_length=64, unique=True, null=True, blank=True
    )

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    matched = models.BooleanField(default=False)
    matched_units = models.PositiveIntegerField(default=0)
    decision_reason = models.CharField(max_length=255, blank=True)

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_receipts",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["brand", "status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"Receipt {self.id} ({self.status})"


class OCRResult(BaseModel):
    """Raw + parsed output of the OCR provider for a receipt."""

    receipt = models.OneToOneField(
        Receipt, on_delete=models.CASCADE, related_name="ocr_result"
    )
    provider = models.CharField(max_length=50, default="mock")
    raw = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"OCR({self.provider}) for {self.receipt_id}"


class ReceiptLineItem(BaseModel):
    """A single parsed line on a receipt, optionally matched to a product."""

    receipt = models.ForeignKey(
        Receipt, on_delete=models.CASCADE, related_name="line_items"
    )
    description = models.CharField(max_length=255)
    normalized = models.CharField(max_length=255, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(null=True, blank=True, **MONEY_FIELD)
    matched_product = models.ForeignKey(
        "products.Product",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="receipt_line_items",
    )

    def __str__(self):
        return self.description


class FraudFlag(BaseModel):
    """A fraud/abuse signal raised on a receipt and/or a user."""

    class Reason(models.TextChoices):
        DUPLICATE = "duplicate", "Duplicate receipt"
        NO_MATCH = "no_match", "Product not matched"
        VELOCITY = "velocity", "Too many active claims"
        MANUAL = "manual", "Manually flagged"

    receipt = models.ForeignKey(
        Receipt,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="fraud_flags",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="fraud_flags"
    )
    brand = models.ForeignKey(
        "brands.Brand",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="fraud_flags",
    )
    reason = models.CharField(max_length=20, choices=Reason.choices)
    detail = models.CharField(max_length=255, blank=True)
    resolved = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="raised_fraud_flags",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "resolved"]),
            models.Index(fields=["brand", "resolved"]),
        ]

    def __str__(self):
        return f"{self.reason} flag on user {self.user_id}"


class ManualReviewItem(BaseModel):
    """A receipt awaiting a brand reviewer's decision."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        RESOLVED = "resolved", "Resolved"

    receipt = models.OneToOneField(
        Receipt, on_delete=models.CASCADE, related_name="review_item"
    )
    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="review_queue"
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.OPEN
    )
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resolved_review_items",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["brand", "status"]),
        ]

    def __str__(self):
        return f"Review {self.receipt_id} ({self.status})"
