"""Reward issuance: the atomic money move that closes the rebate loop."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from Apps.billing import services as billing_services
from Apps.common.exceptions import DomainError
from Apps.common.money import ZERO
from Apps.rebates import reward_math
from Apps.rebates.models import Redemption, RewardIssuance
from Apps.reservations import services as reservation_services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry


class RedemptionError(DomainError):
    """Expected, user-facing redemption errors (mapped to HTTP 400)."""


# ---------------------------------------------------------------------------
# Locked reward math applied to a receipt (deal-model claims)
# ---------------------------------------------------------------------------
def eligible_unit_prices(receipt, reservation) -> list:
    """Unit prices of the claim's eligible products on the receipt — a line
    with quantity 2 contributes two units; None = price not confirmed."""
    eligible = {str(pid) for pid in reservation.eligible_product_ids}
    prices = []
    for item in receipt.line_items.all():
        if item.matched_product_id and str(item.matched_product_id) in eligible:
            prices.extend([item.unit_price] * max(item.quantity, 1))
    return prices


def decide_reward(receipt, reservation) -> reward_math.RewardDecision | None:
    """Decision under the terms snapshotted on the claim; None for claims made
    before the deal model (they keep their fixed reward)."""
    if not reservation.deal_type:
        return None
    return reward_math.decide(
        deal_type=reservation.deal_type,
        unit_prices=eligible_unit_prices(receipt, reservation),
        max_rebate=reservation.max_rebate,
        fixed_reward=reservation.fixed_reward,
        required_quantity=reservation.required_quantity or 1,
    )


def payout_amount(receipt, reservation):
    """What to pay for an approved receipt: the calculated reward (never more
    than was reserved). A legacy claim, or one a reviewer approved although
    the price/quantity couldn't be read, pays the reserved amount — until
    reviewers can pick the qualifying lines themselves (Master #21)."""
    decision = decide_reward(receipt, reservation)
    if decision is not None and decision.qualifies:
        return min(decision.amount, reservation.reward_amount)
    return reservation.reward_amount


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
    # Pay the actual reward; capturing less than the hold returns the unused
    # difference to the brand's available funds.
    reward = payout_amount(receipt, reservation)

    plan = brand.plan
    fee = billing_services.rebate_processing_fee(plan, reward) if plan else ZERO

    brand_wallet = wallet_services.get_or_create_brand_wallet(brand)
    customer_wallet = wallet_services.get_or_create_customer_wallet(receipt.user)

    # 1) Capture the hold → brand pays the reward.
    brand_reward_entry = wallet_services.capture_hold(
        hold=reservation.hold,
        amount=reward,
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
    if reservation.deal_type:
        # Cooldown begins at the approved redemption, under the claim's terms.
        from Apps.offers.services import enter_cooldown

        enter_cooldown(
            receipt.user, campaign,
            days=reservation.cooldown_days, one_time=reservation.one_time_only,
        )
    return redemption


def void_reservation_on_rejection(receipt) -> None:
    """Release the escrow hold for a rejected receipt's reservation."""
    reservation = receipt.reservation
    if reservation.status == Reservation.Status.ACTIVE:
        reservation_services.mark_rejected(reservation)
