"""Device / network / browser fraud checks (Master #51).

Every key shopper action records the device id (``X-Device-Id`` header,
hashed), IP address and browser. Admin-configurable rules (Platform
Settings) then flag accounts that share a device with too many other accounts,
or a network with too many accounts within 24 hours. Flags route receipts and
withdrawals to manual review; shoppers are never told which rule fired.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import re

from django.utils import timezone

from Apps.accounts.models import DeviceRecord

DEVICE_ID = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")
SHARED_DEVICE_WINDOW = dt.timedelta(days=90)
NETWORK_WINDOW = dt.timedelta(hours=24)


def client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR") or None


def device_hash(request) -> str:
    raw = (request.META.get("HTTP_X_DEVICE_ID") or "").strip()
    return hashlib.sha256(raw.encode()).hexdigest() if DEVICE_ID.match(raw) else ""


def record(request, user, event: str) -> None:
    """Never raises — fraud signals must not block the action itself."""
    if user is None or not getattr(user, "is_authenticated", False):
        return
    try:
        DeviceRecord.objects.create(
            user=user, device_id=device_hash(request), ip_address=client_ip(request),
            user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:255], event=event,
        )
    except Exception:  # noqa: BLE001 — bad IP strings etc.
        pass


def _devices(user, since):
    return set(
        DeviceRecord.objects.filter(user=user, created_at__gte=since).exclude(device_id="")
        .values_list("device_id", flat=True)
    )


def _ips(user, since):
    return set(
        DeviceRecord.objects.filter(user=user, created_at__gte=since, ip_address__isnull=False)
        .values_list("ip_address", flat=True)
    )


def risk_reasons(user, now=None) -> list[str]:
    """Admin-facing reasons this account looks risky (empty = no flag)."""
    from Apps.common.models import get_platform_settings

    cfg = get_platform_settings()
    if not cfg.device_checks_enabled:
        return []
    now = now or timezone.now()
    reasons = []
    devices = _devices(user, now - SHARED_DEVICE_WINDOW)
    if devices:
        accounts = DeviceRecord.objects.filter(device_id__in=devices).values("user_id").distinct().count()
        if accounts > cfg.max_accounts_per_device:
            reasons.append(f"Device shared by {accounts} accounts (limit {cfg.max_accounts_per_device}).")
    since = now - NETWORK_WINDOW
    ips = _ips(user, since)
    if ips:
        accounts = (
            DeviceRecord.objects.filter(ip_address__in=ips, created_at__gte=since)
            .values("user_id").distinct().count()
        )
        if accounts > cfg.max_accounts_per_ip_daily:
            reasons.append(f"{accounts} accounts on one network in 24 hours (limit {cfg.max_accounts_per_ip_daily}).")
    return reasons


def shared_with(user, other) -> dict:
    """Whether two accounts share a device or a network (referral checks)."""
    since = timezone.now() - SHARED_DEVICE_WINDOW
    return {
        "device": bool(_devices(user, since) & _devices(other, since)),
        "network": bool(_ips(user, since) & _ips(other, since)),
    }


def linked_accounts(user) -> list[dict]:
    """Other accounts seen on this account's devices or networks (admin)."""
    from Apps.accounts.models import User

    since = timezone.now() - SHARED_DEVICE_WINDOW
    devices, ips = _devices(user, since), _ips(user, since)
    rows: dict = {}
    for kind, field, values in (("device", "device_id__in", devices), ("network", "ip_address__in", ips)):
        if not values:
            continue
        for other_id in (DeviceRecord.objects.filter(**{field: values}, created_at__gte=since)
                         .exclude(user=user).values_list("user_id", flat=True).distinct()):
            rows.setdefault(other_id, set()).add(kind)
    users = User.objects.in_bulk(rows.keys())
    return [
        {"id": str(uid), "email": users[uid].email, "full_name": users[uid].full_name,
         "is_active": users[uid].is_active, "shared": sorted(kinds)}
        for uid, kinds in rows.items() if uid in users
    ]
