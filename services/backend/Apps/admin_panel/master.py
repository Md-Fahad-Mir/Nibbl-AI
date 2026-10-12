"""Master Admin pages (Sheets 2–4): Brands board + Nibbl Admin Mode, Shoppers,
Suspensions, Admin Users, and the admin-only reservation cancel.

Every change here writes an ``AuditLog`` row (admin, time, reason, before /
after where it applies).
"""

from __future__ import annotations

import datetime as dt
import secrets
from decimal import Decimal
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Max, Q, Sum
from django.utils import timezone

from Apps.accounts.models import Referral, User
from Apps.admin_panel.models import ShopperNote
from Apps.admin_panel.services import AdminError, _audit
from Apps.brands.models import Brand, BrandApplication, BrandCustomerSuspension, BrandMembership
from Apps.common.models import AuditLog
from Apps.common.money import ZERO, to_money
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry, Wallet

CENT = Decimal("0.01")
REPEAT_SUSPENSIONS = 2  # suspended by this many brands (or more) = "repeated"


def _money(value) -> str:
    return str((value or ZERO).quantize(CENT))


# ---------------------------------------------------------------------------
# Brands
# ---------------------------------------------------------------------------
def _subscription(brand):
    from Apps.billing.models import Subscription

    return Subscription.objects.filter(brand=brand).first()


def _brand_payment_status(brand) -> str:
    from Apps.billing.models import AutoRefill, StripeCustomer

    sub = _subscription(brand)
    if sub is not None and sub.status == sub.Status.PAST_DUE:
        return "failed"
    if AutoRefill.objects.filter(brand=brand).exclude(stripe_payment_method_id="").exists():
        return "connected"
    return "connected" if StripeCustomer.objects.filter(brand=brand).exists() else "not_connected"


def _brand_verified(brand) -> bool:
    return BrandMembership.objects.filter(
        brand=brand, is_active=True, role=BrandMembership.Role.OWNER, user__is_email_verified=True
    ).exists()


def _revenue_by_brand() -> dict:
    from Apps.analytics.revenue import REVENUE

    return dict(
        LedgerEntry.objects.filter(
            wallet__kind=Wallet.Kind.BRAND, entry_type=LedgerEntry.EntryType.DEBIT, category__in=REVENUE.values()
        ).values_list("wallet__brand_id").annotate(t=Sum("amount"))
    )


def brands_board(*, q="", category="", plan="", status="", sort="lowest") -> dict:
    """Master Brands: KPIs + searchable table (category, plan, Nibbl revenue,
    wallet funds, payment status, last activity, status)."""
    from Apps.analytics.revenue import brand_categories

    categories = brand_categories()
    revenue = _revenue_by_brand()
    last_activity = dict(
        LedgerEntry.objects.filter(wallet__kind=Wallet.Kind.BRAND)
        .values_list("wallet__brand_id").annotate(t=Max("created_at"))
    )
    rows = []
    for brand in Brand.objects.select_related("plan").order_by("name"):
        payment = _brand_payment_status(brand)
        row = {
            "id": str(brand.id), "name": brand.name, "category": categories.get(brand.id, ""),
            "plan": brand.plan.name if brand.plan else None, "plan_slug": brand.plan.slug if brand.plan else "",
            "nibbl_revenue": _money(revenue.get(brand.id)),
            "wallet_funds": _money(wallet_services.get_or_create_brand_wallet(brand).available()),
            "payment_status": payment, "status": brand.status,
            "last_activity": last_activity.get(brand.id) or brand.updated_at,
        }
        rows.append(row)
    kpis = {
        "active": sum(1 for r in rows if r["status"] == Brand.Status.ACTIVE),
        "pending_verification": BrandApplication.objects.filter(status=BrandApplication.Status.PENDING).count(),
        "failed_payments": sum(1 for r in rows if r["payment_status"] == "failed"),
        "suspended": sum(1 for r in rows if r["status"] == Brand.Status.SUSPENDED),
    }
    needle = q.strip().lower()
    rows = [
        r for r in rows
        if (not needle or needle in r["name"].lower())
        and (not category or r["category"].lower() == category.lower())
        and (not plan or r["plan_slug"] == plan)
        and (not status or r["status"] == status)
    ]
    if sort == "highest":
        rows.sort(key=lambda r: Decimal(r["nibbl_revenue"]), reverse=True)
    elif sort == "recent":
        rows.sort(key=lambda r: r["last_activity"], reverse=True)
    else:
        rows.sort(key=lambda r: Decimal(r["nibbl_revenue"]))
    return {"kpis": kpis, "categories": sorted(set(categories.values())), "results": rows}


