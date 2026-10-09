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
    """Every user who engaged with this brand (claim, redemption, receipt or
    review)."""
    from Apps.rebates.models import Redemption
    from Apps.receipts.models import Receipt
    from Apps.reservations.models import Reservation
    from Apps.reviews.models import Review

    user_ids = set(
        Reservation.objects.filter(campaign__brand=brand).values_list("user_id", flat=True)
    )
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


INACTIVE_DAYS = 90
FILTERS = ("open_claim", "cooldown", "completed_rebate", "suspended", "inactive", "opted_in")


def _consent_status(consent) -> str:
    if consent is None:
        return "not_consented"
    return "opted_in" if consent.opted_in else "opted_out"


def brand_customers(brand, *, search: str = "", status_filter: str = "") -> dict:
    """The brand's customer directory (Master: Customer Directory).

    Each row carries the brand-scoped marketing consent (Opted In / Opted
    Out / not consented, with date and source), open claims, cooldown,
    completed rebates and last brand activity. Only brand activity is shown
    — never other brands, receipts or review content.
    """
    import datetime as dt

    from django.utils import timezone

    from Apps.accounts.models import MarketingConsent, User
    from Apps.brands.models import BrandCustomerSuspension
    from Apps.offers.models import CooldownRecord
    from Apps.rebates.models import Redemption
    from Apps.reservations.models import Reservation
    from Apps.reviews.models import Review

    full_access = _full_access(brand)
    now = timezone.now()
    users = {u.id: u for u in User.objects.filter(id__in=_engaged_user_ids(brand))}
    suspended = set(
        BrandCustomerSuspension.objects.filter(
            brand=brand, is_active=True
        ).values_list("user_id", flat=True)
    )
    consents = {c.user_id: c for c in MarketingConsent.objects.filter(brand=brand, user_id__in=users)}
    open_claims = set(
        Reservation.objects.filter(
            campaign__brand=brand, status=Reservation.Status.ACTIVE, user_id__in=users
        ).values_list("user_id", flat=True)
    )
    cooldowns = set(
        CooldownRecord.objects.filter(
            campaign__brand=brand, user_id__in=users, expires_at__gt=now
        ).values_list("user_id", flat=True)
    )

    rows = []
    for user_id, user in users.items():
        redemptions = Redemption.objects.filter(brand=brand, user=user)
        reviews = Review.objects.filter(brand=brand, user=user)
        earned = redemptions.aggregate(t=Sum("reward_amount"))["t"] or ZERO
        last = max(
            [d for d in (
                Reservation.objects.filter(campaign__brand=brand, user=user).order_by("-created_at")
                .values_list("created_at", flat=True).first(),
                redemptions.order_by("-created_at").values_list("created_at", flat=True).first(),
                reviews.order_by("-created_at").values_list("created_at", flat=True).first(),
            ) if d],
            default=None,
        )
        consent = consents.get(user_id)

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
            # Master: consent + brand activity (additive).
            "phone": user.phone if full_access else None,
            "consent_status": _consent_status(consent),
            "consent_date": consent.consented_at if consent else None,
            "consent_source": consent.source if consent else None,
            "consent_withdrawn_at": consent.revoked_at if consent else None,
            "open_claim": user_id in open_claims,
            "in_cooldown": user_id in cooldowns,
            "last_activity": last,
        }
        rows.append(row)

    total = len(rows)
    summary = {
        "opted_in_customers": sum(1 for r in rows if r["consent_status"] == "opted_in"),
        "open_claims": sum(1 for r in rows if r["open_claim"]),
        "active_cooldowns": sum(1 for r in rows if r["in_cooldown"]),
        # Share of the brand's customers with at least one completed rebate.
        "brand_conversion": round(sum(1 for r in rows if r["redemptions"]) * 100 / total, 1) if total else None,
    }

    if search and full_access:
        needle = search.strip().lower()
        rows = [
            r for r in rows
            if any(needle in str(r.get(k) or "").lower() for k in ("full_name", "email", "phone"))
        ]
    inactive_before = now - dt.timedelta(days=INACTIVE_DAYS)
    tests = {
        "open_claim": lambda r: r["open_claim"],
        "cooldown": lambda r: r["in_cooldown"],
        "completed_rebate": lambda r: r["redemptions"] > 0,
        "suspended": lambda r: r["is_suspended"],
        "inactive": lambda r: r["last_activity"] is None or r["last_activity"] < inactive_before,
        "opted_in": lambda r: r["consent_status"] == "opted_in",
    }
    if status_filter in tests:
        rows = [r for r in rows if tests[status_filter](r)]

    rows.sort(key=lambda r: r["redemptions"], reverse=True)
    return {
        "data_access_level": "full" if full_access else "anonymized",
        "count": len(rows),
        "customers": rows,
        "summary": summary,
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
