"""OCR provider seam + the receipt fingerprint.

Talks to the Receipt Intelligence API (the AI team's FastAPI service) and maps
its response onto the small, stable shape the rest of the app consumes. The
base URL and endpoint path come from settings (``RECEIPT_OCR_API_URL`` /
``RECEIPT_OCR_EXTRACT_PATH``) — never hardcoded here.

The provider's contract (``GET {base}/openapi.json``) is::

    POST {base}/api/v1/receipts/extract      multipart/form-data, field "image"

    200 {
      "success": bool,
      "data": {                              # null when success is false
        "merchant":    {"name": str|null, "address": str|null, ...},
        "transaction": {"transaction_id": str|null,
                        "date": "YYYY-MM-DD"|null,
                        "time": "HH:MM:SS"|null,
                        "datetime": ..., "raw_date": ..., "raw_time": ...},
        "items":       [{"description": str|null, "quantity": str|null,
                         "unit": str|null, "unit_price": str|null,
                         "total_price": str|null, ...}],
        "receipt_number": str|null,
        "total": str|null,
        ...
      },
      "warnings": [...], "errors": [{"code": ..., "message": ...}],
      "processing": {"request_id": str, ...}
    }

``success: true`` means "processed", not "confident" — uncertainty is reported
through ``warnings`` / ``data.confidence``. Only unusable input or an engine
failure produces ``success: false`` (or a 4xx/5xx status).
"""

from __future__ import annotations

import datetime as dt
import hashlib
import logging
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from django.conf import settings

from Apps.common.text import normalize_text

logger = logging.getLogger(__name__)

# Fingerprint scheme version. Bump only if the canonical string changes, so
# old and new hashes can never be confused for one another.
FINGERPRINT_VERSION = "v1"

# Units that mean "package size", not "how many were bought". The provider
# parses "Dark Chocolate Bar 100g" into description="Dark Chocolate Bar",
# quantity="100", unit="G" — taking that 100 as a purchase count would let a
# single item satisfy any min_purchase_units rule.
_MEASUREMENT_UNITS = {
    "g", "kg", "mg", "ml", "l", "cl", "oz", "lb", "fl", "floz", "gal", "gm",
    "gr", "ltr", "cc",
}


class OCRError(Exception):
    """Base class for OCR seam failures."""


class OCRUnavailable(OCRError):
    """The OCR provider is unreachable, timed out, or is not configured.

    Transient / operational: the customer should retry, so the claim must be
    left intact.
    """


class OCRUnreadable(OCRError):
    """The provider processed the image but could not extract a receipt."""


@dataclass
class ExtractedItem:
    description: str
    quantity: int
    unit: str = ""
    unit_price: Decimal | None = None
    # The description with the size the provider split off restored, e.g.
    # "Dark Chocolate Bar" + 100 + "G" -> "Dark Chocolate Bar 100G". Used as an
    # extra exact-match candidate against the product library.
    description_with_size: str = ""


@dataclass
class ExtractedReceipt:
    """The provider's response, reduced to what receipt processing needs."""

    merchant_name: str = ""
    purchase_date: dt.date | None = None
    purchase_time: dt.time | None = None
    receipt_number: str = ""
    total: Decimal | None = None
    items: list[ExtractedItem] = field(default_factory=list)
    provider: str = "receipt-intelligence-api"
    raw: dict = field(default_factory=dict)

    @property
    def purchased_at(self) -> dt.datetime | None:
        """Naive datetime built from the extracted date (+ time when present)."""
        if self.purchase_date is None:
            return None
        return dt.datetime.combine(
            self.purchase_date, self.purchase_time or dt.time.min
        )


# ---------------------------------------------------------------------------
# Provider call
# ---------------------------------------------------------------------------
def _base_url() -> str:
    return (getattr(settings, "RECEIPT_OCR_API_URL", "") or "").strip().rstrip("/")


