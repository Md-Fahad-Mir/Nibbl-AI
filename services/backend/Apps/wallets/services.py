"""WalletService — the only sanctioned way to move money.

Every mutating operation:
  * runs inside a single DB transaction,
  * locks the wallet row (``SELECT ... FOR UPDATE`` on Postgres) to serialize
    concurrent operations and prevent overselling,
  * is idempotent when given an ``idempotency_key``.
"""

from __future__ import annotations

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from Apps.common.money import ZERO, to_money
from Apps.wallets.models import Hold, LedgerEntry, Wallet


class WalletError(Exception):
    """Expected, user-facing wallet error (mapped to HTTP 400)."""


class InsufficientFunds(WalletError):
    pass


# ---------------------------------------------------------------------------
# Wallet provisioning (lazy)
# ---------------------------------------------------------------------------
def get_or_create_brand_wallet(brand) -> Wallet:
    wallet, _ = Wallet.objects.get_or_create(
        brand=brand, defaults={"kind": Wallet.Kind.BRAND}
    )
    return wallet


def get_or_create_customer_wallet(user) -> Wallet:
    wallet, _ = Wallet.objects.get_or_create(
        user=user, defaults={"kind": Wallet.Kind.CUSTOMER}
    )
    return wallet


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------
def _lock_wallet(wallet_id) -> Wallet:
    qs = Wallet.objects.all()
    if connection.features.has_select_for_update:
        qs = qs.select_for_update()
    return qs.get(pk=wallet_id)


def _existing_entry(idempotency_key):
    if not idempotency_key:
        return None
    return LedgerEntry.objects.filter(idempotency_key=idempotency_key).first()


def _existing_hold(idempotency_key):
    if not idempotency_key:
        return None
    return Hold.objects.filter(idempotency_key=idempotency_key).first()


def _post_entry(wallet, *, entry_type, amount, category, reference_type,
                reference_id, description, idempotency_key, is_promotional=False):
    return LedgerEntry.objects.create(
        wallet=wallet,
        entry_type=entry_type,
        amount=amount,
        category=category,
        balance_after=wallet.balance,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id else "",
        description=description,
        idempotency_key=idempotency_key,
        is_promotional=is_promotional,
    )


# ---------------------------------------------------------------------------
# Public operations
# ---------------------------------------------------------------------------
@transaction.atomic
def credit(*, wallet, amount, category, reference_type="", reference_id="",
           description="", idempotency_key=None, is_promotional=False) -> LedgerEntry:
    amount = to_money(amount)
    if amount <= ZERO:
        raise WalletError("Amount must be positive.")

    existing = _existing_entry(idempotency_key)
    if existing:
        return existing

    wallet = _lock_wallet(wallet.pk)
    wallet.balance = to_money(wallet.balance + amount)
    wallet.save(update_fields=["balance", "updated_at"])
    return _post_entry(
        wallet,
        entry_type=LedgerEntry.EntryType.CREDIT,
        amount=amount,
        category=category,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
        idempotency_key=idempotency_key,
        is_promotional=is_promotional,
    )


@transaction.atomic
def debit(*, wallet, amount, category, reference_type="", reference_id="",
          description="", idempotency_key=None, allow_negative=False,
          real_only=False) -> LedgerEntry:
    """Debit the wallet. ``real_only`` restricts the charge to real
    (non-promotional) funds — used for shopper rewards, which promo credit may
    never back. Eligible platform charges should use ``charge_eligible`` so
    they spend promo first."""
    amount = to_money(amount)
    if amount <= ZERO:
        raise WalletError("Amount must be positive.")

    existing = _existing_entry(idempotency_key)
    if existing:
        return existing

    wallet = _lock_wallet(wallet.pk)
    spendable = wallet.reward_available() if real_only else wallet.available()
    if not allow_negative and amount > spendable:
        raise InsufficientFunds("Insufficient available balance.")

    wallet.balance = to_money(wallet.balance - amount)
    wallet.save(update_fields=["balance", "updated_at"])
    return _post_entry(
        wallet,
        entry_type=LedgerEntry.EntryType.DEBIT,
        amount=amount,
        category=category,
        reference_type=reference_type,
        reference_id=reference_id,
        description=description,
        idempotency_key=idempotency_key,
    )


