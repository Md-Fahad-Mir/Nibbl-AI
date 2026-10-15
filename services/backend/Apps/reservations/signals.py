"""Release a claim's escrow hold when the claim itself is deleted."""

from django.db.models.signals import post_delete
from django.dispatch import receiver

from Apps.reservations.models import Reservation


@receiver(post_delete, sender=Reservation)
def release_hold_on_delete(sender, instance, **kwargs):
    # The hold FK is SET_NULL from this side, so without this a deleted claim
    # leaves its hold ACTIVE and the money stuck in Reserved forever.
    if instance.hold_id:
        from Apps.wallets import services as wallet_services

        wallet_services.release_hold(hold=instance.hold)