def is_configured() -> bool:
    return bool(_base_url())


def extract_receipt(image) -> ExtractedReceipt:
    """POST the receipt image to the OCR service and map the response.

    Raises OCRUnavailable (provider down / not configured / bad payload) or
    OCRUnreadable (provider says the image is not a usable receipt).
    """
    base = _base_url()
    if not base:
        raise OCRUnavailable("The receipt OCR service is not configured.")

    try:
        import httpx
    except ImportError as exc:  # pragma: no cover - dependency is installed
        raise OCRUnavailable("The receipt OCR client is unavailable.") from exc

    data = _read_image_bytes(image)
    if not data:
        raise OCRUnreadable("The uploaded receipt image is empty or unreadable.")

    path = getattr(settings, "RECEIPT_OCR_EXTRACT_PATH", "/api/v1/receipts/extract")
    url = f"{base}/{path.lstrip('/')}"
    name = getattr(image, "name", "") or "receipt.jpg"

    headers = {}
    api_key = (getattr(settings, "RECEIPT_OCR_API_KEY", "") or "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        resp = httpx.post(
            url,
            files={"image": (name, data, _content_type(name))},
            headers=headers,
            timeout=getattr(settings, "RECEIPT_OCR_TIMEOUT", 30.0),
        )
    except Exception as exc:  # noqa: BLE001 - network/timeout => unavailable
        logger.warning("Receipt OCR request failed: %s", exc)
        raise OCRUnavailable("The receipt OCR service is unavailable.") from exc

    # The provider documents 400/415/422 for unusable input and 5xx for engine
    # failures. Separate them so the customer gets an actionable message.
    if resp.status_code in (400, 413, 415, 422):
        raise OCRUnreadable(_provider_message(resp) or "The receipt image could not be read.")
    if resp.status_code >= 400:
        logger.warning("Receipt OCR returned HTTP %s", resp.status_code)
        raise OCRUnavailable("The receipt OCR service is unavailable.")

    try:
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001 - malformed JSON
        logger.warning("Receipt OCR returned malformed JSON: %s", exc)
        raise OCRUnavailable("The receipt OCR service returned an invalid response.") from exc

    if not isinstance(payload, dict):
        raise OCRUnavailable("The receipt OCR service returned an invalid response.")

    if not payload.get("success"):
        raise OCRUnreadable(_errors_message(payload) or "The receipt could not be read.")

    receipt_data = payload.get("data")
    if not isinstance(receipt_data, dict):
        raise OCRUnreadable("The receipt could not be read.")

    return map_payload(payload)


def _content_type(name: str) -> str:
    lowered = name.lower()
    if lowered.endswith(".png"):
        return "image/png"
    if lowered.endswith(".webp"):
        return "image/webp"
    if lowered.endswith(".heic"):
        return "image/heic"
    if lowered.endswith(".pdf"):
        return "application/pdf"
    return "image/jpeg"


def _provider_message(resp) -> str:
    try:
        return _errors_message(resp.json())
    except Exception:  # noqa: BLE001
        return ""


def _errors_message(payload) -> str:
    if not isinstance(payload, dict):
        return ""
    errors = payload.get("errors") or []
    for err in errors:
        if isinstance(err, dict) and err.get("message"):
            return str(err["message"])
    detail = payload.get("detail")
    return str(detail) if detail else ""


