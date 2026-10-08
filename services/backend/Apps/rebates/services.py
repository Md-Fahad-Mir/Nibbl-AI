"""Reward issuance: the atomic money move that closes the rebate loop."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from Apps.billing import services as billing_services
from Apps.common.exceptions import DomainError
from Apps.common.money import ZERO
from Apps.rebates.models import Redemption, RewardIssuance
from Apps.reservations import services as reservation_services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry


class RedemptionError(DomainError):
    """Expected, user-facing redemption errors (mapped to HTTP 400)."""


@transaction.atomic
def issue_reward(receipt) -> Redemption | None:
    """Issue the reward for a verified receipt. Idempotent per reservation.

    Money movement:
      * capture the reservation hold → debit the brand the reward,
      * credit the customer the reward,
      * debit the brand the processing fee (platform revenue).
    """
    reservation = receipt.reservation

    # No double issue.
    existing = Redemption.objects.filter(reservation=reservation).first()
    if existing is not None:
        return existing

    if reservation.status != Reservation.Status.ACTIVE:
        raise RedemptionError("This claim is no longer active.")
    if reservation.hold_id is None or reservation.hold.status != Hold.Status.ACTIVE:
        raise RedemptionError("The reservation's escrow hold is unavailable.")

    campaign = reservation.campaign
    brand = campaign.brand
    reward = reservation.reward_amount

    plan = brand.plan
    fee = billing_services.rebate_processing_fee(plan, reward) if plan else ZERO

    brand_wallet = wallet_services.get_or_create_brand_wallet(brand)
    customer_wallet = wallet_services.get_or_create_customer_wallet(receipt.user)

    # 1) Capture the hold → brand pays the reward.
    brand_reward_entry = wallet_services.capture_hold(
        hold=reservation.hold,
        category=LedgerEntry.Category.REBATE_REWARD,
        description=f"Rebate reward — {campaign.name}",
        idempotency_key=f"redeem-reward:{reservation.id}",
    )

    # 2) Credit the customer the reward.
    customer_entry = wallet_services.credit(
        wallet=customer_wallet,
        amount=reward,
        category=LedgerEntry.Category.REBATE_REWARD,
        reference_type="redemption",
        reference_id=reservation.id,
        description=f"Rebate reward — {campaign.name}",
        idempotency_key=f"redeem-customer:{reservation.id}",
    )

    # 3) Debit the brand the processing fee (platform revenue).
    fee_entry = None
    if fee > ZERO:
        # Processing fee is an eligible charge: spend promotional credit first.
        fee_entries = wallet_services.charge_eligible(
            wallet=brand_wallet,
            amount=fee,
            category=LedgerEntry.Category.REBATE_FEE,
            reference_type="redemption",
            reference_id=reservation.id,
            description="Rebate processing fee",
            idempotency_key=f"redeem-fee:{reservation.id}",
        )
        # Link the real-funds entry (or the promo one if fully promo-covered).
        fee_entry = fee_entries[-1] if fee_entries else None

    reservation_services.mark_redeemed(reservation)

    redemption = Redemption.objects.create(
        reservation=reservation,
        receipt=receipt,
        user=receipt.user,
        brand=brand,
        campaign=campaign,
        reward_amount=reward,
        fee_amount=fee,
        status=Redemption.Status.ISSUED,
        issued_at=timezone.now(),
    )
    RewardIssuance.objects.create(
        redemption=redemption,
        brand_reward_entry=brand_reward_entry,
        customer_credit_entry=customer_entry,
        brand_fee_entry=fee_entry,
        hold=reservation.hold,
        reward_amount=reward,
        fee_amount=fee,
    )
    return redemption


def void_reservation_on_rejection(receipt) -> None:
    """Release the escrow hold for a rejected receipt's reservation."""
    reservation = receipt.reservation
    if reservation.status == Reservation.Status.ACTIVE:
        reservation_services.mark_rejected(reservation)
