"""Locked reward math for rebate deal types (Master: "Offer Type Inputs").

Pure functions: given the terms snapshotted on the reservation and the unit
prices of the eligible products found on the receipt, decide whether the
receipt qualifies and how much to pay. One reward per approved redemption.

Prices are per *unit* (a line with quantity 2 contributes two units). A price
of ``None`` means the receipt reader couldn't confirm it; when a needed price
is uncertain the decision is ``needs_review`` — never an automatic rejection.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

CENT = Decimal("0.01")

FREE = "free"
BOGO_FREE = "bogo_free"
BOGO_HALF = "bogo_half"
BUY_X_GET_Y = "buy_x_get_y"

#: Eligible units each deal type needs on one receipt (Buy X Get $Y: brand-chosen).
REQUIRED_UNITS = {FREE: 1, BOGO_FREE: 2, BOGO_HALF: 2}

QUALIFIES = "qualifies"
NOT_ENOUGH_UNITS = "not_enough_units"
NEEDS_REVIEW = "needs_review"


@dataclass(frozen=True)
class RewardDecision:
    status: str
    amount: Decimal | None = None
    reason: str = ""

    @property
    def qualifies(self) -> bool:
        return self.status == QUALIFIES


def required_units(deal_type: str, required_quantity: int = 1) -> int:
    if deal_type == BUY_X_GET_Y:
        return max(int(required_quantity or 1), 1)
    return REQUIRED_UNITS[deal_type]


def max_reward(deal_type: str, *, max_rebate, fixed_reward) -> Decimal:
    """Most one redemption can pay — what a claim reserves."""
    value = fixed_reward if deal_type == BUY_X_GET_Y else max_rebate
    return Decimal(value).quantize(CENT)


def _cap(amount: Decimal, cap: Decimal) -> Decimal:
    return min(amount, cap).quantize(CENT, rounding=ROUND_HALF_UP)


def decide(
    *,
    deal_type: str,
    unit_prices: list[Decimal | None],
    max_rebate=None,
    fixed_reward=None,
    required_quantity: int = 1,
) -> RewardDecision:
    """Apply the locked rules for one approved redemption."""
    needed = required_units(deal_type, required_quantity)
    if len(unit_prices) < needed:
        return RewardDecision(
            NOT_ENOUGH_UNITS,
            reason=f"Needs {needed} eligible unit(s); found {len(unit_prices)}.",
        )

    if deal_type == BUY_X_GET_Y:
        # Fixed reward once the quantity is verified; prices don't matter.
        return RewardDecision(QUALIFIES, Decimal(fixed_reward).quantize(CENT))

    cap = Decimal(max_rebate).quantize(CENT)
    known = sorted((Decimal(p) for p in unit_prices if p is not None), reverse=True)
    uncertain = len(known) < len(unit_prices)

    if deal_type == FREE:
        # Pay one unit's price (the highest eligible one), capped.
        if known and known[0] >= cap:
            return RewardDecision(QUALIFIES, cap)
        if uncertain:
            return RewardDecision(NEEDS_REVIEW, reason="Eligible item price unclear.")
        return RewardDecision(QUALIFIES, _cap(known[0], cap))

    # BOGO Free / Buy 1 Get 1 50% Off: the lower-priced of the two qualifying
    # units — pick the best pair, i.e. the second-highest unit price.
    fraction = Decimal("1") if deal_type == BOGO_FREE else Decimal("0.5")
    if len(known) >= 2 and known[1] * fraction >= cap:
        return RewardDecision(QUALIFIES, cap)
    if uncertain:
        return RewardDecision(NEEDS_REVIEW, reason="Eligible item prices unclear.")
    return RewardDecision(QUALIFIES, _cap(known[1] * fraction, cap))
