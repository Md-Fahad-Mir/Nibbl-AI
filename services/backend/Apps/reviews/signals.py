"""Create review opportunities when a rebate receipt is verified (Master:
only an already-verified rebate receipt can trigger an opportunity)."""

import logging

from django.db import transaction
from django.dispatch import receiver

from Apps.receipts.signals import receipt_verified

logger = logging.getLogger(__name__)


@receiver(receipt_verified)
def on_receipt_verified(sender, receipt, **kwargs):
    from Apps.reviews.campaigns import create_opportunities

    # A problem here must never undo the shopper's rebate reward.
    try:
        with transaction.atomic():
            create_opportunities(receipt)
    except Exception:  # noqa: BLE001
        logger.exception("Could not create review opportunities for receipt %s", receipt.id)
