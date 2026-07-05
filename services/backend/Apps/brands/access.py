"""Reusable brand-tenancy access checks for brand-scoped API views.

Centralizes the "is this user allowed to act on this brand?" logic so every
brand-scoped app (products, campaigns, ...) enforces tenancy the same way.
"""

from rest_framework.exceptions import NotFound, PermissionDenied

from Apps.brands.models import Brand
from Apps.brands.selectors import get_active_membership


def get_brand_or_404(brand_id) -> Brand:
    brand = Brand.objects.filter(id=brand_id).first()
    if brand is None:
        raise NotFound("Brand not found.")
    return brand


def require_membership(user, brand, *, manager=False, active=False):
    """Enforce brand tenancy — platform admins bypass all checks."""
    # Platform admins have unrestricted access to every brand-scoped endpoint.
    if getattr(user, "is_platform_admin", False):
        # Return the real membership if one exists, otherwise None.
        return get_active_membership(user, brand)

    membership = get_active_membership(user, brand)
    if membership is None:
        raise PermissionDenied("You are not a member of this brand.")
    if manager and not membership.is_manager:
        raise PermissionDenied("Brand owner/admin role required.")
    if active and not brand.is_operational:
        raise PermissionDenied("This brand is suspended.")
    return membership
