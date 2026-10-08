"""Nibbl campaign approval workflow (Master: Submission and revision rules,
Admin → Campaign Approvals).

* A new campaign is submitted once complete; it can't be activated until
  Nibbl approves it. Nibbl may approve, reject, or request changes (the brand
  edits and resubmits).
* Edits to an approved campaign become a pending REVISION: the approved
  version stays live and the changes apply only once approved. Claims
  already made keep their snapshotted terms either way.
"""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from Apps.campaigns import services
from Apps.campaigns.models import Campaign, CampaignReview
from Apps.campaigns.services import CampaignError
from Apps.common.models import AuditLog

RS = Campaign.ReviewStatus


class _DryRun(Exception):
    """Rolls back a revision validation."""


# ---------------------------------------------------------------------------
# Brand side
# ---------------------------------------------------------------------------
@transaction.atomic
def submit_for_review(campaign: Campaign, *, user=None) -> CampaignReview:
    if campaign.review_status not in (RS.NOT_SUBMITTED, RS.CHANGES_REQUESTED):
        raise CampaignError("This campaign has already been submitted.")
    if campaign.status in (Campaign.Status.COMPLETED, Campaign.Status.ARCHIVED):
        raise CampaignError("This campaign can no longer be submitted.")
    # Every required field must be complete before submission.
    services.validate_ready(campaign)

    now = timezone.now()
    review = campaign.reviews.filter(
        kind=CampaignReview.Kind.NEW, status=CampaignReview.Status.CHANGES_REQUESTED
    ).first()
    if review is not None:  # resubmission after changes were requested
        review.status = CampaignReview.Status.PENDING
        review.submitted_by = user
        review.submitted_at = now
        review.save(update_fields=["status", "submitted_by", "submitted_at", "updated_at"])
    else:
        review = CampaignReview.objects.create(
            campaign=campaign, kind=CampaignReview.Kind.NEW,
            submitted_by=user, submitted_at=now,
        )
    campaign.review_status = RS.PENDING_REVIEW
    campaign.save(update_fields=["review_status", "updated_at"])
    services.ensure_access(campaign)  # URL + QR exist from submission on
    return review


def _json_safe(value):
    if isinstance(value, (Decimal, uuid.UUID)):
        return str(value)
    if isinstance(value, (dt.datetime, dt.date)):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value


def _json_safe_dict(fields: dict) -> dict:
    return {key: _json_safe(value) for key, value in fields.items()}


def _from_json(changes: dict) -> dict:
    """Stored revision values → model values."""
    fields = {}
    for key, value in changes.items():
        if key == "product" or value is None:
            fields[key] = value
        else:
            fields[key] = Campaign._meta.get_field(key).to_python(value)
    return fields


def _validate_revision(campaign: Campaign, changes: dict) -> None:
    """Apply the changes to a throwaway copy and roll back — surfaces the
    same validation errors a direct edit would."""
    try:
        with transaction.atomic():
            candidate = Campaign.objects.get(pk=campaign.pk)
            services.apply_update(candidate, **_from_json(changes))
            raise _DryRun
    except _DryRun:
        pass


def _actual_changes(campaign: Campaign, fields: dict) -> dict:
    """Drop values equal to the live campaign — builders resend the whole
    form, and an unchanged field shouldn't trigger a re-review."""
    changed = {}
    for key, value in fields.items():
        if key == "product":
            current = {str(pid) for pid in campaign.products.values_list("id", flat=True)}
            if {str(pid) for pid in value or []} != current:
                changed[key] = value
            continue
        current = getattr(campaign, key)
        proposed = Campaign._meta.get_field(key).to_python(value) if value is not None else None
        if isinstance(current, str) and proposed is None:
            proposed = ""
        if proposed != current:
            changed[key] = value
    return changed


@transaction.atomic
def propose_revision(campaign: Campaign, fields: dict, *, user=None) -> CampaignReview | None:
    """Edits to an approved campaign wait for Nibbl review; the approved
    version stays live. Further edits merge into the open revision (and
    resubmit it if Nibbl had requested changes)."""
    if campaign.status in (Campaign.Status.COMPLETED, Campaign.Status.ARCHIVED):
        raise CampaignError("This campaign can no longer be edited.")
    fields = _actual_changes(campaign, fields)
    review = campaign.reviews.filter(
        kind=CampaignReview.Kind.REVISION, status__in=CampaignReview.OPEN
    ).first()
    if not fields:
        return review  # nothing changed
    changes = {**(review.changes if review else {}), **_json_safe_dict(fields)}
    _validate_revision(campaign, changes)

    now = timezone.now()
    if review is None:
        return CampaignReview.objects.create(
            campaign=campaign, kind=CampaignReview.Kind.REVISION,
            changes=changes, submitted_by=user, submitted_at=now,
        )
    review.changes = changes
    review.status = CampaignReview.Status.PENDING
    review.submitted_by = user
    review.submitted_at = now
    review.save(update_fields=["changes", "status", "submitted_by", "submitted_at", "updated_at"])
    return review