# ---------------------------------------------------------------------------
# Mapping layer: provider JSON -> ExtractedReceipt
# ---------------------------------------------------------------------------
def map_payload(payload: dict) -> ExtractedReceipt:
    """Map a provider response onto ExtractedReceipt.

    Kept separate from the HTTP call so it can be unit-tested against recorded
    payloads without a live service.
    """
    data = payload.get("data") or {}
    merchant = data.get("merchant") or {}
    transaction = data.get("transaction") or {}

    # Receipt number: the provider exposes it top-level and (usually mirrored)
    # as transaction.transaction_id. Prefer the dedicated field.
    receipt_number = _clean(data.get("receipt_number")) or _clean(
        transaction.get("transaction_id")
    )

    return ExtractedReceipt(
        merchant_name=_clean(merchant.get("name")),
        purchase_date=_parse_date(transaction.get("date"))
        or _parse_date(transaction.get("raw_date")),
        purchase_time=_parse_time(transaction.get("time"))
        or _parse_time(transaction.get("raw_time")),
        receipt_number=receipt_number,
        total=_to_decimal(data.get("total")),
        items=[_map_item(i) for i in (data.get("items") or []) if isinstance(i, dict)],
        raw=payload,
    )


def _map_item(item: dict) -> ExtractedItem:
    description = _clean(item.get("description"))
    unit = _clean(item.get("unit"))
    raw_quantity = _to_decimal(item.get("quantity"))

    # A measurement unit means quantity is a package size, not a count.
    if unit and unit.lower().rstrip(".") in _MEASUREMENT_UNITS:
        quantity = 1
        size_suffix = f"{_trim_number(raw_quantity)}{unit}" if raw_quantity is not None else ""
    elif raw_quantity is not None and raw_quantity > 0:
        quantity = int(raw_quantity)
        size_suffix = ""
    else:
        quantity = 1
        size_suffix = ""

    return ExtractedItem(
        description=description,
        quantity=max(quantity, 1),
        unit=unit,
        unit_price=_to_decimal(item.get("unit_price")),
        description_with_size=(
            f"{description} {size_suffix}".strip() if size_suffix else description
        ),
    )


def _trim_number(value: Decimal) -> str:
    """Render 100 as '100' rather than '100.00' so sizes rebuild cleanly."""
    normalized = value.normalize()
    text = format(normalized, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def _clean(value) -> str:
    return str(value).strip() if value is not None else ""


def _to_decimal(value) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None


def _parse_date(value) -> dt.date | None:
    text = _clean(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return dt.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _parse_time(value) -> dt.time | None:
    text = _clean(value)
    if not text:
        return None
    for fmt in ("%H:%M:%S", "%H:%M", "%I:%M %p", "%I:%M:%S %p"):
        try:
            return dt.datetime.strptime(text.upper(), fmt).time().replace(microsecond=0)
        except ValueError:
            continue
    return None


def _read_image_bytes(image) -> bytes | None:
    try:
        if hasattr(image, "seek"):
            image.seek(0)
        if hasattr(image, "read"):
            data = image.read()
        elif hasattr(image, "chunks"):
            data = b"".join(image.chunks())
        else:
            return None
        if hasattr(image, "seek"):
            image.seek(0)
        return data or None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not read receipt image bytes (%s).", exc)
        return None


# ---------------------------------------------------------------------------
# Receipt fingerprint (the duplicate-detection identity)
# ---------------------------------------------------------------------------
def build_fingerprint(
    *,
    product_name: str,
    shop_name: str,
    purchase_date: dt.date,
    purchase_time: dt.time | None,
    receipt_number: str,
) -> str:
    """SHA-256 over the five components that identify a physical receipt.

    The same physical receipt must hash identically no matter who photographs
    it, so every component is normalized first and nothing photo-specific (image
    bytes, upload time, user) may take part.

    ``product_name`` is the *campaign's* product name as stored in the product
    library — not the raw OCR text. Two photos of one receipt can OCR the same
    line slightly differently ("Dark Chocolate Bar" vs "Dark Chocolate Bar
    100g"); both resolve to the same Product, so anchoring on the library name
    keeps the fingerprint stable.
    """
    canonical = "|".join(
        [
            FINGERPRINT_VERSION,
            normalize_text(product_name),
            normalize_text(shop_name),
            purchase_date.isoformat(),
            (purchase_time or dt.time.min).replace(microsecond=0).isoformat(),
            normalize_text(receipt_number),
        ]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
