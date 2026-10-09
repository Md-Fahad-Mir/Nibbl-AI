"""Physical-receipt identity and unit allocation (Master: Duplicate Receipt
and Quantity Allocation).

* **Same receipt** = same merchant + date + time, unless both uploads clearly
  show a different transaction number or a different register. The total is
  ignored and an unread number never distinguishes — so a re-photographed
  receipt read slightly differently is still recognised.
* **One shopper per receipt.** Another account can't submit it while any of
  its uploads is pending or verified.
* **Each purchased unit is credited once.** A line with quantity 2 can back
  two claims; a third is refused. Rejecting a receipt releases its units.
"""

from __future__ import annotations

import hashlib
import re

from django.db import IntegrityError, transaction

from Apps.common.exceptions import DomainError


class ReceiptAlreadyUsed(DomainError):
    """Raised for a receipt (or unit) that can't be credited again."""


OTHER_ACCOUNT = "This receipt has already been submitted from another account."
UNITS_USED = "This receipt has already been used to claim this product."


def core_hash(merchant_hash, date_hash, time_hash) -> str | None:
    if not (merchant_hash and date_hash and time_hash):
        return None
    return hashlib.sha256(f"{merchant_hash}|{date_hash}|{time_hash}".encode()).hexdigest()


def normalize_number(value) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())[:100]


def _compatible(a: str, b: str) -> bool:
    """Only two clearly-read, different values tell receipts apart."""
    return not a or not b or a == b


def resolve(*, user, merchant_hash, date_hash, time_hash, transaction_number="", register_number=""):
    """The ReceiptIdentity for this upload (created if new), enforcing the
    one-account rule. None when the receipt can't be identified."""
    from Apps.receipts.models import Receipt, ReceiptIdentity

    core = core_hash(merchant_hash, date_hash, time_hash)
    if core is None:
        return None
    txn = normalize_number(transaction_number)
    reg = normalize_number(register_number)[:50]

    candidates = list(ReceiptIdentity.objects.select_for_update().filter(core_hash=core))
    matches = [
        c for c in candidates
        if _compatible(c.transaction_number, txn) and _compatible(c.register_number, reg)
    ]
    # Prefer the most specific match (same numbers), then the oldest.
    matches.sort(key=lambda c: (c.transaction_number != txn, c.register_number != reg, c.created_at))
    if matches:
        identity = matches[0]
        if identity.owner_id != user.id:
            in_use = identity.receipts.exclude(status=Receipt.Status.REJECTED).exists()
            if in_use:
                raise ReceiptAlreadyUsed(OTHER_ACCOUNT)
            identity.owner = user  # every earlier upload was rejected
        # Learn numbers read now that were unreadable before.
        identity.transaction_number = identity.transaction_number or txn
        identity.register_number = identity.register_number or reg
        try:
            with transaction.atomic():
                identity.save()
        except IntegrityError:  # filling a number collided with another identity
            identity.refresh_from_db()
        return identity
    try:
        with transaction.atomic():
            return ReceiptIdentity.objects.create(
                core_hash=core, transaction_number=txn, register_number=reg, owner=user
            )
    except IntegrityError:  # a simultaneous upload created it first
        identity = ReceiptIdentity.objects.select_for_update().get(
            core_hash=core, transaction_number=txn, register_number=reg
        )
        if identity.owner_id != user.id:
            raise ReceiptAlreadyUsed(OTHER_ACCOUNT)
        return identity


def allocate(receipt, lines: list[tuple], needed: int) -> int:
    """Credit up to ``needed`` units from ``lines`` [(line_item, quantity)]
    to ``receipt``. Returns how many were allocated; raises ReceiptAlreadyUsed
    when units the claim needs were already credited to another claim."""
    from Apps.receipts.models import ReceiptUnitAllocation

    identity = receipt.identity
    if identity is None or needed <= 0:
        return 0
    # Pool quantities by wording: the same item printed on two lines is one pool.
    pools: dict[str, list] = {}
    for line, quantity in lines:
        if not line.description_hash or quantity < 1:
            continue
        pools.setdefault(line.description_hash, []).append((line, quantity))

    available = 0
    plan = []  # (line_hash, line_item, unit_index)
    for line_hash, entries in pools.items():
        capacity = sum(q for _l, q in entries)
        taken = set(
            ReceiptUnitAllocation.objects.filter(identity=identity, line_hash=line_hash)
            .values_list("unit_index", flat=True)
        )
        free = [i for i in range(1, capacity + 1) if i not in taken]
        available += capacity
        line_for_unit = [line for line, q in entries for _ in range(q)]
        for index in free:
            if len(plan) >= needed:
                break
            plan.append((line_hash, line_for_unit[index - 1], index))
        if len(plan) >= needed:
            break

    if len(plan) < min(needed, available):
        raise ReceiptAlreadyUsed(UNITS_USED)
    try:
        with transaction.atomic():
            for line_hash, line, index in plan:
                ReceiptUnitAllocation.objects.create(
                    identity=identity, line_hash=line_hash, unit_index=index,
                    receipt=receipt, line_item=line,
                )
    except IntegrityError:  # a simultaneous upload took the same unit
        raise ReceiptAlreadyUsed(UNITS_USED)
    return len(plan)


def release(receipt) -> None:
    """Free a receipt's units (it was rejected, or is being re-allocated)."""
    receipt.allocations.all().delete()
