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


def brand_customers(brand) -> dict:
    from Apps.rebates.models import Redemption
    from Apps.receipts.models import Receipt
    from Apps.reviews.models import Review

    full_access = bool(brand.plan and brand.plan.data_access_level == "full")

    # Collect every user who engaged with this brand.
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

    from Apps.accounts.models import User

    users = {u.id: u for u in User.objects.filter(id__in=user_ids)}

    rows = []
    for user_id, user in users.items():
        redemptions = Redemption.objects.filter(brand=brand, user=user)
        reviews = Review.objects.filter(brand=brand, user=user)
        earned = redemptions.aggregate(t=Sum("reward_amount"))["t"] or ZERO

        row = {
            "customer_ref": _anon_ref(brand.id, user_id),
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
