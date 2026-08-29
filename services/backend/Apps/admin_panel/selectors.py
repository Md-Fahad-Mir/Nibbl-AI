"""Read-side queries for platform oversight (admin only, cross-brand)."""

from Apps.campaigns.models import Campaign
from Apps.common.models import AuditLog
from Apps.receipts.models import FraudFlag
from Apps.reviews.models import Review
from Apps.wallets.models import LedgerEntry

LIST_LIMIT = 200


def all_campaigns(*, status: str = ""):
    qs = Campaign.objects.select_related("brand").prefetch_related("products").all()
    if status:
        qs = qs.filter(status=status)
    return qs


def all_fraud_flags(*, resolved: str = ""):
    qs = FraudFlag.objects.select_related("user", "brand").all()
    if resolved in ("true", "false"):
        qs = qs.filter(resolved=(resolved == "true"))
    return qs[:LIST_LIMIT]


def all_users(*, suspended: str = "", flagged: str = ""):
    from Apps.accounts.models import User

    qs = User.objects.filter(is_deleted=False)
    if suspended == "true":
        qs = qs.filter(is_active=False)
    if flagged == "true":
        qs = qs.filter(fraud_flags__isnull=False).distinct()
    return qs[:LIST_LIMIT]


def all_transactions(*, category: str = ""):
    qs = LedgerEntry.objects.select_related("wallet").all()
    if category:
        qs = qs.filter(category=category)
    return qs[:LIST_LIMIT]


def held_reviews():
    return Review.objects.filter(status=Review.Status.HELD).select_related(
        "product", "review_campaign", "user"
    )


def audit_logs(*, target_type: str = "", actor_id: str = ""):
    qs = AuditLog.objects.all()
    if target_type:
        qs = qs.filter(target_type=target_type)
    if actor_id:
        qs = qs.filter(actor_id=actor_id)
    return qs[:LIST_LIMIT]


def role_statistics() -> dict:
    """Count active (non-deleted) users grouped by role.

    Returns a dict like:
        {"consumers": 1250, "brands": 84, "admins": 4, "total": 1338}

    Uses a single aggregated query instead of three separate COUNT queries.
    """
    from django.db.models import Count

    from Apps.accounts.models import User

    counts = dict(
        User.objects.filter(is_deleted=False)
        .values_list("role")
        .annotate(count=Count("id"))
    )
    return {
        "consumers": counts.get(User.Role.CONSUMER, 0),
        "brands": counts.get(User.Role.BRAND, 0),
        "admins": counts.get(User.Role.ADMIN, 0),
        "total": sum(counts.values()),
    }