def brand_summary(brand) -> dict:
    """Selected brand panel: verification, payment connection, wallet funds,
    promotional credits, Nibbl revenue and active campaigns."""
    from Apps.analytics.revenue import brand_categories

    wallet = wallet_services.get_or_create_brand_wallet(brand)
    promo = wallet.ledger_entries.filter(is_promotional=True).aggregate(
        c=Sum("amount", filter=Q(entry_type=LedgerEntry.EntryType.CREDIT)),
        d=Sum("amount", filter=Q(entry_type=LedgerEntry.EntryType.DEBIT)),
    )
    return {
        "id": str(brand.id), "name": brand.name, "status": brand.status,
        "category": brand_categories().get(brand.id, ""),
        "plan": brand.plan.name if brand.plan else None,
        "verified": _brand_verified(brand),
        "payment_connected": _brand_payment_status(brand) == "connected",
        "payment_status": _brand_payment_status(brand),
        "wallet_funds": _money(wallet.available()),
        "promotional_credits": _money((promo["c"] or ZERO) - (promo["d"] or ZERO)),
        "nibbl_revenue": _money(_revenue_by_brand().get(brand.id)),
        "active_campaigns": brand.campaigns.filter(status="active").count(),
    }


ADMIN_ACCESS_TTL = dt.timedelta(minutes=5)


def start_brand_access(*, admin, brand) -> str:
    """Nibbl Admin Mode: a one-time brand-app sign-in link for this admin that
    opens ``brand``'s dashboard. Logged; every write in the session is logged
    by ``AdminBrandAccessAuditMiddleware``."""
    from Apps.accounts.models import MagicLinkToken
    from Apps.accounts.services import _hash_token

    now = timezone.now()
    MagicLinkToken.objects.filter(user=admin, used_at__isnull=True).update(used_at=now)
    token = secrets.token_urlsafe(32)
    MagicLinkToken.objects.create(user=admin, token_hash=_hash_token(token), expires_at=now + ADMIN_ACCESS_TTL)
    _audit(admin=admin, action=AuditLog.Action.OTHER, target_type="brand", target_id=brand.id,
           metadata={"event": "admin_brand_access_started", "brand": brand.name})
    query = urlencode({"token": token, "admin_brand": str(brand.id)})
    return f"{str(settings.BRAND_APP_URL).rstrip('/')}/login/magic?{query}"


# ---------------------------------------------------------------------------
# Shoppers
# ---------------------------------------------------------------------------
def _shopper_id(user) -> str:
    return f"SHP-{str(user.id)[:8].upper()}"


def shoppers_list(*, q="", status="") -> list[dict]:
    """Shopper List: account status, wallet, redemptions, referrals, brand
    suspensions and last activity (most recent first)."""
    from Apps.wallets.models import Wallet as W

    users = User.objects.filter(role=User.Role.CONSUMER, is_deleted=False)
    if q.strip():
        needle = q.strip()
        users = users.filter(Q(full_name__icontains=needle) | Q(email__icontains=needle)
                             | Q(phone__icontains=needle) | Q(id__istartswith=needle.lower().removeprefix("shp-")))
    if status == "active":
        users = users.filter(is_active=True)
    elif status == "suspended":
        users = users.filter(is_active=False)
    users = users.annotate(
        n_redemptions=Count("redemptions", distinct=True),
        n_referrals=Count("referrals_made", distinct=True),
        n_brand_suspensions=Count("brand_suspensions", filter=Q(brand_suspensions__is_active=True), distinct=True),
        last_reservation=Max("reservations__created_at"),
    ).order_by("-created_at")[:500]
    wallets = {w.user_id: w for w in W.objects.filter(kind=W.Kind.CUSTOMER, user__in=[u.id for u in users])}
    rows = []
    for user in users:
        wallet = wallets.get(user.id)
        rows.append({
            "id": str(user.id), "shopper_id": _shopper_id(user), "name": user.full_name or user.email,
            "email": user.email, "status": "active" if user.is_active else "suspended",
            "wallet": _money(wallet.available() if wallet else ZERO),
            "redemptions": user.n_redemptions, "referrals": user.n_referrals,
            "brand_suspensions": user.n_brand_suspensions,
            "last_activity": max(filter(None, [user.last_reservation, user.last_login, user.created_at])),
        })
    rows.sort(key=lambda r: r["last_activity"], reverse=True)
    return rows


