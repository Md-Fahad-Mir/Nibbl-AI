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

# One instant for the whole test run, inside any campaign window used by the
# suite. It's "now" (to the minute) because a receipt must be dated on or after
# the claim it's submitted for (Master Receipt Validation), and tests create
# their claims at run time.
RECEIPT_PURCHASED_AT = timezone.now().replace(second=0, microsecond=0)

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


def go_live(campaign):
    """Mark a campaign Nibbl-approved and activate it — for tests whose
    subject is downstream of the approval workflow."""
    from Apps.campaigns import services as campaign_services
    from Apps.campaigns.models import Campaign

    Campaign.objects.filter(pk=campaign.pk).update(
        review_status=Campaign.ReviewStatus.APPROVED
    )
    campaign.review_status = Campaign.ReviewStatus.APPROVED
    return campaign_services.activate_campaign(campaign)
