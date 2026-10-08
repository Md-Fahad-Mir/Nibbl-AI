"""Customer payouts: linked payout methods, withdrawal requests, and batches.

Money model: a withdrawal places a Hold on the customer wallet at request time
(escrow). Marking it Paid captures the hold (debit); Rejected releases it;
Flagged keeps it held pending admin review.
"""

from django.conf import settings
from django.db import models

from Apps.common.models import BaseModel
from Apps.common.money import MONEY_FIELD, ZERO


class PayoutMethod(BaseModel):
    """A customer's linked PayPal/Venmo account.

    A given external account (provider + handle) may be linked to only one user
    account — a fraud control from spec 2.7.
    """

    class Provider(models.TextChoices):
        PAYPAL = "paypal", "PayPal"
        VENMO = "venmo", "Venmo"

    class ReviewStatus(models.TextChoices):
        PENDING = "pending", "Pending review"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payout_methods"
    )
    provider = models.CharField(max_length=10, choices=Provider.choices)
    handle = models.CharField(max_length=255)  # email / username / phone
    is_default = models.BooleanField(default=False)
    # A new payout method beyond a user's first goes to a review hold (spec 2.7):
    # it can't be used for a withdrawal until an admin approves it.
    review_status = models.CharField(
        max_length=10, choices=ReviewStatus.choices, default=ReviewStatus.PENDING
    )
    review_note = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-is_default", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "handle"], name="uniq_provider_handle_global"
            ),
        ]

    def __str__(self):
        return f"{self.provider}:{self.handle}"


class PayoutBatch(BaseModel):
    """A group of approved withdrawals exported for manual processing."""

    class Status(models.TextChoices):
        CREATED = "created", "Created"
        EXPORTED = "exported", "Exported"
        COMPLETED = "completed", "Completed"

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="payout_batches",
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.CREATED
    )
    total_amount = models.DecimalField(default=ZERO, **MONEY_FIELD)
    exported_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Batch {self.id} ({self.status})"


class WithdrawalRequest(BaseModel):
    """A customer cash-out request and its status-machine record."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        PROCESSING = "processing", "Processing"
        PAID = "paid", "Paid"
        REJECTED = "rejected", "Rejected"
        FLAGGED = "flagged", "Flagged"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="withdrawals"
    )
    payout_method = models.ForeignKey(
        PayoutMethod, on_delete=models.PROTECT, related_name="withdrawals"
    )
    # Snapshot of the destination so batch exports stay stable if the method
    # is later edited/removed.
    provider = models.CharField(max_length=10)
    handle = models.CharField(max_length=255)

    amount = models.DecimalField(**MONEY_FIELD)
    hold = models.ForeignKey(
        "wallets.Hold", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="withdrawal",
    )
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    # Over the admin-configured withdrawal-review threshold → needs closer review.
    needs_review = models.BooleanField(default=False)
    admin_note = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="reviewed_withdrawals",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    batch = models.ForeignKey(
        PayoutBatch, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="withdrawals",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return f"Withdrawal {self.amount} ({self.status})"