def shopper_detail(user) -> dict:
    """Selected Shopper with the Master activity tabs."""
    from Apps.offers.models import CooldownRecord
    from Apps.payouts.models import PayoutMethod, WithdrawalRequest
    from Apps.rebates.models import Redemption
    from Apps.receipts.models import Receipt
    from Apps.reservations.models import Reservation
    from Apps.reviews.models import Review
    from Apps.wallets.activity import shopper_activity

    now = timezone.now()
    wallet = wallet_services.get_or_create_customer_wallet(user)
    summary = shopper_activity(user)["summary"]
    lifetime_paid = WithdrawalRequest.objects.filter(
        user=user, status=WithdrawalRequest.Status.PAID).aggregate(t=Sum("amount"))["t"]
    method = PayoutMethod.objects.filter(user=user).order_by("-is_default", "-created_at").first()

    receipts = Receipt.objects.filter(user=user, status=Receipt.Status.VERIFIED)
    brands = (Redemption.objects.filter(user=user).values("brand__name").annotate(n=Count("id")).order_by("-n"))
    retailers = (receipts.exclude(merchant="").values("merchant").annotate(n=Count("id")).order_by("-n"))

    claims = [{
        "id": str(r.id), "campaign": r.campaign.name, "brand": r.campaign.brand.name, "status": r.status,
        "claimed_at": r.created_at, "expires_at": r.expires_at,
        "can_cancel": r.status == Reservation.Status.ACTIVE,
    } for r in Reservation.objects.filter(user=user).select_related("campaign__brand").order_by("-created_at")[:50]]
    reviews = [{
        "id": str(r.id), "product": r.product.name, "brand": r.brand.name, "rating": r.rating,
        "status": r.status, "created_at": r.created_at,
    } for r in Review.objects.filter(user=user).select_related("product", "brand").order_by("-created_at")[:50]]
    ledger = [{
        "id": str(e.id), "date": e.created_at, "type": e.entry_type, "category": e.get_category_display(),
        "amount": _money(e.amount), "balance_after": _money(e.balance_after), "description": e.description,
    } for e in wallet.ledger_entries.order_by("-created_at")[:100]]
    referrals = [{
        "id": str(r.id), "new_shopper": r.referred.full_name or r.referred.email, "status": r.status,
        "created_at": r.created_at, "flag_reason": r.flag_reason,
    } for r in Referral.objects.filter(referrer=user).select_related("referred").order_by("-created_at")[:50]]
    suspensions = [{
        "id": str(s.id), "brand": s.brand.name, "reason": s.reason, "date": s.updated_at,
        "active": s.is_active, "times_suspended": s.times_suspended,
    } for s in BrandCustomerSuspension.objects.filter(user=user).select_related("brand").order_by("-updated_at")]
    cooldowns = [{
        "brand": c.campaign.brand.name, "campaign": c.campaign.name, "ends_at": c.expires_at,
    } for c in CooldownRecord.objects.filter(user=user, expires_at__gt=now).select_related("campaign__brand")
        .order_by("expires_at")]
    notes = [{
        "id": str(n.id), "body": n.body, "created_at": n.created_at,
        "author": (n.author.full_name or n.author.email) if n.author else "",
    } for n in ShopperNote.objects.filter(user=user).select_related("author")]

    return {
        "id": str(user.id), "shopper_id": _shopper_id(user), "name": user.full_name or user.email,
        "status": "active" if user.is_active else "suspended", "joined": user.created_at,
        "account": {
            "email": user.email, "phone": user.phone or "",
            "sms_verified": bool(getattr(user, "is_phone_verified", False)),
            "payout_identity": f"{method.provider} · {method.handle}" if method else "",
            "payout_locked": bool(method and method.review_status == PayoutMethod.ReviewStatus.APPROVED),
        },
        "wallet": {
            "available": _money(wallet.available()), "pending_approval": summary["pending_approval"],
            "lifetime_paid": _money(lifetime_paid),
        },
        "purchase_activity": {
            "brands": [{"name": b["brand__name"], "purchases": b["n"]} for b in brands[:10]],
            "retailers": [{"name": r["merchant"], "purchases": r["n"]} for r in retailers[:10]],
        },
        "cooldowns": cooldowns,
        "ledger": ledger, "claims": claims, "reviews": reviews, "referrals": referrals,
        "suspensions": suspensions, "notes": notes,
    }


