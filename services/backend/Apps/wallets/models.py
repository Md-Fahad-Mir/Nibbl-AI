"""The financial core: wallets, an append-only ledger, and escrow holds.

Accounting model
----------------
* ``Wallet.balance`` is the settled balance == sum of all LedgerEntry signed
  amounts. It is maintained transactionally and is always reconstructable.
* A ``Hold`` reserves part of the *available* balance without moving money.
  ``available = balance - sum(active holds)``.
* Capturing a hold converts it into a real DEBIT ledger entry; releasing it
  simply frees the reservation. Money only ever moves via LedgerEntry rows.
"""

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q, Sum

from Apps.common.money import MONEY_FIELD, ZERO


class Wallet(models.Model):
    """A balance owned by exactly one party — a brand (escrow) or a customer."""

    class Kind(models.TextChoices):
        BRAND = "brand", "Brand"
        CUSTOMER = "customer", "Customer"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    kind = models.CharField(max_length=20, choices=Kind.choices)

    brand = models.OneToOneField(
        "brands.Brand",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="wallet",
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="wallet",
    )

    currency = models.CharField(max_length=3, default="USD")
    balance = models.DecimalField(default=ZERO, **MONEY_FIELD)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(brand__isnull=False, user__isnull=True)
                    | Q(brand__isnull=True, user__isnull=False)
                ),
                name="wallet_exactly_one_owner",
            ),
        ]

    def __str__(self):
        owner = self.brand_id or self.user_id
        return f"{self.kind} wallet ({owner})"

    def held_amount(self):
        agg = self.holds.filter(status=Hold.Status.ACTIVE).aggregate(s=Sum("amount"))
        return agg["s"] or ZERO

    def available(self):
        return self.balance - self.held_amount()

    def promo_balance(self):
        """Promotional money still on the wallet (promo credited − promo spent)."""
        agg = self.ledger_entries.filter(is_promotional=True).aggregate(
            credited=Sum("amount", filter=Q(entry_type=LedgerEntry.EntryType.CREDIT)),
            spent=Sum("amount", filter=Q(entry_type=LedgerEntry.EntryType.DEBIT)),
        )
        return (agg["credited"] or ZERO) - (agg["spent"] or ZERO)

    def reward_available(self):
        """Real (non-promotional) money free to fund shopper rewards: the
        settled balance minus promotional credit and active holds. Promo credit
        can never back a reward."""
        return self.balance - self.promo_balance() - self.held_amount()


class LedgerEntry(models.Model):
    """An immutable, append-only money movement on a wallet."""

    class EntryType(models.TextChoices):
        CREDIT = "credit", "Credit"
        DEBIT = "debit", "Debit"

    class Category(models.TextChoices):
        FUNDING = "funding", "Wallet funding"
        REBATE_REWARD = "rebate_reward", "Rebate reward"
        REBATE_FEE = "rebate_fee", "Rebate processing fee"
        REVIEW_REWARD = "review_reward", "Review reward"
        REVIEW_FEE = "review_fee", "Review fee"
        SUBSCRIPTION = "subscription", "Subscription charge"
        PAYOUT = "payout", "Payout"
        REFERRAL_BONUS = "referral_bonus", "Referral bonus"
        ADJUSTMENT = "adjustment", "Manual adjustment"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(
        Wallet, on_delete=models.PROTECT, related_name="ledger_entries"
    )
    entry_type = models.CharField(max_length=10, choices=EntryType.choices)
    amount = models.DecimalField(**MONEY_FIELD)  # always positive
    category = models.CharField(max_length=30, choices=Category.choices)

    # Snapshot of the wallet balance immediately after this entry.
    balance_after = models.DecimalField(**MONEY_FIELD)

    # FK-free reference to the originating object (campaign, redemption, ...).
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.CharField(max_length=64, blank=True)

    description = models.CharField(max_length=255, blank=True)
    # Promotional money (admin promo credit / redeemed promo codes). Flagged so
    # it can be spent on eligible platform charges (fees/subscription) but never
    # reserved or paid out as a shopper reward. See Wallet.reward_available().
    is_promotional = models.BooleanField(default=False)
    # Guards against double-posting the same logical event.
    idempotency_key = models.CharField(
        max_length=128, unique=True, null=True, blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["wallet", "-created_at"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self):
        return f"{self.entry_type} {self.amount} ({self.category})"

    @property
    def signed_amount(self):
        return self.amount if self.entry_type == self.EntryType.CREDIT else -self.amount

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError("Ledger entries are immutable and cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Ledger entries are append-only and cannot be deleted.")


class Hold(models.Model):
    """A reservation against a wallet's available balance (escrow)."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CAPTURED = "captured", "Captured"
        RELEASED = "released", "Released"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="holds")
    amount = models.DecimalField(**MONEY_FIELD)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.ACTIVE
    )

    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.CharField(max_length=64, blank=True)
    idempotency_key = models.CharField(
        max_length=128, unique=True, null=True, blank=True
    )

    expires_at = models.DateTimeField(null=True, blank=True)
    captured_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["wallet", "status"]),
            models.Index(fields=["reference_type", "reference_id"]),
        ]

    def __str__(self):
        return f"hold {self.amount} ({self.status})"
