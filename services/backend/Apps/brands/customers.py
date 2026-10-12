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
        brand_claims = Reservation.objects.filter(campaign__brand=brand, user=user, kind=Reservation.Kind.REBATE)
        all_claims = Reservation.objects.filter(user=user, kind=Reservation.Kind.REBATE).count()
        all_redeemed = Redemption.objects.filter(user=user).count()
        next_cooldown = (
            CooldownRecord.objects.filter(campaign__brand=brand, user=user, expires_at__gt=now)
            .order_by("expires_at").values_list("expires_at", flat=True).first()
        )
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
            # Master directory columns (additive): brand activity, site
            # activity (totals only), open claims, cooldown days left.
            "brand_claims": brand_claims.count(),
            "open_claims": brand_claims.filter(status=Reservation.Status.ACTIVE).count(),
            "cooldown_days_left": max((next_cooldown - now).days, 0) if next_cooldown else None,
            "site_activity": {
                "claims": all_claims,
                "completion_rate": round(all_redeemed * 100 / all_claims) if all_claims else None,
                "reviews": Review.objects.filter(user=user).count(),
            },
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


# ---------------------------------------------------------------------------
# Customer Profile (Master: Customers → Customer Profile)
# ---------------------------------------------------------------------------
def _display_name(user, full_access: bool) -> str:
    parts = (user.full_name or "").split()
    if full_access or not parts:
        return user.full_name or "Customer"
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else parts[0]


def _image(request, field):
    if not field:
        return None
    return request.build_absolute_uri(field.url) if request else field.url


