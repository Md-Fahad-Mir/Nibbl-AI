"""Shared test helpers.

Receipt processing needs the five identifying components of a physical receipt
(product, shop, date, time, receipt number). Tests that exercise *downstream*
behaviour — reward issuance, review opportunities, analytics — don't care about
those values, only that they are present and consistent, so they reuse the
fixture below rather than restating it.

Shop is intentionally left unset: a blank merchant means "OCR read no shop
name", which skips the shop check instead of failing it.
"""

import datetime as dt

from django.utils import timezone

# A fixed instant inside any campaign window used by the suite.
RECEIPT_PURCHASED_AT = timezone.make_aware(
    dt.datetime(2026, 1, 15, 14, 30), timezone.get_current_timezone()
)

# Identity fields for a single, consistent physical receipt. Two calls sharing
# this fixture describe the *same* receipt and so are duplicates by design —
# which is exactly what the duplicate-detection tests rely on.
RECEIPT_META = {
    "purchased_at": RECEIPT_PURCHASED_AT,
    "receipt_number": "INV-TEST-0001",
}


def receipt_meta(number: str = "INV-TEST-0001", **overrides) -> dict:
    """RECEIPT_META with a distinct receipt number (a *different* receipt)."""
    return {**RECEIPT_META, "receipt_number": number, **overrides}
