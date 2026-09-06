"""Receipt processing: upload, OCR, matching, fraud, and review decisions."""

from __future__ import annotations

import datetime as dt
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
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


class DuplicateReceipt(ReceiptError):
    """This physical receipt has already been used (mapped to HTTP 409)."""


class ReceiptUnreadable(ReceiptError):
    """OCR processed the image but it isn't a usable receipt (HTTP 422)."""


class OCRUnavailable(ReceiptError):
    """The OCR provider is down or unconfigured (HTTP 503). Claim untouched."""


# ---------------------------------------------------------------------------
# Upload + processing
# ---------------------------------------------------------------------------
def upload_receipt(*, user, reservation_id, image=None, **legacy) -> Receipt:
    """Submit a receipt photo for an active claim.

    Flow (matches the fast-path duplicate check first, then the more
    expensive per-item product matching):

        OCR -> normalize merchant/date/time/items -> identity hashes
            -> duplicate lookup (fast path, receipt + claimed product)
            -> merchant / purchase-window / eligible-product checks
            -> verify (or route to manual review) -> reward via signal

    Verification depends on the claimed campaign's product being found among
    the receipt's OCR-extracted items, the purchase date/time falling inside
    the campaign window, and (only for campaigns that opt in via
    ``Campaign.allowed_merchants``) the merchant matching. By default no
    campaign restricts merchants — a receipt is never rejected for being from
    "the wrong shop" unless a brand has explicitly configured one.

    ``legacy`` accepts the pre-OCR ``merchant`` / ``purchased_at`` / ``total`` /
    ``items`` keyword arguments. They are used only when no ``image`` is given,
    which keeps "digital receipt" submissions and the existing test-suite
    fixtures working without a live OCR service.
    """
    reservation = _load_reservation(user, reservation_id)
    campaign = reservation.campaign
    brand = campaign.brand

    extracted = _extract(image=image, legacy=legacy)

    # --- Identity hashes -----------------------------------------------------
    # Merchant name / purchase date / purchase time, hashed separately
    # (Apps.receipts.ocr.hash_text/hash_date/hash_time) — never SKU, price,
    # quantity, tax, payment data, or the complete OCR payload.
    merchant_hash = ocr.hash_text(extracted.merchant_name)
    date_hash = ocr.hash_date(extracted.purchase_date)
    time_hash = ocr.hash_time(extracted.purchase_time)
    # Audit-only normalized view of the full payload; not used for any
    # accept/reject/duplicate decision (see Apps.receipts.ocr).
    canonical_data = ocr.canonicalize_receipt_data(extracted.raw)

    # --- Validate the receipt against the claimed campaign -----------------
    # Hard rejections (unaccepted merchant / wrong product / outside the
    # campaign window) raise. Soft problems return a note that blocks
    # auto-reward and sends the receipt to the brand's manual review queue.
    merchant_note = _check_merchant(extracted, campaign=campaign)
    date_note = _check_purchase_window(extracted, campaign=campaign)
    eligible_product, matched_units, eligible_description = _match_eligible_product(
        extracted, campaign=campaign
    )
    # The specific line's description that satisfied the claim — this, not
    # the whole receipt, is what "claimed product" identifies for duplicate
    # detection (a receipt with several eligible products can fund one
    # reward per distinct product, but not the same product twice).
    description_hash = ocr.hash_text(eligible_description) if eligible_description else None

    review_note = merchant_note or date_note

    # --- Fast duplicate path (receipt + claimed product) --------------------
    # Only meaningful once merchant, date, time AND the claimed product are
    # all known — a receipt missing any one of them simply has no complete
    # identity to compare and falls through to manual review instead (see
    # _assert_single_use). This lookup is an optimization (skip expensive
    # matching for a receipt already known to be a duplicate); the UNIQUE
    # constraint hit at INSERT time below is the actual race-safe guard.
    identity_ready = bool(merchant_hash and date_hash and time_hash and description_hash)
    if identity_ready and Receipt.objects.filter(
        merchant_hash=merchant_hash,
        purchase_date_hash=date_hash,
        purchase_time_hash=time_hash,
        product_description_hash=description_hash,
    ).exists():
        raise DuplicateReceipt("This receipt has already been used to claim this product.")

    with transaction.atomic():
        try:
            with transaction.atomic():
                receipt = Receipt.objects.create(
                    user=user,
                    reservation=reservation,
                    brand=brand,
                    campaign=campaign,
                    image=image,
                    merchant=extracted.merchant_name,
                    purchased_at=_aware(extracted.purchased_at),
                    total=extracted.total,
                    receipt_number=extracted.receipt_number[:100],
                    merchant_hash=merchant_hash,
                    purchase_date_hash=date_hash,
                    purchase_time_hash=time_hash,
                    product_description_hash=description_hash,
                    matched_product=eligible_product,
                    status=Receipt.Status.PENDING,
                )
        except IntegrityError:
            # The UNIQUE constraint is the real duplicate guard: it closes
            # the check-then-insert race between two simultaneous submissions
            # of the same physical receipt claiming the same product that
            # both passed the fast-path lookup above before either inserted.
            raise DuplicateReceipt("This receipt has already been used to claim this product.")

        OCRResult.objects.create(
            receipt=receipt,
            provider=extracted.provider,
            raw=extracted.raw,
            canonical_data=canonical_data,
            confidence=ocr.extract_confidence(extracted.raw),
        )
        _create_line_items(receipt, extracted)

        receipt.matched = matched_units > 0
        receipt.matched_units = matched_units
        receipt.save(update_fields=["matched", "matched_units", "updated_at"])

        _decide(receipt, matched_units=matched_units, review_note=review_note)

    receipt.refresh_from_db()
    return receipt


