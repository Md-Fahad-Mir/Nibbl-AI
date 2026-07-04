"""Receipt processing: upload, OCR, matching, fraud, and review decisions."""

from __future__ import annotations

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from Apps.common.exceptions import DomainError
from Apps.common.text import normalize_text
from Apps.products import services as product_services
from Apps.products.models import Product, ProductAlias
from Apps.products.selectors import match_product
from Apps.receipts import ocr
from Apps.receipts.signals import receipt_rejected, receipt_verified
from Apps.receipts.models import (
    FraudFlag,
    ManualReviewItem,
    OCRResult,
    Receipt,
    ReceiptLineItem,
)
from Apps.reservations.models import Reservation


class ReceiptError(DomainError):
    """Expected, user-facing receipt errors (mapped to HTTP 400)."""


# ---------------------------------------------------------------------------
# Upload + processing
# ---------------------------------------------------------------------------
@transaction.atomic
def upload_receipt(
    *, user, reservation_id, image=None, merchant="", purchased_at=None,
    total=None, items=None,
) -> Receipt:
    reservation = (
        Reservation.objects.select_related("campaign", "campaign__brand", "campaign__product")
        .filter(id=reservation_id, user=user)
        .first()
    )
    if reservation is None:
        raise ReceiptError("Reservation not found.")
    if reservation.kind != Reservation.Kind.REBATE:
        raise ReceiptError("Only rebate claims accept receipts.")
    if reservation.status != Reservation.Status.ACTIVE:
        raise ReceiptError("This claim is no longer active.")
    if reservation.receipts.exclude(status=Receipt.Status.REJECTED).exists():
        raise ReceiptError("A receipt has already been submitted for this claim.")

    campaign = reservation.campaign
    brand = campaign.brand
    items = items or []

    fp = ocr.fingerprint(
        merchant=merchant, purchased_at=purchased_at, total=total,
        items=items, image=image,
    )

    receipt = Receipt.objects.create(
        user=user,
        reservation=reservation,
        brand=brand,
        campaign=campaign,
        image=image,
        merchant=merchant,
        purchased_at=purchased_at,
        total=total,
        fingerprint=fp,
        status=Receipt.Status.PENDING,
    )

    ocr_data = ocr.run_ocr(
        image=image, merchant=merchant, purchased_at=purchased_at,
        total=total, items=items,
    )
    OCRResult.objects.create(receipt=receipt, provider=ocr_data["provider"], raw=ocr_data)

    _create_and_match_line_items(receipt, items)
    _evaluate_receipt(receipt, fingerprint=fp)
    receipt.refresh_from_db()
    return receipt


def _create_and_match_line_items(receipt: Receipt, items: list[dict]) -> None:
    brand = receipt.brand
    for item in items:
        product = match_product(brand=brand, text=item["description"])
        ReceiptLineItem.objects.create(
            receipt=receipt,
            description=item["description"],
            normalized=normalize_text(item["description"]),
            quantity=int(item.get("quantity", 1)),
            unit_price=item.get("unit_price"),
            matched_product=product,
        )


def _matched_units(receipt: Receipt) -> int:
    targets = set(receipt.campaign.products.values_list("id", flat=True))
    return sum(
        li.quantity
        for li in receipt.line_items.all()
        if li.matched_product_id in targets
    )


def _evaluate_receipt(receipt: Receipt, *, fingerprint: str) -> None:
    """Decide: auto-reject (duplicate), auto-verify, or route to manual review."""
    # Duplicate detection (global): the same physical receipt can't be reused.
    is_duplicate = (
        Receipt.objects.filter(fingerprint=fingerprint)
        .exclude(id=receipt.id)
        .exclude(status=Receipt.Status.REJECTED)
        .exists()
    )
    if is_duplicate:
        FraudFlag.objects.create(
            receipt=receipt, user=receipt.user, brand=receipt.brand,
            reason=FraudFlag.Reason.DUPLICATE, detail="Duplicate fingerprint.",
        )
        _reject(receipt, reason="Duplicate receipt.")
        return

    matched_units = _matched_units(receipt)
    required = getattr(receipt.campaign.restriction, "min_units", receipt.campaign.min_purchase_units)
    receipt.matched = matched_units > 0
    receipt.matched_units = matched_units

    active_claims = Reservation.objects.filter(
        user=receipt.user, status=Reservation.Status.ACTIVE
    ).count()
    velocity = active_claims > settings.MAX_ACTIVE_CLAIMS

    if matched_units >= required and not velocity:
        receipt.save(update_fields=["matched", "matched_units", "updated_at"])
        _verify(receipt, reviewer=None, reason="Auto-verified.")
        return

    # Otherwise, route to the brand's manual review queue with fraud signals.
    receipt.save(update_fields=["matched", "matched_units", "updated_at"])
    if matched_units < required:
        FraudFlag.objects.create(
            receipt=receipt, user=receipt.user, brand=receipt.brand,
            reason=FraudFlag.Reason.NO_MATCH,
            detail=f"Matched {matched_units}/{required} required units.",
        )
    if velocity:
        FraudFlag.objects.create(
            receipt=receipt, user=receipt.user, brand=receipt.brand,
            reason=FraudFlag.Reason.VELOCITY,
            detail=f"{active_claims} active claims.",
        )
    ManualReviewItem.objects.create(receipt=receipt, brand=receipt.brand)


