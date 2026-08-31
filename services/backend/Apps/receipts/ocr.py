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
import json
import logging
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation

from django.conf import settings

from Apps.common.text import normalize_text

logger = logging.getLogger(__name__)

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
    # Product code as printed/scanned, when the provider reads one. Checked
    # before any text matching — see products.selectors.match_product.
    sku: str = ""
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
        # The provider's own auth contract (confirmed against the deployed
        # service): a shared secret in `X-API-Key`, not a Bearer token.
        headers["X-API-Key"] = api_key

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
        sku=_clean(item.get("sku")),
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
# The fingerprint hashes the COMPLETE normalized receipt data the provider
# extracted (merchant, transaction, every item, totals, payment, ...) rather
# than a handful of anchor fields. Two uploads of the same physical receipt
# must canonicalize to the same structure regardless of: JSON key order,
# incidental whitespace, currency symbols / trailing zeros on money values, or
# the order OCR happened to read line items in.
#
# Deliberately excluded, wherever they occur in the payload:
#   * pipeline/processing metadata: request_id, processing_time_ms, the
#     success/warnings/errors/processing envelope itself (never printed on
#     the receipt; changes on every reprocessing run of the same image);
#   * the OCR engine's own judgments about the extraction: confidence,
#     validation, review (can shift slightly between runs of the exact same
#     image without anything on the receipt changing);
#   * schema_version / document_type (describe the response format, not
#     receipt content) and line_index (OCR's row bookkeeping, not something
#     printed on the paper).
#
# A different full fingerprint does NOT prove two receipts are genuinely
# different — an OCR misread on any included field (one digit of a total, one
# character of an item description) changes the hash even though the physical
# receipt is identical. This is an accepted, documented trade-off of hashing
# the complete dataset instead of a small set of anchor fields (some of which,
# e.g. receipt_number, are not present on every receipt). The existing
# shop / purchase-window / product-match checks in Apps.receipts.services are
# the complementary safety net for that case — this module does not add a
# second, fuzzy/similarity-based duplicate check on top of the exact hash.
FINGERPRINT_VERSION = "v2"

# Keys excluded from the canonical structure at any nesting depth — pipeline
# judgments and bookkeeping, not receipt content (see block comment above).
_EXCLUDED_KEYS = {
    "confidence", "validation", "review", "schema_version", "document_type",
    "line_index",
}

# Keys whose value is an identifier/code: normalized as text (case/whitespace
# only), never parsed as a number. Preserves leading zeros and exact digit
# sequences that give these fields their identity (e.g. card_last_4="0042",
# store_id="007") — a generic "looks numeric -> normalize as money" rule
# would otherwise collapse "007" and "7" into the same value.
_TEXT_ONLY_KEYS = {
    "transaction_id", "receipt_number", "sku", "store_id", "register_id",
    "card_last_4", "card_last4", "authorization_code", "phone", "cashier",
}

_DATE_KEYS = {"date"}
_TIME_KEYS = {"time"}
_DATETIME_KEYS = {"datetime"}

_DECIMAL_SHAPE = re.compile(r"^[+-]?\d+(\.\d+)?$")


def _as_decimal_text(text: str) -> Decimal | None:
    """Parse a money/quantity-looking string, else None.

    Strips a leading currency symbol and/or trailing percent sign and
    thousands separators first, so "$65.77", "65.77%" and "65,077.00" are all
    candidates. A strict shape check (rather than trusting ``Decimal()``
    directly) keeps oddities like "NaN", "Infinity" or exponent notation from
    being treated as numbers — anything that isn't a plain decimal falls
    through to text normalization instead.
    """
    stripped = text.strip().rstrip("%").strip()
    for symbol in ("$", "€", "£", "¥"):
        if stripped.startswith(symbol):
            stripped = stripped[len(symbol):].strip()
            break
    stripped = stripped.replace(",", "")
    if not stripped or not _DECIMAL_SHAPE.match(stripped):
        return None
    try:
        return Decimal(stripped)
    except InvalidOperation:
        return None


