"""Receipt retention (Master Customer Profile: Redemption History).

The full receipt is available for 30 days. After that only the matching
line item and the necessary receipt details remain: the photo is deleted and
brands see the matching line. Receipts still waiting for a decision are kept.
"""

import datetime as dt
import logging

from django.utils import timezone

logger = logging.getLogger(__name__)
RETENTION_DAYS = 30


def full_receipt_until(receipt):
    return receipt.created_at + dt.timedelta(days=RETENTION_DAYS)


def full_receipt_available(receipt, now=None) -> bool:
    now = now or timezone.now()
    return bool(receipt.image) and receipt.image_purged_at is None and now < full_receipt_until(receipt)


def purge_expired_images(now=None) -> int:
    from Apps.receipts.models import Receipt

    now = now or timezone.now()
    due = (
        Receipt.objects.filter(created_at__lt=now - dt.timedelta(days=RETENTION_DAYS), image_purged_at__isnull=True)
        .exclude(status=Receipt.Status.PENDING)
        .exclude(image="")
        .exclude(image__isnull=True)
    )
    count = 0
    for receipt in due.iterator():
        try:
            receipt.image.delete(save=False)
        except Exception as exc:  # storage hiccup: retry on the next run
            logger.warning("Could not delete receipt image %s: %s", receipt.id, exc)
            continue
        receipt.image = None
        receipt.image_purged_at = now
        receipt.save(update_fields=["image", "image_purged_at", "updated_at"])
        count += 1
    return count
