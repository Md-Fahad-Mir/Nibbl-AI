"""Meta Pixel tracking (Master: Settings §4 Tracking & Attribution; Rebate
campaign "Meta Pixel Tracking").

* The brand saves one Meta Pixel ID in Settings. Only a well-formed ID is
  accepted (15–16 digits) — never a script or custom tracking code.
  Validation is a format check: confirming the pixel exists with Meta needs a
  Meta access token, which isn't part of the launch scope.
* The brand turns tracking on or off per campaign. The shopper website fires
  Campaign View, Claim and Approved Redemption to that pixel in the browser.
"""

from __future__ import annotations

import re

from django.utils import timezone

from Apps.common.models import AuditLog

PIXEL_ID = re.compile(r"^\d{15,16}$")


class TrackingError(Exception):
    """Expected, user-facing errors (HTTP 400)."""


def active_pixel_id(brand) -> str | None:
    return brand.meta_pixel_id if brand.meta_pixel_id and brand.meta_pixel_validated_at else None


def campaign_pixel_id(campaign) -> str | None:
    """The pixel to fire for this campaign, or None (tracking off)."""
    return active_pixel_id(campaign.brand) if campaign.meta_pixel_enabled else None


def _audit(brand, actor, **meta) -> None:
    AuditLog.objects.create(
        action=AuditLog.Action.UPDATE, actor_type="brand_user", actor_id=str(actor.id) if actor else "",
        target_type="brand", target_id=str(brand.id), metadata=meta,
    )


def set_pixel(brand, *, pixel_id: str, actor=None):
    """Save and validate the brand's Meta Pixel ID ("" removes it)."""
    pixel_id = re.sub(r"\s+", "", pixel_id or "")
    if pixel_id and not PIXEL_ID.match(pixel_id):
        raise TrackingError("Enter your Meta Pixel ID — the 15 or 16 digit number from Meta Events Manager.")
    brand.meta_pixel_id = pixel_id
    brand.meta_pixel_validated_at = timezone.now() if pixel_id else None
    brand.save(update_fields=["meta_pixel_id", "meta_pixel_validated_at", "updated_at"])
    if not pixel_id:
        brand.campaigns.filter(meta_pixel_enabled=True).update(meta_pixel_enabled=False)
    _audit(brand, actor, event="meta_pixel_set" if pixel_id else "meta_pixel_removed")
    return brand


def set_campaign_tracking(campaign, *, enabled: bool, actor=None):
    if enabled and not active_pixel_id(campaign.brand):
        raise TrackingError("Add and validate your Meta Pixel ID in Settings first.")
    campaign.meta_pixel_enabled = bool(enabled)
    campaign.save(update_fields=["meta_pixel_enabled", "updated_at"])
    _audit(campaign.brand, actor, event="campaign_tracking", campaign=str(campaign.id), enabled=bool(enabled))
    return campaign


def overview(brand) -> dict:
    return {
        "meta_pixel_id": brand.meta_pixel_id,
        "meta_pixel_validated": bool(active_pixel_id(brand)),
        "meta_pixel_validated_at": brand.meta_pixel_validated_at,
        "events": ["Campaign View", "Claim", "Approved Redemption"],
        "coming_soon": ["Google Tag", "TikTok Pixel"],
    }
