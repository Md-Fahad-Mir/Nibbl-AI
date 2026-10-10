"""Referral progress hooks: a referred shopper's claim, approved redemption,
payout method or paid withdrawal re-checks their referral (Master: Refer a
Friend qualification steps)."""

from django.db.models.signals import post_save
from django.dispatch import receiver


def _maybe_refresh(user_id) -> None:
    from Apps.accounts.models import Referral
    from Apps.accounts.referrals import refresh_later

    if user_id and Referral.objects.filter(referred_id=user_id, status=Referral.Status.IN_PROGRESS).exists():
        refresh_later(user_id)


@receiver(post_save, sender="reservations.Reservation")
@receiver(post_save, sender="rebates.Redemption")
@receiver(post_save, sender="payouts.PayoutMethod")
@receiver(post_save, sender="payouts.WithdrawalRequest")
def referral_progress(sender, instance, **kwargs):
    _maybe_refresh(getattr(instance, "user_id", None))
