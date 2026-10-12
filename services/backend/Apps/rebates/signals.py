"""Connect receipt lifecycle signals to reward issuance."""

from django.dispatch import receiver

from Apps.receipts.signals import receipt_rejected, receipt_verified


@receiver(receipt_verified)
def on_receipt_verified(sender, receipt, **kwargs):
    from Apps.notifications import events
    from Apps.rebates.services import issue_reward

    redemption = issue_reward(receipt)
    events.receipt_approved(receipt, getattr(redemption, "reward_amount", None))


@receiver(receipt_rejected)
def on_receipt_rejected(sender, receipt, **kwargs):
    from Apps.rebates.services import void_reservation_on_rejection

    from Apps.notifications import events

    void_reservation_on_rejection(receipt)
    events.receipt_rejected(receipt.reservation, reason=receipt.decision_reason or "it didn't meet the campaign "
                            "requirements.", final=True, reference_id=receipt.id)
