"""Brand tenancy: the Brand org, its members, and the onboarding application.

The Brand is the multi-tenant boundary for the whole platform. Every
brand-scoped resource in later milestones (campaigns, receipts, wallets, ...)
hangs off a Brand and is access-controlled via BrandMembership.
"""

from django.conf import settings
from django.db import models

from Apps.common.models import BaseModel


class Brand(BaseModel):
    """A brand running rebate / review campaigns on the platform."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=140, unique=True)
    legal_name = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    website = models.URLField(blank=True)
    logo = models.ImageField(upload_to="brand_logos/", null=True, blank=True)
    logo_url = models.URLField(blank=True)
    contact_email = models.EmailField(blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    suspended_at = models.DateTimeField(null=True, blank=True)

    plan = models.ForeignKey(
        "billing.Plan",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="brands",
    )

    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through="brands.BrandMembership",
        related_name="brands",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def is_operational(self) -> bool:
        return self.status == self.Status.ACTIVE


class BrandMembership(BaseModel):
    """Links a user to a brand with a brand-level role (the tenancy edge)."""

    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    brand = models.ForeignKey(
        Brand, on_delete=models.CASCADE, related_name="memberships"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="brand_memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.MEMBER)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["brand", "user"], name="uniq_brand_user_membership"
            )
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.brand_id} ({self.role})"

    @property
    def is_manager(self) -> bool:
        return self.role in (self.Role.OWNER, self.Role.ADMIN)


class BrandApplication(BaseModel):
    """A request from a user to onboard a brand; approved by a platform admin."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="brand_applications",
    )
    brand_name = models.CharField(max_length=255)
    contact_email = models.EmailField()
    website = models.URLField(blank=True)
    message = models.TextField(blank=True)
    requested_plan = models.ForeignKey(
        "billing.Plan",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="applications",
    )

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_brand_applications",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    decision_reason = models.TextField(blank=True)

    # Set when an application is approved and a Brand is created from it.
    brand = models.ForeignKey(
        Brand,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="source_application",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.brand_name} ({self.status})"