def _format_decimal(value: Decimal) -> str:
    """Render a Decimal without scientific notation, trailing zeros trimmed.

    "65.77", "$65.77" and "65.770" must all render identically; "100" must
    render as "100" — not "1E+2" (what ``Decimal.normalize()`` alone would
    produce for a round number) or "100.00".
    """
    text = format(value.normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text or "0"


def _normalize_scalar(key: str, value):
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float, Decimal)):
        return _format_decimal(Decimal(str(value)))
    if not isinstance(value, str):
        return None  # unexpected shape; never let it silently reach json.dumps

    text = value.strip()
    if not text:
        return None

    if key in _DATE_KEYS:
        parsed = _parse_date(text)
        return parsed.isoformat() if parsed else normalize_text(text)
    if key in _TIME_KEYS:
        parsed = _parse_time(text)
        return parsed.isoformat() if parsed else normalize_text(text)
    if key in _DATETIME_KEYS:
        date_part, _, time_part = text.partition("T")
        parsed_date = _parse_date(date_part)
        parsed_time = _parse_time(time_part) if time_part else None
        if parsed_date:
            return f"{parsed_date.isoformat()}T{(parsed_time or dt.time.min).isoformat()}"
        return normalize_text(text)
    if key in _TEXT_ONLY_KEYS:
        return normalize_text(text)

    numeric = _as_decimal_text(text)
    if numeric is not None:
        return _format_decimal(numeric)
    return normalize_text(text)


def _canonicalize(value, key: str = ""):
    """Recursively normalize provider data into a deterministic structure.

    * dict: excluded keys dropped; remaining values normalized (key order is
      handled at serialization time via ``json.dumps(sort_keys=True)``).
    * list: each element normalized, empty/null elements dropped, then sorted
      by its own canonical JSON — so OCR line-order jitter between two scans
      of the same physical receipt can't change the fingerprint.
    * scalar: see ``_normalize_scalar``.

    A branch that normalizes to nothing (empty dict/list, blank/null scalar)
    is dropped rather than kept as ``{}`` / ``[]`` / ``null``, so "field
    absent" and "field present but empty" always canonicalize identically.
    """
    if isinstance(value, dict):
        result = {}
        for k, v in value.items():
            if k in _EXCLUDED_KEYS:
                continue
            normalized = _canonicalize(v, key=k)
            if normalized is not None:
                result[k] = normalized
        return result or None

    if isinstance(value, list):
        items = [_canonicalize(v) for v in value]
        items = [i for i in items if i is not None]
        if not items:
            return None
        items.sort(key=lambda i: json.dumps(i, sort_keys=True, default=str))
        return items

    return _normalize_scalar(key, value)


def _receipt_content(raw: dict) -> dict:
    """The structured receipt fields inside a stored OCR ``.raw`` payload.

    ``.raw`` holds the full provider envelope for a live OCR call (``data``
    plus the ``success``/``warnings``/``errors``/``processing`` wrapper) or a
    small ``{"provider": ..., "items": [...]}`` shape for a legacy
    client-supplied submission (no image; see ``services._from_legacy``).
    Either way, only the actual receipt content should reach the fingerprint.
    """
    if isinstance(raw, dict) and isinstance(raw.get("data"), dict):
        return raw["data"]
    if isinstance(raw, dict):
        return {k: v for k, v in raw.items() if k != "provider"}
    return {}


def canonicalize_receipt_data(raw: dict) -> dict:
    """Deterministic, order-independent structure built from a ``.raw`` OCR
    payload. Safe to ``json.dumps(..., sort_keys=True)`` for hashing, and
    useful on its own for audit/debugging — stored on ``OCRResult``."""
    return _canonicalize(_receipt_content(raw)) or {}


def hash_canonical_data(canonical: dict) -> str | None:
    """SHA-256 over an already-canonicalized receipt structure.

    Returns None when nothing usable was extracted at all (a blank/empty OCR
    result) — that receipt gets no duplicate protection rather than colliding
    with every other unreadable receipt, the same posture as before.
    """
    if not canonical:
        return None
    canonical_json = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    payload = f"{FINGERPRINT_VERSION}|{canonical_json}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def build_full_fingerprint(raw: dict) -> str | None:
    """Convenience wrapper: canonicalize + hash a ``.raw`` OCR payload directly."""
    return hash_canonical_data(canonicalize_receipt_data(raw))


def extract_confidence(raw: dict) -> float | None:
    """The provider's own extraction-confidence score (``data.confidence.overall``),
    when present. Captured for audit/support visibility; not currently wired
    into any accept/reject decision (see FraudFlag/ManualReviewItem for those
    rules) — see the module-level fingerprint comment for why this project
    does not use it as a second duplicate-detection signal.
    """
    data = raw.get("data") if isinstance(raw, dict) else None
    if not isinstance(data, dict):
        return None
    confidence = data.get("confidence")
    if not isinstance(confidence, dict):
        return None
    overall = confidence.get("overall")
    return float(overall) if isinstance(overall, (int, float)) else None