def customer_profile(brand, user, request=None) -> dict:
    """Relationship with this brand, Nibbl totals only, open claims,
    cooldowns, redemption history (full receipt 30 days, then the matching
    line) and recent activity. Never shows other brands, products, receipts
    or review content."""
    from django.db.models import Min
    from django.utils import timezone

    from Apps.accounts.models import MarketingConsent
    from Apps.brands.models import BrandCustomerSuspension
    from Apps.offers.models import CooldownRecord, OfferView
    from Apps.rebates.models import Redemption
    from Apps.receipts.models import Receipt
    from Apps.receipts.retention import full_receipt_available, full_receipt_until
    from Apps.reservations.models import Reservation
    from Apps.reviews.models import Review, ReviewCampaign, ReviewCooldownWaiver, ReviewSession

    now = timezone.now()
    full = _full_access(brand)
    claims = Reservation.objects.filter(campaign__brand=brand, user=user, kind=Reservation.Kind.REBATE)
    redemptions = Redemption.objects.filter(brand=brand, user=user)
    reviews = Review.objects.filter(brand=brand, user=user)
    review_rewards = ReviewSession.objects.filter(
        review_campaign__brand=brand, user=user, status=ReviewSession.Status.COMPLETED
    ).aggregate(t=Sum("reward_amount"))["t"] or ZERO
    rebate_rewards = redemptions.aggregate(t=Sum("reward_amount"))["t"] or ZERO
    n_claims, n_redeemed = claims.count(), redemptions.count()

    all_claims = Reservation.objects.filter(user=user, kind=Reservation.Kind.REBATE).count()
    all_redeemed = Redemption.objects.filter(user=user).count()
    all_rewards = (Redemption.objects.filter(user=user).aggregate(t=Sum("reward_amount"))["t"] or ZERO) + (
        ReviewSession.objects.filter(user=user, status=ReviewSession.Status.COMPLETED)
        .aggregate(t=Sum("reward_amount"))["t"] or ZERO
    )

    from django.db.models import Q

    consents = {c.brand_id: c for c in MarketingConsent.objects.filter(Q(brand=brand) | Q(brand__isnull=True), user=user)}
    nibbl, brand_consent = consents.get(None), consents.get(brand.id)
    ban = BrandCustomerSuspension.objects.filter(brand=brand, user=user, is_active=True).first()
    first_seen = min(filter(None, [
        claims.aggregate(m=Min("created_at"))["m"], reviews.aggregate(m=Min("created_at"))["m"],
    ]), default=None)
    last_seen = max(filter(None, [
        claims.order_by("-created_at").values_list("created_at", flat=True).first(),
        redemptions.order_by("-created_at").values_list("created_at", flat=True).first(),
        reviews.order_by("-created_at").values_list("created_at", flat=True).first(),
    ]), default=None)

    def campaign_image(campaign):
        if campaign.image:
            return _image(request, campaign.image)
        product = campaign.products.first()
        return _image(request, product.image_url) if product and product.image_url else None

    open_claims = [{
        "id": str(r.id), "offer": r.campaign.offer_headline or r.campaign.name, "image": campaign_image(r.campaign),
        "claimed_at": r.created_at, "expires_at": r.expires_at,
        "days_left": max((r.expires_at - now).days, 0),
    } for r in claims.filter(status=Reservation.Status.ACTIVE).select_related("campaign")]

    cooldowns = [{
        "kind": "rebate", "id": str(c.id), "name": c.campaign.offer_headline or c.campaign.name,
        "image": campaign_image(c.campaign), "expires_at": c.expires_at,
        "days_left": max((c.expires_at - now).days, 0), "one_time": c.campaign.one_time_only,
    } for c in CooldownRecord.objects.filter(campaign__brand=brand, user=user, expires_at__gt=now).select_related("campaign")]
    import datetime as dt

    for campaign in ReviewCampaign.objects.filter(brand=brand).exclude(status=ReviewCampaign.Status.ARCHIVED):
        for product in campaign.products.all():
            done = Review.objects.filter(user=user, product=product).exclude(status=Review.Status.REMOVED)
            waiver = ReviewCooldownWaiver.objects.filter(user=user, product=product).first()
            if waiver:
                done = done.filter(created_at__gt=waiver.waived_at)
            last = done.order_by("-created_at").values_list("created_at", flat=True).first()
            if last is None:
                continue
            if campaign.one_time_only:
                ends = None
            elif campaign.product_cooldown_days and last + dt.timedelta(days=campaign.product_cooldown_days) > now:
                ends = last + dt.timedelta(days=campaign.product_cooldown_days)
            else:
                continue
            if any(c["kind"] == "review" and c["id"] == str(product.id) for c in cooldowns):
                continue
            cooldowns.append({
                "kind": "review", "id": str(product.id), "name": product.name, "image": _image(request, product.image_url),
                "expires_at": ends, "days_left": max((ends - now).days, 0) if ends else None, "one_time": ends is None,
            })

    history = []
    for receipt in Receipt.objects.filter(brand=brand, user=user).select_related("campaign", "matched_product").order_by("-created_at")[:50]:
        redemption = redemptions.filter(receipt=receipt).first()
        lines = [
            {"description": li.description, "quantity": li.quantity, "unit_price": str(li.unit_price) if li.unit_price is not None else None}
            for li in receipt.line_items.filter(matched_product__isnull=False)
        ]
        available = full_receipt_available(receipt, now)
        history.append({
            "id": str(receipt.id),
            "offer": receipt.campaign.offer_headline or receipt.campaign.name,
            "product": receipt.matched_product.name if receipt.matched_product_id else "",
            "retailer": receipt.merchant,
            "submitted_at": receipt.created_at,
            "reward": str(redemption.reward_amount) if redemption else None,
            "status": {"verified": "approved", "rejected": "rejected"}.get(receipt.status, "in_review"),
            "receipt_image": _image(request, receipt.image) if available else None,
            "full_receipt_days_left": max((full_receipt_until(receipt) - now).days, 0) if available else 0,
            "matching_lines": lines,
        })

    events = []
    for r in claims.select_related("campaign").order_by("-created_at")[:10]:
        events.append({"at": r.created_at, "text": f"Claimed {r.campaign.offer_headline or r.campaign.name}"})
    for r in redemptions.order_by("-created_at")[:10]:
        events.append({"at": r.created_at, "text": "Rebate approved"})
    for r in reviews.order_by("-created_at")[:10]:
        events.append({"at": r.created_at, "text": "Completed product review"})
    for v in OfferView.objects.filter(user=user, campaign__brand=brand).select_related("campaign").order_by("-created_at")[:10]:
        events.append({"at": v.created_at, "text": f"Viewed {v.campaign.offer_headline or v.campaign.name} campaign"})
    events.sort(key=lambda e: e["at"], reverse=True)

    return {
        "customer_id": str(user.id) if full else _anon_ref(brand.id, user.id),
        "name": _display_name(user, full),
        "email": user.email if full else None,
        "phone": user.phone if full else None,
        "customer_since": first_seen,
        "last_active": last_seen,
        "nibbl_opt_in": bool(nibbl and nibbl.opted_in),
        "brand_opt_in": bool(brand_consent and brand_consent.opted_in),
        "status": "banned" if ban else "active",
        "ban_reason": ban.reason if ban else "",
        "relationship": {
            "claims": n_claims, "completed_rebates": n_redeemed,
            "conversion": round(n_redeemed * 100 / n_claims) if n_claims else None,
            "rewards": str(rebate_rewards + review_rewards), "reviews": reviews.count(),
            "open_claims": len(open_claims),
        },
        "nibbl_activity": {
            "total_claims": all_claims,
            "completion": round(all_redeemed * 100 / all_claims) if all_claims else None,
            "total_reviews": Review.objects.filter(user=user).count(),
            "total_rewards": str(all_rewards),
        },
        "open_claims": open_claims,
        "cooldowns": cooldowns,
        "redemption_history": history,
        "recent_activity": events[:12],
    }


def remove_cooldown(*, brand, user, kind: str, ref: str, actor) -> None:
    """Master: removing a cooldown requires confirmation and is audit logged."""
    from django.utils import timezone

    from Apps.common.models import AuditLog
    from Apps.offers.models import CooldownRecord
    from Apps.products.models import Product
    from Apps.reviews.models import ReviewCooldownWaiver

    now = timezone.now()
    if kind == "rebate":
        record = CooldownRecord.objects.filter(id=ref, user=user, campaign__brand=brand, expires_at__gt=now).first()
        if record is None:
            raise CustomerError("That cooldown has already ended.")
        before = record.expires_at
        record.expires_at = now
        record.save(update_fields=["expires_at", "updated_at"])
        target = f"campaign {record.campaign_id}"
    elif kind == "review":
        product = Product.objects.filter(id=ref, brand=brand).first()
        if product is None:
            raise CustomerError("Product not found.")
        ReviewCooldownWaiver.objects.update_or_create(
            user=user, product=product, defaults={"brand": brand, "waived_at": now})
        before, target = None, f"product {product.id}"
    else:
        raise CustomerError("Unknown cooldown.")
    AuditLog.objects.create(
        action=AuditLog.Action.UPDATE, actor_type="brand_user", actor_id=str(actor.id),
        target_type="customer_cooldown", target_id=str(user.id),
        metadata={"event": "cooldown_removed", "brand": str(brand.id), "kind": kind, "target": target,
                  "previous_expiry": before.isoformat() if before else None},
    )