# ---------------------------------------------------------------------------
# Nibbl (admin) side
# ---------------------------------------------------------------------------
def pending_reviews(kind: str = ""):
    qs = CampaignReview.objects.filter(status=CampaignReview.Status.PENDING).select_related(
        "campaign", "campaign__brand", "submitted_by"
    ).prefetch_related("campaign__products")
    if kind:
        qs = qs.filter(kind=kind)
    return qs.order_by("submitted_at")


def _close(review: CampaignReview, status, *, admin, comment="") -> None:
    review.status = status
    review.reviewed_by = admin
    review.reviewed_at = timezone.now()
    review.comment = comment
    review.save(update_fields=["status", "reviewed_by", "reviewed_at", "comment", "updated_at"])


def _audit(review: CampaignReview, action, *, admin, note="") -> None:
    AuditLog.objects.create(
        action=action, actor_type="admin", actor_id=str(admin.id),
        target_type="campaign", target_id=str(review.campaign_id),
        metadata={"review_id": str(review.id), "kind": review.kind,
                  "decision": review.status, "note": note},
    )


def _notify_brand(review: CampaignReview, message: str) -> None:
    from Apps.brands.models import BrandMembership
    from Apps.notifications import services as notification_services
    from Apps.notifications.models import NotificationType

    managers = BrandMembership.objects.filter(
        brand=review.campaign.brand,
        role__in=(BrandMembership.Role.OWNER, BrandMembership.Role.ADMIN),
    ).select_related("user")
    for membership in managers:
        notification_services.notify(
            user=membership.user,
            notification_type=NotificationType.CAMPAIGN_REVIEW,
            context={"campaign": review.campaign.name, "decision": review.status,
                     "comment": review.comment, "message": message},
            reference_type="campaign", reference_id=review.campaign_id,
        )


def _require_pending(review: CampaignReview) -> None:
    if review.status != CampaignReview.Status.PENDING:
        raise CampaignError("This review has already been decided.")


@transaction.atomic
def approve(review: CampaignReview, *, admin, comment="") -> str:
    """Approve; returns a short note for the admin. A new campaign goes live
    right away when it can (funded, within plan limits); otherwise it stays
    approved and the brand activates it later."""
    _require_pending(review)
    campaign = Campaign.objects.select_for_update().get(pk=review.campaign_id)
    _close(review, CampaignReview.Status.APPROVED, admin=admin, comment=comment)

    if review.kind == CampaignReview.Kind.REVISION:
        # The revised version replaces the previous one everywhere; existing
        # claims keep their snapshot.
        services.apply_update(campaign, **_from_json(review.changes))
        note = "Revision approved and applied."
    else:
        campaign.review_status = RS.APPROVED
        campaign.save(update_fields=["review_status", "updated_at"])
        note = "Approved."
        if campaign.status == Campaign.Status.DRAFT:
            try:
                with transaction.atomic():
                    services.activate_campaign(campaign)
                note = "Approved and now live."
            except CampaignError as exc:
                note = f"Approved. Not live yet: {exc}"
    _audit(review, AuditLog.Action.APPROVE, admin=admin, note=note)
    _notify_brand(review, note)
    return note


@transaction.atomic
def reject(review: CampaignReview, *, admin, comment) -> None:
    """Reject. A rejected new campaign can't be resubmitted; a rejected
    revision is discarded and the approved version stays live."""
    _require_pending(review)
    if not (comment or "").strip():
        raise CampaignError("Add a comment for the brand explaining the rejection.")
    _close(review, CampaignReview.Status.REJECTED, admin=admin, comment=comment)
    if review.kind == CampaignReview.Kind.NEW:
        Campaign.objects.filter(pk=review.campaign_id).update(review_status=RS.REJECTED)
    _audit(review, AuditLog.Action.REJECT, admin=admin, note=comment)
    _notify_brand(review, "Rejected.")


@transaction.atomic
def request_changes(review: CampaignReview, *, admin, comment) -> None:
    """Send back to the brand with comments. A new campaign is edited and
    resubmitted; a revision is resubmitted by editing again."""
    _require_pending(review)
    if not (comment or "").strip():
        raise CampaignError("Add a comment telling the brand what to change.")
    _close(review, CampaignReview.Status.CHANGES_REQUESTED, admin=admin, comment=comment)
    if review.kind == CampaignReview.Kind.NEW:
        Campaign.objects.filter(pk=review.campaign_id).update(
            review_status=RS.CHANGES_REQUESTED
        )
    _audit(review, AuditLog.Action.UPDATE, admin=admin, note=comment)
    _notify_brand(review, "Changes requested.")
