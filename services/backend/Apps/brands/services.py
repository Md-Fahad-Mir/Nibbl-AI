"""Business logic for brand onboarding, membership, and lifecycle."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandApplication, BrandMembership
from Apps.common.models import AuditLog


class BrandError(Exception):
    """Expected, user-facing brand errors (mapped to HTTP 400)."""


def _unique_slug(name: str) -> str:
    base = slugify(name) or "brand"
    slug = base
    i = 2
    while Brand.objects.filter(slug=slug).exists():
        slug = f"{base}-{i}"
        i += 1
    return slug


def _default_plan() -> Plan | None:
    return Plan.objects.filter(slug=Plan.Slug.STARTER, is_active=True).first()


# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
def submit_application(
    *,
    applicant: User,
    brand_name: str,
    contact_email: str,
    website: str = "",
    message: str = "",
    requested_plan: Plan | None = None,
) -> BrandApplication:
    if BrandApplication.objects.filter(
        applicant=applicant, status=BrandApplication.Status.PENDING
    ).exists():
        raise BrandError("You already have a pending brand application.")

    application = BrandApplication.objects.create(
        applicant=applicant,
        brand_name=brand_name,
        contact_email=contact_email,
        website=website,
        message=message,
        requested_plan=requested_plan,
    )
    AuditLog.objects.create(
        action=AuditLog.Action.CREATE,
        actor_type="user",
        actor_id=str(applicant.id),
        target_type="brand_application",
        target_id=str(application.id),
        metadata={"event": "brand_application_submitted"},
    )
    return application


@transaction.atomic
def approve_application(*, application: BrandApplication, reviewer: User) -> Brand:
    if application.status != BrandApplication.Status.PENDING:
        raise BrandError("This application has already been reviewed.")

    plan = application.requested_plan or _default_plan()
    brand = Brand.objects.create(
        name=application.brand_name,
        slug=_unique_slug(application.brand_name),
        contact_email=application.contact_email,
        website=application.website,
        plan=plan,
    )
    BrandMembership.objects.create(
        brand=brand,
        user=application.applicant,
        role=BrandMembership.Role.OWNER,
    )

    # Promote the applicant into the brand role (unless they're an admin).
    applicant = application.applicant
    if applicant.role == User.Role.CONSUMER:
        applicant.role = User.Role.BRAND
        applicant.save(update_fields=["role", "updated_at"])

    application.status = BrandApplication.Status.APPROVED
    application.reviewed_by = reviewer
    application.reviewed_at = timezone.now()
    application.brand = brand
    application.save(
        update_fields=["status", "reviewed_by", "reviewed_at", "brand", "updated_at"]
    )

    AuditLog.objects.create(
        action=AuditLog.Action.APPROVE,
        actor_type="user",
        actor_id=str(reviewer.id),
        target_type="brand_application",
        target_id=str(application.id),
        metadata={"event": "brand_application_approved", "brand_id": str(brand.id)},
    )
    return brand


def reject_application(
    *, application: BrandApplication, reviewer: User, reason: str = ""
) -> BrandApplication:
    if application.status != BrandApplication.Status.PENDING:
        raise BrandError("This application has already been reviewed.")

    application.status = BrandApplication.Status.REJECTED
    application.reviewed_by = reviewer
    application.reviewed_at = timezone.now()
    application.decision_reason = reason
    application.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "decision_reason",
            "updated_at",
        ]
    )
    AuditLog.objects.create(
        action=AuditLog.Action.REJECT,
        actor_type="user",
        actor_id=str(reviewer.id),
        target_type="brand_application",
        target_id=str(application.id),
        metadata={"event": "brand_application_rejected", "reason": reason},
    )
    return application


# ---------------------------------------------------------------------------
# Brand lifecycle
# ---------------------------------------------------------------------------
def suspend_brand(*, brand: Brand, admin: User) -> Brand:
    if brand.status == Brand.Status.SUSPENDED:
        raise BrandError("Brand is already suspended.")
    brand.status = Brand.Status.SUSPENDED
    brand.suspended_at = timezone.now()
    brand.save(update_fields=["status", "suspended_at", "updated_at"])
    AuditLog.objects.create(
        action=AuditLog.Action.UPDATE,
        actor_type="user",
        actor_id=str(admin.id),
        target_type="brand",
        target_id=str(brand.id),
        metadata={"event": "brand_suspended"},
    )
    return brand


def reactivate_brand(*, brand: Brand, admin: User) -> Brand:
    if brand.status == Brand.Status.ACTIVE:
        raise BrandError("Brand is already active.")
    brand.status = Brand.Status.ACTIVE
    brand.suspended_at = None
    brand.save(update_fields=["status", "suspended_at", "updated_at"])
    AuditLog.objects.create(
        action=AuditLog.Action.UPDATE,
        actor_type="user",
        actor_id=str(admin.id),
        target_type="brand",
        target_id=str(brand.id),
        metadata={"event": "brand_reactivated"},
    )
    return brand


# ---------------------------------------------------------------------------
# Membership
# ---------------------------------------------------------------------------
def add_member(*, brand: Brand, email: str, role: str) -> BrandMembership:
    if role == BrandMembership.Role.OWNER:
        raise BrandError("A brand can only have its original owner.")

    user = User.objects.filter(email__iexact=email, is_deleted=False).first()
    if user is None:
        raise BrandError("No user with that email exists.")
    if BrandMembership.objects.filter(brand=brand, user=user).exists():
        raise BrandError("That user is already a member of this brand.")

    membership = BrandMembership.objects.create(brand=brand, user=user, role=role)
    if user.role == User.Role.CONSUMER:
        user.role = User.Role.BRAND
        user.save(update_fields=["role", "updated_at"])
    return membership


def remove_member(*, membership: BrandMembership) -> None:
    if membership.role == BrandMembership.Role.OWNER:
        raise BrandError("The brand owner cannot be removed.")
    membership.delete()


# ---------------------------------------------------------------------------
# Auto-provisioning
# ---------------------------------------------------------------------------
@transaction.atomic
def ensure_brand_for_user(user: User) -> Brand | None:
    """Create a Brand + owner membership for a brand-role user if none exists.

    Called automatically when an admin approves a brand account so that the
    user has a valid ``brand_id`` on first login.  Safe to call multiple times
    (idempotent — skips if a membership already exists).

    Returns the Brand, or ``None`` if the user already has one.
    """
    if BrandMembership.objects.filter(user=user, is_active=True).exists():
        return None

    plan = _default_plan()
    brand = Brand.objects.create(
        name=user.full_name,
        slug=_unique_slug(user.full_name),
        contact_email=user.email,
        plan=plan,
    )
    BrandMembership.objects.create(
        brand=brand,
        user=user,
        role=BrandMembership.Role.OWNER,
    )
    AuditLog.objects.create(
        action=AuditLog.Action.CREATE,
        actor_type="system",
        actor_id="auto_provision",
        target_type="brand",
        target_id=str(brand.id),
        metadata={
            "event": "brand_auto_created",
            "user_id": str(user.id),
        },
    )
    return brand

