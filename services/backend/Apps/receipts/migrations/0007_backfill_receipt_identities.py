"""Give existing receipts their physical-receipt identity and record the
units they already hold, so receipts uploaded before the new duplicate
protection can't be credited again. Mirrors Apps.receipts.identity (inlined:
migrations must use historical models)."""

import hashlib
import re

from django.db import migrations


def _core(r):
    if not (r.merchant_hash and r.purchase_date_hash and r.purchase_time_hash):
        return None
    raw = f"{r.merchant_hash}|{r.purchase_date_hash}|{r.purchase_time_hash}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _norm(value, limit):
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())[:limit]


def forwards(apps, schema_editor):
    Receipt = apps.get_model("receipts", "Receipt")
    Identity = apps.get_model("receipts", "ReceiptIdentity")
    Allocation = apps.get_model("receipts", "ReceiptUnitAllocation")

    for receipt in Receipt.objects.exclude(status="rejected").order_by("created_at"):
        core = _core(receipt)
        if core is None:
            continue
        txn = _norm(receipt.receipt_number, 100)
        reg = _norm(receipt.register_number, 50)
        identity = None
        for candidate in Identity.objects.filter(core_hash=core).order_by("created_at"):
            if (not candidate.transaction_number or not txn or candidate.transaction_number == txn) and (
                not candidate.register_number or not reg or candidate.register_number == reg
            ):
                identity = candidate
                break
        if identity is None:
            identity = Identity.objects.create(
                core_hash=core, transaction_number=txn, register_number=reg, owner_id=receipt.user_id
            )
        receipt.identity = identity
        receipt.save(update_fields=["identity"])

        # Units this receipt already holds: its matched product's lines.
        needed = receipt.matched_units or 0
        if not needed or not receipt.matched_product_id:
            continue
        for line in receipt.line_items.filter(matched_product_id=receipt.matched_product_id):
            if needed <= 0 or not line.description_hash:
                break
            taken = set(
                Allocation.objects.filter(identity=identity, line_hash=line.description_hash)
                .values_list("unit_index", flat=True)
            )
            for index in range(1, line.quantity + 1):
                if needed <= 0:
                    break
                if index in taken:
                    continue
                Allocation.objects.create(
                    identity=identity, line_hash=line.description_hash, unit_index=index,
                    receipt=receipt, line_item=line,
                )
                needed -= 1


class Migration(migrations.Migration):

    dependencies = [
        ("receipts", "0006_receipt_identity_and_allocations"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
