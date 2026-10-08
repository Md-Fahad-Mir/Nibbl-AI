"""Reservations: the claim→reserve lifecycle shared by rebates and reviews.

A reservation is created when a user claims an offer. It:
  * reserves the reward as a wallet Hold (escrow on the brand wallet),
  * consumes the campaign's daily budget (computed by summing reservations,
    so EXPIRED ones still count — expiry never restores budget),
  * has a 7-day expiry and is unique per (user, campaign) while ACTIVE.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from Apps.common.models import BaseModel
from Apps.common.money import MONEY_FIELD


class Reservation(BaseModel):
    class Kind(models.TextChoices):
        REBATE = "rebate", "Rebate"
        REVIEW = "review", "Review"

    class OfferType(models.TextChoices):
        PREMIUM = "premium", "Premium"
        FALLBACK = "fallback", "Fallback"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        REDEEMED = "redeemed", "Redeemed"
        EXPIRED = "expired", "Expired"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    # Statuses that count against a campaign's daily budget. EXPIRED and REJECTED
    # are included on purpose: a consumed slot is never restored (spec 2.5), so
    # users can't game the budget by letting claims lapse or fail.
    BUDGET_CONSUMING = (
        Status.ACTIVE,
        Status.REDEEMED,
        Status.EXPIRED,
        Status.REJECTED,
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reservations"
    )
    campaign = models.ForeignKey(
        "campaigns.Campaign", on_delete=models.PROTECT, related_name="reservations"
    )
    tier = models.ForeignKey(
        "campaigns.RewardTier",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reservations",
    )
    hold = models.ForeignKey(
        "wallets.Hold",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reservation",
    )

    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.REBATE)
    offer_type = models.CharField(max_length=10, choices=OfferType.choices)
    reward_amount = models.DecimalField(**MONEY_FIELD)

    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE
    )
    expires_at = models.DateTimeField()
    # Marketing consents ticked on THIS claim (spec 1.9) — two separate boxes:
    # Nibbl email+SMS and the brand's email+SMS. Snapshot for the audit trail;
    # the shopper's current consent lives in accounts.MarketingConsent.
    consent_nibbl_marketing = models.BooleanField(default=False)
    consent_brand_marketing = models.BooleanField(default=False)
    redeemed_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "campaign"],
                condition=Q(status="active"),
                name="uniq_active_reservation_per_user_campaign",
            )
        ]
        indexes = [
            models.Index(fields=["campaign", "status"]),
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "expires_at"]),
        ]

    def __str__(self):
        return f"{self.kind} reservation {self.id} ({self.status})"
