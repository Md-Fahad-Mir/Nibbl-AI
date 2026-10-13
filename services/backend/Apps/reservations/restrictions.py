"""Master "Rebate Restriction Pop-ups" (RB-33): the shopper-facing title and
message for each refusal code, plus the values some pop-ups show. Added to
claim refusals next to the existing ``detail`` / ``code``."""

from __future__ import annotations

from django.utils import timezone


def _when(value) -> str:
    local = timezone.localtime(value)
    hour = local.strftime("%I:%M %p").lstrip("0")
    return f"{local:%b} {local.day} at {hour}"


def popup(code: str, *, campaign=None, user=None, slot_limit: int | None = None) -> dict:
    """{title, message, …extra} for a restriction ``code``."""
    brand = campaign.brand.name if campaign is not None else "the brand"
    if code == "consent_required":
        return {"title": "Consent required",
                "message": f"You must provide email and phone and accept both Nibbl and {brand} email/SMS consent "
                           "to reserve this offer."}
    if code == "slots_full":
        n = slot_limit or 5
        return {"title": f"All {n} claim slots are in use", "slot_limit": n,
                "message": "Submit a receipt for an active offer or wait for a claim to close before reserving another."}
    if code == "already_claimed":
        return {"title": "You already claimed this campaign", "message": "This campaign is already in My Offers.",
                "note": "This affects only this campaign, not other campaigns from the brand."}
    if code == "cooldown":
        days = None
        if campaign is not None and user is not None:
            from Apps.offers.models import CooldownRecord

            record = (CooldownRecord.objects.filter(user=user, campaign=campaign, expires_at__gt=timezone.now())
                      .order_by("-expires_at").first())
            if record is not None:
                days = max(1, (record.expires_at - timezone.now()).days + 1)
        return {"title": "Please wait before claiming again", "days_remaining": days,
                "message": f"You can claim this campaign again in {days} days." if days else
                           "You can claim this campaign again soon.",
                "note": "The cooldown begins after approved redemption and is campaign-specific."}
    if code == "one_time_redeemed":
        return {"title": "You've already redeemed this campaign",
                "message": "This is a one-time campaign and has already been redeemed."}
    if code == "not_started":
        starts = campaign.start_at if campaign is not None else None
        return {"title": "This campaign has not started", "starts_at": starts,
                "message": f"This campaign becomes available on {_when(starts)}." if starts else
                           "This campaign isn't available yet."}
    if code == "paused_or_ended":
        return {"title": "This campaign is paused or ended", "message": "This campaign is not currently available."}
    if code == "capacity_reached":
        return {"title": "Today's rebates have been claimed",
                "message": "This campaign has reached its current claim limit. Explore other offers you may qualify for."}
    if code == "retailer_required":
        return {"title": "Receipt from an eligible retailer required",
                "message": "This campaign requires a receipt from one of the participating retailers."}
    return {"title": "Offer no longer available",
            "message": "This campaign has ended or its available campaign funds have been used."}