# ---------------------------------------------------------------------------
# Decision helpers
# ---------------------------------------------------------------------------
def _verify(receipt: Receipt, *, reviewer, reason: str) -> Receipt:
    receipt.status = Receipt.Status.VERIFIED
    receipt.decision_reason = reason
    receipt.reviewed_by = reviewer
    receipt.reviewed_at = timezone.now()
    receipt.save(
        update_fields=["status", "decision_reason", "reviewed_by", "reviewed_at", "updated_at"]
    )
    # Notify the rebates app to issue the reward (capture hold, credit customer).
    receipt_verified.send(sender=Receipt, receipt=receipt)
    return receipt


def _reject(receipt: Receipt, *, reason: str, reviewer=None) -> Receipt:
    receipt.status = Receipt.Status.REJECTED
    receipt.decision_reason = reason
    receipt.reviewed_by = reviewer
    receipt.reviewed_at = timezone.now()
    receipt.save(
        update_fields=["status", "decision_reason", "reviewed_by", "reviewed_at", "updated_at"]
    )
    # Notify the rebates app to release the reservation's escrow hold.
    receipt_rejected.send(sender=Receipt, receipt=receipt)
    return receipt


# ---------------------------------------------------------------------------
# Manual review actions (brand)
# ---------------------------------------------------------------------------
def _resolve_item(item: ManualReviewItem, reviewer) -> None:
    item.status = ManualReviewItem.Status.RESOLVED
    item.resolved_by = reviewer
    item.resolved_at = timezone.now()
    item.save(update_fields=["status", "resolved_by", "resolved_at", "updated_at"])


@transaction.atomic
def approve_review(*, item: ManualReviewItem, reviewer) -> Receipt:
    if item.status != ManualReviewItem.Status.OPEN:
        raise ReceiptError("This review item is already resolved.")
    receipt = item.receipt
    _resolve_item(item, reviewer)
    receipt.fraud_flags.filter(resolved=False).update(resolved=True)
    return _verify(receipt, reviewer=reviewer, reason="Approved by brand.")


@transaction.atomic
def decline_review(*, item: ManualReviewItem, reviewer, reason: str) -> Receipt:
    if item.status != ManualReviewItem.Status.OPEN:
        raise ReceiptError("This review item is already resolved.")
    if not reason:
        raise ReceiptError("A reason is required to decline.")
    receipt = item.receipt
    _resolve_item(item, reviewer)
    return _reject(receipt, reason=reason, reviewer=reviewer)


def add_alias_from_review(*, item: ManualReviewItem, line_item_id, product_id) -> ProductAlias:
    """Add a product alias directly from the review flow (spec 2.13).

    Improves automation accuracy for future receipts.
    """
    line_item = item.receipt.line_items.filter(id=line_item_id).first()
    if line_item is None:
        raise ReceiptError("Line item not found on this receipt.")
    product = Product.objects.filter(
        id=product_id, brand=item.brand, is_active=True
    ).first()
    if product is None:
        raise ReceiptError("Product not found in this brand's library.")
    try:
        alias = product_services.add_alias(
            product=product, alias_text=line_item.description
        )
    except product_services.ProductError as exc:
        raise ReceiptError(str(exc))
    # Re-match this line item now that the alias exists.
    line_item.matched_product = product
    line_item.save(update_fields=["matched_product", "updated_at"])
    return alias


# ---------------------------------------------------------------------------
# User flagging (brand)
# ---------------------------------------------------------------------------
def flag_user(*, brand, user, reason, detail="", flagged_by) -> FraudFlag:
    return FraudFlag.objects.create(
        user=user,
        brand=brand,
        reason=reason or FraudFlag.Reason.MANUAL,
        detail=detail,
        created_by=flagged_by,
    )
