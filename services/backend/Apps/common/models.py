"""
Shared, reusable model building blocks for every NibblAI app.

These abstractions intentionally live in `common` so that domain apps
(accounts, brands, wallets, ...) stay consistent: UUID primary keys,
audit timestamps, and soft-delete semantics out of the box.
"""

import uuid
from decimal import Decimal

from django.db import models
from django.utils import timezone


class UUIDModel(models.Model):
    """Use a non-guessable UUID primary key instead of a sequential int.

    UUIDs avoid leaking row counts / enabling enumeration across our public,
    multi-tenant API surface.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """Track creation and last-modification times on every row."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteQuerySet(models.QuerySet):
    """QuerySet whose ``delete()`` flags rows instead of removing them."""

    def delete(self):
        return self.update(is_deleted=True, deleted_at=timezone.now())

    def hard_delete(self):
        return super().delete()

    def alive(self):
        return self.filter(is_deleted=False)

    def dead(self):
        return self.filter(is_deleted=True)


class SoftDeleteManager(models.Manager):
    """Manager that hides soft-deleted rows by default.

    ``objects`` returns only live rows; ``all_objects`` returns everything.
    """

    def __init__(self, *args, alive_only=True, **kwargs):
        self.alive_only = alive_only
        super().__init__(*args, **kwargs)

    def get_queryset(self):
        qs = SoftDeleteQuerySet(self.model, using=self._db)
        if self.alive_only:
            return qs.filter(is_deleted=False)
        return qs


class SoftDeleteModel(models.Model):
    """Mixin giving a model reversible (soft) deletion.

    Financial / audit-sensitive records should never be physically removed;
    we flag them instead so history stays intact.
    """

    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = SoftDeleteManager(alive_only=False)

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at"])

    def hard_delete(self, using=None, keep_parents=False):
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=["is_deleted", "deleted_at"])


class BaseModel(UUIDModel, TimeStampedModel):
    """Convenience base: UUID PK + timestamps. Most domain models extend this."""

    class Meta:
        abstract = True


class AuditLog(UUIDModel, TimeStampedModel):
    """Append-only record of sensitive actions across the platform.

    Deliberately FK-free for now: the ``accounts`` app (and its User model)
    lands in M1, and brand/target references arrive with later milestones.
    Actors and targets are stored as type + opaque id so this model never
    needs to change as new domains are added.
    """

    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        LOGIN = "login", "Login"
        APPROVE = "approve", "Approve"
        REJECT = "reject", "Reject"
        OTHER = "other", "Other"

    actor_type = models.CharField(max_length=50, blank=True)
    actor_id = models.CharField(max_length=64, blank=True)

    action = models.CharField(max_length=20, choices=Action.choices)

    target_type = models.CharField(max_length=50, blank=True)
    target_id = models.CharField(max_length=64, blank=True)

    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_type", "target_id"]),
            models.Index(fields=["actor_type", "actor_id"]),
        ]

    def __str__(self):
        return f"{self.action} {self.target_type}:{self.target_id} @ {self.created_at:%Y-%m-%d %H:%M}"


class PlatformSettings(models.Model):
    """Platform-wide, admin-configurable settings (a single row).

    Holds runtime knobs the client wants admins to control: withdrawal-review
    thresholds and the referral toggle. (Discovery-ranking config lands with
    the ranking engine.)
    """

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    # A withdrawal over this single amount is flagged for manual review.
    withdrawal_review_single = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("25.00")
    )
    # A withdrawal is flagged if the user's rolling-window total exceeds this.
    withdrawal_review_rolling = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("100.00")
    )
    withdrawal_rolling_days = models.PositiveIntegerField(default=30)
    referrals_enabled = models.BooleanField(default=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Platform settings"
        verbose_name_plural = "Platform settings"

    def __str__(self):
        return "Platform settings"

    def save(self, *args, **kwargs):
        self.id = 1  # enforce singleton
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


def get_platform_settings() -> "PlatformSettings":
    return PlatformSettings.load()