def add_note(*, admin, user, body: str) -> ShopperNote:
    body = (body or "").strip()
    if not body:
        raise AdminError("Write the note first.")
    note = ShopperNote.objects.create(user=user, author=admin, body=body[:2000])
    _audit(admin=admin, action=AuditLog.Action.CREATE, target_type="user", target_id=user.id,
           metadata={"event": "shopper_note_added"})
    return note


@transaction.atomic
def adjust_wallet(*, admin, user, amount, direction: str, reason: str) -> LedgerEntry:
    """Wallet adjustment: credit or debit with a required reason; a new
    ledger entry, audit-logged with before/after balance."""
    reason = (reason or "").strip()
    if not reason:
        raise AdminError("A reason is required for wallet adjustments.")
    amount = to_money(amount)
    if amount <= ZERO:
        raise AdminError("Enter an amount above $0.")
    wallet = wallet_services.get_or_create_customer_wallet(user)
    before = wallet.available()
    move = wallet_services.credit if direction == "credit" else wallet_services.debit
    if direction == "debit" and amount > before:
        raise AdminError("The debit is larger than the shopper's available balance.")
    entry = move(wallet=wallet, amount=amount, category=LedgerEntry.Category.ADJUSTMENT,
                 reference_type="admin_adjustment", reference_id=user.id, description=reason[:255])
    wallet.refresh_from_db()
    _audit(admin=admin, action=AuditLog.Action.UPDATE, target_type="user", target_id=user.id, metadata={
        "event": "wallet_adjustment", "direction": direction, "amount": str(amount), "reason": reason,
        "before": str(before), "after": str(wallet.available()),
    })
    return entry


@transaction.atomic
def cancel_reservation(*, admin, reservation, reason: str):
    """Only Nibbl Admin may cancel an existing reservation — with a reason and
    an audit record. Releases the brand's reserved funds."""
    from Apps.reservations.models import Reservation

    reason = (reason or "").strip()
    if not reason:
        raise AdminError("A reason is required to cancel a reservation.")
    if reservation.status != Reservation.Status.ACTIVE:
        raise AdminError("Only an open claim can be cancelled.")
    if reservation.receipts.filter(status="pending").exists():
        raise AdminError("A receipt for this claim is waiting for review; decide the receipt instead.")
    if reservation.hold_id:
        wallet_services.release_hold(hold=reservation.hold)
    reservation.status = Reservation.Status.CANCELLED
    reservation.cancelled_at = timezone.now()
    reservation.save(update_fields=["status", "cancelled_at", "updated_at"])
    _audit(admin=admin, action=AuditLog.Action.UPDATE, target_type="reservation", target_id=reservation.id,
           metadata={"event": "reservation_cancelled", "reason": reason, "before": "active", "after": "cancelled",
                     "user": str(reservation.user_id), "campaign": str(reservation.campaign_id)})
    return reservation


# ---------------------------------------------------------------------------
# Suspensions
# ---------------------------------------------------------------------------
def suspensions_board(*, q="", status="", days: int | None = None) -> dict:
    qs = BrandCustomerSuspension.objects.select_related("brand", "user").order_by("-updated_at")
    counts = dict(
        BrandCustomerSuspension.objects.filter(is_active=True).values_list("user_id").annotate(n=Count("id"))
    )
    summary = {
        "active_brand_suspensions": BrandCustomerSuspension.objects.filter(is_active=True).count(),
        "repeat_suspensions": sum(1 for n in counts.values() if n >= REPEAT_SUSPENSIONS),
        "global_suspensions": User.objects.filter(role=User.Role.CONSUMER, is_active=False, is_deleted=False).count(),
    }
    if status == "active":
        qs = qs.filter(is_active=True)
    elif status == "removed":
        qs = qs.filter(is_active=False)
    if days:
        qs = qs.filter(updated_at__gte=timezone.now() - dt.timedelta(days=days))
    if q.strip():
        n = q.strip()
        qs = qs.filter(Q(user__full_name__icontains=n) | Q(user__email__icontains=n)
                       | Q(brand__name__icontains=n) | Q(reason__icontains=n))
    rows = []
    for s in qs[:300]:
        prior = BrandCustomerSuspension.objects.filter(user=s.user).exclude(id=s.id).count()
        rows.append({
            "id": str(s.id), "shopper": s.user.full_name or s.user.email, "shopper_id": str(s.user_id),
            "shopper_ref": _shopper_id(s.user), "brand": s.brand.name, "reason": s.reason,
            "date": s.updated_at, "prior_brand_suspensions": prior,
            "status": "active" if s.is_active else "removed",
            "globally_suspended": not s.user.is_active,
            "repeated": counts.get(s.user_id, 0) >= REPEAT_SUSPENSIONS,
        })
    return {"summary": summary, "results": rows}