def _load_reservation(user, reservation_id) -> Reservation:
    reservation = (
        Reservation.objects.select_related("campaign", "campaign__brand")
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
    return reservation


def _extract(*, image, legacy: dict) -> ocr.ExtractedReceipt:
    """Get structured receipt data: OCR when an image is supplied, else the
    already-structured payload the caller passed in."""
    if image is None:
        return _from_legacy(legacy)

    try:
        return ocr.extract_receipt(image)
    except ocr.OCRUnreadable as exc:
        raise ReceiptUnreadable(str(exc))
    except ocr.OCRUnavailable as exc:
        raise OCRUnavailable(str(exc))


def _json_safe(value):
    """Best-effort JSON-safe copy (``Decimal`` -> ``str``, recursively).

    Real OCR responses are already plain JSON. Only the Python-side legacy
    kwargs path (test fixtures / digital-receipt submissions) can carry
    ``Decimal`` objects (e.g. ``total=Decimal("9.99")``) — those would
    otherwise crash ``OCRResult.raw``'s plain ``JSONField`` encoder, which
    (unlike DRF's) does not know how to serialize ``Decimal``.
    """
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def _from_legacy(legacy: dict) -> ocr.ExtractedReceipt:
    """Build an ExtractedReceipt from pre-OCR kwargs (test/fixture use only —
    the real HTTP API always supplies an image; see ``upload_receipt``).

    ``raw`` is shaped like the real provider envelope (a ``data`` key holding
    merchant/transaction/items/receipt_number/total) so it fingerprints the
    same way a live OCR response would — merchant, date/time and receipt
    number all participate, not just the items list.
    """
    purchased_at = legacy.get("purchased_at")
    merchant = legacy.get("merchant", "") or ""
    receipt_number = legacy.get("receipt_number", "") or ""
    items = legacy.get("items") or []
    return ocr.ExtractedReceipt(
        merchant_name=merchant,
        purchase_date=purchased_at.date() if purchased_at else None,
        purchase_time=purchased_at.time().replace(microsecond=0) if purchased_at else None,
        receipt_number=receipt_number,
        total=legacy.get("total"),
        items=[
            ocr.ExtractedItem(
                description=i["description"],
                quantity=int(i.get("quantity", 1) or 1),
                unit_price=i.get("unit_price"),
                sku=i.get("sku", "") or "",
                description_with_size=i["description"],
            )
            for i in items
        ],
        provider="client-supplied",
        raw={
            "provider": "client-supplied",
            "data": {
                "merchant": {"name": merchant},
                "transaction": {
                    "date": purchased_at.date().isoformat() if purchased_at else None,
                    "time": (
                        purchased_at.time().replace(microsecond=0).isoformat()
                        if purchased_at
                        else None
                    ),
                },
                "items": _json_safe(items),
                "receipt_number": receipt_number,
                "total": _json_safe(legacy.get("total")),
            },
        },
    )


def _aware(value: dt.datetime | None):
    if value is None:
        return None
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


# ---------------------------------------------------------------------------
# Validation steps
# ---------------------------------------------------------------------------
def _allowed_merchants(campaign) -> list[str]:
    raw = campaign.allowed_merchants or ""
    return [normalize_text(m) for m in raw.split(",") if m.strip()]


def _check_merchant(extracted, *, campaign) -> str:
    """Check the OCR-extracted merchant against the campaign's restriction,
    when one is configured.

    ``campaign.allowed_merchants`` is blank by default and on every campaign
    that existed before this field was added — that means no restriction,
    preserving the platform's "any shop" model (a receipt is never rejected
    for being from the wrong shop unless a brand explicitly opts in). An
    *unreadable* merchant when a restriction IS configured is a limit of the
    scan, not evidence of ineligibility, so it returns a note that routes to
    manual review instead of raising — the same posture as an unreadable
    purchase date.
    """
    allowed = _allowed_merchants(campaign)
    if not allowed:
        return ""

    merchant_norm = normalize_text(extracted.merchant_name)
    if not merchant_norm:
        return "Merchant could not be read."
    if any(a in merchant_norm or merchant_norm in a for a in allowed):
        return ""
    raise ReceiptError(
        "This receipt is not from a merchant accepted for this campaign."
    )


def _check_purchase_window(extracted, *, campaign) -> str:
    """Check the purchase date against the campaign's start/end window.

    A date *outside* the window is a hard rejection — the purchase is provably
    ineligible. An *unreadable* date is not: it is a limit of the scan, not
    evidence of abuse, so it returns a note that routes the receipt to the
    brand's manual review queue instead (and blocks auto-reward).
    """
    if extracted.purchase_date is None:
        return "Purchase date could not be read."

    purchased_at = _aware(extracted.purchased_at)
    if campaign.start_at and purchased_at < campaign.start_at:
        raise ReceiptError("This receipt predates the campaign period.")
    if campaign.end_at and purchased_at > campaign.end_at:
        raise ReceiptError("This receipt is dated after the campaign ended.")
    return ""


def _match_eligible_product(extracted, *, campaign):
    """Find the campaign's eligible product on the receipt.

    Only the claimed campaign's product needs to appear — every other line on
    the receipt is ignored. Returns (product, matched_units, description):
    ``description`` is the exact text of the specific line that satisfied the
    campaign's product, used to build the duplicate-detection identity
    (Apps.receipts.ocr.hash_text) — empty when no eligible product matched.
    A receipt with several campaign-eligible products on it (this brand runs
    more than one campaign) can therefore fund a separate claim per distinct
    product; only the specific (receipt, product) pair repeating is a
    duplicate — see Receipt.product_description_hash.

    Two different "not found" cases, deliberately handled differently:

    * Some line matched a product in this brand's library, but none of them is
      the campaign's product -> the shopper bought the wrong thing. Confident
      rejection.
    * Nothing on the receipt matched anything -> just as likely an alias gap
      (the shop prints "DK CHOC BAR" and no alias exists yet) as a wrong
      receipt. Routed to the brand's manual review queue, which is what the
      existing add-alias-from-review flow is built on. No reward is issued
      either way; a human decides.
    """
    targets = {p.id: p for p in campaign.products.all()}
    matched_units = 0
    eligible = None
    eligible_description = ""
    matched_any = False

    for item in extracted.items:
        product = _match_item(item, brand=campaign.brand)
        if product is None:
            continue
        matched_any = True
        if product.id in targets:
            matched_units += item.quantity
            if eligible is None:
                eligible = targets[product.id]
                eligible_description = item.description

    if eligible is None and matched_any:
        raise ReceiptError(
            "This receipt does not contain the product this offer is for."
        )
    return eligible, matched_units, eligible_description


def _match_item(item, *, brand):
    """Resolve one receipt line to a product.

    Preferred order: SKU/product code first (unambiguous when the provider
    reads one), then the raw description, then the description with the size
    OCR split into quantity/unit restored. The text candidates are exact
    normalized/alias lookups, so no fuzzy false positives are introduced.
    """
    if item.sku:
        product = match_product(brand=brand, sku=item.sku)
        if product is not None:
            return product
    for candidate in (item.description, item.description_with_size):
        if not candidate:
            continue
        product = match_product(brand=brand, text=candidate)
        if product is not None:
            return product
    return None


def _create_line_items(receipt: Receipt, extracted) -> None:
    for item in extracted.items:
        ReceiptLineItem.objects.create(
            receipt=receipt,
            description=item.description[:255],
            normalized=normalize_text(item.description)[:255],
            description_hash=ocr.hash_text(item.description),
            quantity=item.quantity,
            unit_price=item.unit_price,
            matched_product=_match_item(item, brand=receipt.brand),
        )


def _decide(receipt: Receipt, *, matched_units: int, review_note: str) -> None:
    """Auto-verify, or route to the brand's manual review queue."""
    required = getattr(
        receipt.campaign.restriction, "min_units", receipt.campaign.min_purchase_units
    )

    active_claims = Reservation.objects.filter(
        user=receipt.user, status=Reservation.Status.ACTIVE
    ).count()
    velocity = active_claims > settings.MAX_ACTIVE_CLAIMS

    if matched_units >= required and not velocity and not review_note:
        _verify(receipt, reviewer=None, reason="Auto-verified.")
        return

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
    if review_note:
        receipt.decision_reason = review_note
        receipt.save(update_fields=["decision_reason", "updated_at"])
    ManualReviewItem.objects.create(receipt=receipt, brand=receipt.brand)


# ---------------------------------------------------------------------------
# Decision helpers
# ---------------------------------------------------------------------------
def _assert_single_use(receipt: Receipt) -> None:
    """A verified (receipt identity, claimed product) pair may exist exactly
    once, platform-wide.

    Enforced here, at the single choke point every verification path goes
    through (auto-verification *and* brand approval from the review queue),
    so no route to a reward can bypass it:

    * **The receipt must be identifiable.** Without a readable purchase date
      the platform cannot tell this physical receipt apart from any other
      well enough to honour the single-use rule for it — the same posture
      the campaign purchase-window check already takes on this exact field.
      Two unreadable receipts would otherwise each be approvable, paying
      twice for what may well be the same piece of paper. Verification is
      refused instead; the reviewer declines and asks for a clearer photo.
    * **Merchant and product are best-effort, never blocking.** A blank
      merchant never blocks verification (no campaign requires one unless it
      opts in via ``allowed_merchants``, checked earlier in ``upload_receipt``)
      and a receipt whose product was resolved manually from the review
      queue (e.g. an alias gap) has no ``product_description_hash`` to
      compare. Either way there is no complete receipt+product identity to
      protect, so the duplicate check below is skipped rather than blocking
      the reviewer's own decision.
    * **No other VERIFIED receipt may already have this exact identity.**
      The UNIQUE constraint on the four identity hashes means a second row
      normally cannot exist at all, so this is defence in depth: it keeps
      the invariant true even if a row is ever created by another code path.
    """
    if not receipt.purchase_date_hash:
        raise ReceiptError(
            "This receipt could not be read clearly enough to confirm it has "
            "not already been used. Ask the customer to upload a clearer photo."
        )

    if not (receipt.merchant_hash and receipt.purchase_time_hash and receipt.product_description_hash):
        return

    already_used = (
        Receipt.objects.filter(
            merchant_hash=receipt.merchant_hash,
            purchase_date_hash=receipt.purchase_date_hash,
            purchase_time_hash=receipt.purchase_time_hash,
            product_description_hash=receipt.product_description_hash,
            status=Receipt.Status.VERIFIED,
        )
        .exclude(pk=receipt.pk)
        .exists()
    )
    if already_used:
        raise DuplicateReceipt("This receipt has already been used to claim this product.")


def _verify(receipt: Receipt, *, reviewer, reason: str) -> Receipt:
    _assert_single_use(receipt)
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
