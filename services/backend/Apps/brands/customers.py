"""Brand Customers module with plan-based data access (spec 1.8 / 2.12).

A brand sees only the customers who engaged with *its* campaigns. PII is masked
for Starter (anonymized) plans and shown in full for Pro/Scale.
"""

from __future__ import annotations

import hashlib

from django.db.models import Sum

from Apps.common.money import ZERO


def _anon_ref(brand_id, user_id) -> str:
    # Stable, opaque per-brand reference — not reversible to the user id.
    digest = hashlib.sha256(f"{brand_id}:{user_id}".encode()).hexdigest()
    return f"cust_{digest[:12]}"


def _full_access(brand) -> bool:
    return bool(brand.plan and brand.plan.data_access_level == "full")


def _engaged_user_ids(brand) -> set:
    """Every user who engaged with this brand (redemption, receipt or review)."""
    from Apps.rebates.models import Redemption
    from Apps.receipts.models import Receipt
    from Apps.reviews.models import Review

    user_ids = set()
    user_ids.update(
        Redemption.objects.filter(brand=brand).values_list("user_id", flat=True)
    )
    user_ids.update(
        Receipt.objects.filter(brand=brand).values_list("user_id", flat=True)
    )
    user_ids.update(
        Review.objects.filter(brand=brand).values_list("user_id", flat=True)
    )
    return user_ids


def brand_customers(brand) -> dict:
    from Apps.accounts.models import User
    from Apps.brands.models import BrandCustomerSuspension
    from Apps.rebates.models import Redemption
    from Apps.reviews.models import Review

    full_access = _full_access(brand)
    users = {u.id: u for u in User.objects.filter(id__in=_engaged_user_ids(brand))}
    suspended = set(
        BrandCustomerSuspension.objects.filter(
            brand=brand, is_active=True
        ).values_list("user_id", flat=True)
    )

    rows = []
    for user_id, user in users.items():
        redemptions = Redemption.objects.filter(brand=brand, user=user)
        reviews = Review.objects.filter(brand=brand, user=user)
        earned = redemptions.aggregate(t=Sum("reward_amount"))["t"] or ZERO

        ref = _anon_ref(brand.id, user_id)
        row = {
            "customer_ref": ref,
            # Identifier for account actions (suspend/reactivate). Anonymized
            # plans get the opaque ref so the real user id is never exposed.
            "user_id": str(user_id) if full_access else ref,
            "is_suspended": user_id in suspended,
            "redemptions": redemptions.count(),
            "reviews": reviews.count(),
            "total_earned": str(earned),
            "email": user.email if full_access else None,
            "full_name": user.full_name if full_access else None,
        }
        rows.append(row)

    rows.sort(key=lambda r: r["redemptions"], reverse=True)
    return {
        "data_access_level": "full" if full_access else "anonymized",
        "count": len(rows),
        "customers": rows,
    }


# ---------------------------------------------------------------------------
# Per-brand suspensions (spec 5.7)
# ---------------------------------------------------------------------------
class CustomerError(Exception):
    """Expected, user-facing customer-management errors (mapped to HTTP 400)."""


def resolve_customer(brand, customer_id: str):
    """Find one of this brand's engaged customers by real user id (full-access
    plans) or by opaque ``cust_`` ref (anonymized plans). Returns None if the
    id isn't one of the brand's customers — no cross-brand visibility."""
    from Apps.accounts.models import User

    user_ids = _engaged_user_ids(brand)
    customer_id = str(customer_id)
    if customer_id.startswith("cust_"):
        for user_id in user_ids:
            if _anon_ref(brand.id, user_id) == customer_id:
                return User.objects.filter(id=user_id).first()
        return None
    match = next((u for u in user_ids if str(u) == customer_id), None)
    return User.objects.filter(id=match).first() if match else None


def is_suspended_from_brand(user, brand) -> bool:
    from Apps.brands.models import BrandCustomerSuspension

    return BrandCustomerSuspension.objects.filter(
        brand=brand, user=user, is_active=True
    ).exists()


def _maybe_alert_repeated_suspensions(user) -> None:
    """Raise one open fraud flag once a shopper's suspensions across brands
    reach the configured threshold."""
    from django.conf import settings
    from django.db.models import Sum

    from Apps.brands.models import BrandCustomerSuspension
    from Apps.receipts.models import FraudFlag

    total = (
        BrandCustomerSuspension.objects.filter(user=user).aggregate(
            total=Sum("times_suspended")
        )["total"]
        or 0
    )
    if total < settings.REPEATED_SUSPENSION_ALERT:
        return
    prefix = "Repeated suspensions"
    if FraudFlag.objects.filter(
        user=user, resolved=False, detail__startswith=prefix
    ).exists():
        return
    FraudFlag.objects.create(
        user=user,
        reason=FraudFlag.Reason.MANUAL,
        detail=f"{prefix}: suspended {total} times across brands",
    )


def suspend_customer(*, brand, user, reason="", actor=None):
    from Apps.brands.models import BrandCustomerSuspension

    suspension, created = BrandCustomerSuspension.objects.get_or_create(
        brand=brand,
        user=user,
        defaults={"reason": reason, "suspended_by": actor},
    )
    if not created:
        if suspension.is_active:
            raise CustomerError("This customer is already suspended.")
        suspension.is_active = True
        suspension.reason = reason
        suspension.suspended_by = actor
        suspension.times_suspended += 1
        suspension.save(
            update_fields=[
                "is_active", "reason", "suspended_by", "times_suspended", "updated_at",
            ]
        )
    _maybe_alert_repeated_suspensions(user)
    return suspension


def reactivate_customer(*, brand, user):
    from Apps.brands.models import BrandCustomerSuspension

    suspension = BrandCustomerSuspension.objects.filter(
        brand=brand, user=user, is_active=True
    ).first()
    if suspension is None:
        raise CustomerError("This customer is not suspended.")
    suspension.is_active = False
    suspension.save(update_fields=["is_active", "updated_at"])
    return suspension