@transaction.atomic
def remove_brand_suspension(*, admin, suspension, reason: str = "") -> BrandCustomerSuspension:
    if not suspension.is_active:
        raise AdminError("This brand suspension was already removed.")
    suspension.is_active = False
    suspension.save(update_fields=["is_active", "updated_at"])
    _audit(admin=admin, action=AuditLog.Action.UPDATE, target_type="brand_suspension", target_id=suspension.id,
           metadata={"event": "brand_suspension_removed", "brand": str(suspension.brand_id),
                     "user": str(suspension.user_id), "reason": reason, "before": "active", "after": "removed"})
    return suspension


# ---------------------------------------------------------------------------
# Admin Users (staff roles)
# ---------------------------------------------------------------------------
def admin_users() -> list[dict]:
    admins = User.objects.filter(is_deleted=False).filter(
        Q(role=User.Role.ADMIN) | Q(is_staff=True) | Q(is_superuser=True)).order_by("full_name", "email")
    return [{
        "id": str(u.id), "name": u.full_name or u.email, "email": u.email, "role": u.admin_staff_role,
        "is_active": u.is_active, "last_login": u.last_login,
    } for u in admins]


@transaction.atomic
def add_admin_user(*, admin, email: str, full_name: str, role: str) -> User:
    from Apps.accounts import services as account_services

    email = (email or "").strip().lower()
    if role not in User.StaffRole.values:
        raise AdminError("Choose a role: Administrator, Operations or Analytics.")
    if not email:
        raise AdminError("Enter an email address.")
    user = User.objects.filter(email__iexact=email).first()
    if user is not None and not user.is_platform_admin and user.role != User.Role.CONSUMER:
        raise AdminError("This email belongs to a brand account. Use a separate email for Admin access.")
    if user is None:
        user = User.objects.create_user(email=email, full_name=(full_name or "").strip() or email.split("@")[0],
                                        password=None)
    user.role = User.Role.ADMIN
    user.staff_role = role
    user.is_email_verified = True
    user.save()
    _audit(admin=admin, action=AuditLog.Action.CREATE, target_type="admin_user", target_id=user.id,
           metadata={"event": "admin_user_added", "email": email, "role": role})
    # They set their own password through the emailed reset code.
    account_services.request_password_reset(email=email)
    return user


@transaction.atomic
def change_admin_role(*, admin, user, role: str) -> User:
    if role not in User.StaffRole.values:
        raise AdminError("Choose a role: Administrator, Operations or Analytics.")
    if user.id == admin.id and role != User.StaffRole.ADMINISTRATOR:
        raise AdminError("You can't remove your own Administrator role.")
    before = user.admin_staff_role
    user.staff_role = role
    user.save(update_fields=["staff_role"])
    _audit(admin=admin, action=AuditLog.Action.UPDATE, target_type="admin_user", target_id=user.id,
           metadata={"event": "admin_role_changed", "before": before, "after": role})
    return user


@transaction.atomic
def remove_admin_user(*, admin, user) -> None:
    if user.id == admin.id:
        raise AdminError("You can't remove your own Admin access.")
    if user.is_superuser:
        raise AdminError("This is the platform owner account and can't be removed here.")
    before = user.admin_staff_role
    user.role = User.Role.CONSUMER
    user.staff_role = ""
    user.is_staff = False
    user.save(update_fields=["role", "staff_role", "is_staff"])
    _audit(admin=admin, action=AuditLog.Action.DELETE, target_type="admin_user", target_id=user.id,
           metadata={"event": "admin_user_removed", "before": before})