@transaction.atomic
def charge_eligible(*, wallet, amount, category, reference_type="", reference_id="",
                    description="", idempotency_key=None) -> list[LedgerEntry]:
    """Charge an eligible platform cost (processing fee, subscription), spending
    promotional credit first and real funds for the remainder. Posts up to two
    ledger entries (a promotional debit and/or a real debit) and returns them.
    Raises InsufficientFunds only if real funds can't cover the non-promo part.
    """
    amount = to_money(amount)
    if amount <= ZERO:
        raise WalletError("Amount must be positive.")

    if idempotency_key:
        existing = list(
            LedgerEntry.objects.filter(
                idempotency_key__in=[f"{idempotency_key}:promo", f"{idempotency_key}:real"]
            )
        )
        if existing:
            return existing

    wallet = _lock_wallet(wallet.pk)
    promo = wallet.promo_balance()
    promo_part = min(amount, promo) if promo > ZERO else ZERO
    real_part = to_money(amount - promo_part)

    if real_part > wallet.reward_available():
        raise InsufficientFunds("Insufficient available balance.")

    entries = []
    if promo_part > ZERO:
        wallet.balance = to_money(wallet.balance - promo_part)
        wallet.save(update_fields=["balance", "updated_at"])
        entries.append(_post_entry(
            wallet,
            entry_type=LedgerEntry.EntryType.DEBIT,
            amount=promo_part,
            category=category,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
            idempotency_key=f"{idempotency_key}:promo" if idempotency_key else None,
            is_promotional=True,
        ))
    if real_part > ZERO:
        wallet.balance = to_money(wallet.balance - real_part)
        wallet.save(update_fields=["balance", "updated_at"])
        entries.append(_post_entry(
            wallet,
            entry_type=LedgerEntry.EntryType.DEBIT,
            amount=real_part,
            category=category,
            reference_type=reference_type,
            reference_id=reference_id,
            description=description,
            idempotency_key=f"{idempotency_key}:real" if idempotency_key else None,
            is_promotional=False,
        ))
    return entries


@transaction.atomic
def place_hold(*, wallet, amount, reference_type="", reference_id="",
               expires_at=None, idempotency_key=None) -> Hold:
    amount = to_money(amount)
    if amount <= ZERO:
        raise WalletError("Amount must be positive.")

    existing = _existing_hold(idempotency_key)
    if existing:
        return existing

    wallet = _lock_wallet(wallet.pk)
    # Holds escrow shopper rewards, so they draw on real funds only — promo
    # credit can never be reserved for a reward.
    if amount > wallet.reward_available():
        raise InsufficientFunds("Insufficient available balance to reserve.")

    return Hold.objects.create(
        wallet=wallet,
        amount=amount,
        status=Hold.Status.ACTIVE,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id else "",
        expires_at=expires_at,
        idempotency_key=idempotency_key,
    )


@transaction.atomic
def capture_hold(*, hold, category, amount=None, description="",
                 idempotency_key=None) -> LedgerEntry:
    """Convert an active hold into a real debit (full or partial)."""
    wallet = _lock_wallet(hold.wallet_id)
    hold = Hold.objects.select_for_update().get(pk=hold.pk) if (
        connection.features.has_select_for_update
    ) else Hold.objects.get(pk=hold.pk)

    if hold.status != Hold.Status.ACTIVE:
        raise WalletError("Only an active hold can be captured.")

    capture_amount = to_money(amount) if amount is not None else hold.amount
    if capture_amount <= ZERO or capture_amount > hold.amount:
        raise WalletError("Capture amount must be positive and within the hold.")

    # Releasing the hold first makes the reserved funds available to debit.
    hold.status = Hold.Status.CAPTURED
    hold.captured_at = timezone.now()
    hold.save(update_fields=["status", "captured_at", "updated_at"])

    wallet.balance = to_money(wallet.balance - capture_amount)
    wallet.save(update_fields=["balance", "updated_at"])
    # A hold is only ever placed against real funds, so its capture is real.
    return _post_entry(
        wallet,
        entry_type=LedgerEntry.EntryType.DEBIT,
        amount=capture_amount,
        category=category,
        reference_type=hold.reference_type,
        reference_id=hold.reference_id,
        description=description,
        idempotency_key=idempotency_key,
        is_promotional=False,
    )


@transaction.atomic
def release_hold(*, hold) -> Hold:
    hold = Hold.objects.select_for_update().get(pk=hold.pk) if (
        connection.features.has_select_for_update
    ) else Hold.objects.get(pk=hold.pk)
    if hold.status != Hold.Status.ACTIVE:
        return hold  # idempotent: already captured/released
    hold.status = Hold.Status.RELEASED
    hold.released_at = timezone.now()
    hold.save(update_fields=["status", "released_at", "updated_at"])
    return hold


# ---------------------------------------------------------------------------
# Referral bonus (M1 "Invite Friends, Earn $5")
# ---------------------------------------------------------------------------
def maybe_credit_referral_bonus(referred_user) -> LedgerEntry | None:
    """Pay the inviter once, the first time a referred user is activated."""
    referrer = referred_user.referred_by
    if referrer is None:
        return None
    amount = to_money(settings.REFERRAL_BONUS_AMOUNT)
    if amount <= ZERO:
        return None
    wallet = get_or_create_customer_wallet(referrer)
    return credit(
        wallet=wallet,
        amount=amount,
        category=LedgerEntry.Category.REFERRAL_BONUS,
        reference_type="user",
        reference_id=referred_user.id,
        description="Referral bonus",
        idempotency_key=f"referral-bonus:{referred_user.id}",
    )
