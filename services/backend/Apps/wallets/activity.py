"""Shopper Wallet & Reward Ledger (Master: Wallet Overview, Wallet Activity,
Reward Details).

One feed with every money item a shopper sees:

* rebate rewards still **pending approval** (receipt submitted, not decided —
  shown at the claim's reward, which is what the shopper will receive at most),
* rewards that are **available** (rebates, reviews, referrals, adjustments),
* withdrawals with the shopper-facing status **requested / processing / paid**
  (or **rejected** — the amount went back to the balance).

Each item carries a short reference and a timeline for Reward Details."""

from decimal import Decimal

from Apps.common.money import ZERO
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

C = LedgerEntry.Category

TYPE_BY_CATEGORY = {
    C.REBATE_REWARD: "rebate",
    C.REVIEW_REWARD: "review",
    C.REFERRAL_BONUS: "referral",
    C.ADJUSTMENT: "adjustment",
}

# Master: shopper-facing withdrawal status is Requested, Processing or Paid.
WITHDRAWAL_STATUS = {
    "pending": "requested",
    "approved": "requested",
    "flagged": "processing",
    "processing": "processing",
    "paid": "paid",
    "rejected": "rejected",
    "failed": "processing",  # retryable — still reserved; permanent → "failed" below
}


PROVIDERS = {"paypal": "PayPal", "venmo": "Venmo"}


def _ref(value) -> str:
    return f"NBL-{str(value).replace('-', '')[:8].upper()}"


def _image(request, field) -> str:
    if not field:
        return ""
    return request.build_absolute_uri(field.url) if request else field.url


def _step(label, at=None, *, done=False, current=False, note=""):
    return {"label": label, "at": at, "done": done, "current": current, "note": note}


def _short_name(user) -> str:
    parts = (user.full_name or "").split() if user else []
    if not parts:
        return "a friend"
    return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else parts[0]


def _rebate_title(campaign) -> str:
    return campaign.offer_headline or f"{campaign.brand.name} rebate"


def shopper_activity(user, request=None) -> dict:
    from Apps.accounts.models import User
    from Apps.payouts.models import WithdrawalRequest
    from Apps.receipts.models import Receipt
    from Apps.reviews.models import ReviewSession

    wallet = wallet_services.get_or_create_customer_wallet(user)
    items: list[dict] = []

    # 1) Pending approval: submitted receipts not yet decided.
    pending_total = ZERO
    for receipt in Receipt.objects.filter(user=user, status=Receipt.Status.PENDING).select_related(
        "reservation__campaign__brand"
    ):
        campaign = receipt.reservation.campaign
        amount = receipt.reservation.reward_amount or ZERO
        pending_total += amount
        items.append({
            "id": f"receipt-{receipt.id}", "type": "rebate", "status": "pending",
            "title": _rebate_title(campaign), "brand": campaign.brand.name, "amount": str(amount),
            "date": receipt.created_at, "image": _image(request, campaign.image),
            "details": {"reward_type": "Rebate", "campaign": campaign.offer_headline or "",
                        "receipt_date": receipt.purchased_at, "reference": _ref(receipt.id)},
            "timeline": [
                _step("Receipt submitted", receipt.created_at, done=True),
                _step("Under review", current=True, note="We're reviewing your receipt and details."),
                _step("Approved & available", note="Moves to your available balance after approval."),
            ],
        })

    # 2) Rewards credited to the wallet (available).
    credits = list(wallet.ledger_entries.filter(entry_type=LedgerEntry.EntryType.CREDIT))
    reservation_ids = [e.reference_id for e in credits if e.category == C.REBATE_REWARD and e.reference_id]
    receipts = {
        str(r.reservation_id): r
        for r in Receipt.objects.filter(reservation_id__in=reservation_ids, status=Receipt.Status.VERIFIED)
        .select_related("reservation__campaign__brand")
    }
    session_ids = [e.reference_id for e in credits if e.category == C.REVIEW_REWARD and e.reference_id]
    sessions = {
        str(s.id): s
        for s in ReviewSession.objects.filter(id__in=session_ids).select_related("review_campaign__brand", "product")
    }
    friend_ids = [e.reference_id for e in credits if e.category == C.REFERRAL_BONUS and e.reference_id]
    friends = {str(u.id): u for u in User.objects.filter(id__in=friend_ids)}

    for e in credits:
        kind = TYPE_BY_CATEGORY.get(e.category, "adjustment")
        item = {
            "id": f"entry-{e.id}", "type": kind, "status": "available", "title": e.description,
            "brand": "", "amount": str(e.amount), "date": e.created_at, "image": "",
            "details": {"reward_type": kind.title(), "reference": _ref(e.id)},
            "timeline": [_step("Added to your balance", e.created_at, done=True)],
        }
        if kind == "rebate":
            receipt = receipts.get(e.reference_id)
            if receipt:
                campaign = receipt.reservation.campaign
                item.update(title=_rebate_title(campaign), brand=campaign.brand.name,
                            image=_image(request, campaign.image))
                item["details"].update(campaign=campaign.offer_headline or "", receipt_date=receipt.purchased_at)
                item["timeline"] = [
                    _step("Receipt submitted", receipt.created_at, done=True),
                    _step("Approved", e.created_at, done=True),
                    _step("Available", e.created_at, done=True),
                ]
        elif kind == "review":
            session = sessions.get(e.reference_id)
            if session:
                brand = session.review_campaign.brand
                item.update(title=f"{brand.name} review", brand=brand.name,
                            image=_image(request, session.review_campaign.image))
                item["details"].update(campaign=session.product.name)
                item["timeline"] = [_step("Review completed", e.created_at, done=True),
                                    _step("Available", e.created_at, done=True)]
        elif kind == "referral":
            item["title"] = f"Referral — {_short_name(friends.get(e.reference_id))}"
        items.append(item)

    # 3) Withdrawals (the paid ledger debit is represented here, not twice).
    for w in WithdrawalRequest.objects.filter(user=user):
        status = WITHDRAWAL_STATUS.get(w.status, "requested")
        if w.status == "failed" and w.failure_permanent:
            status = "failed"
        timeline = [
            _step("Requested", w.created_at, done=True),
            _step("Processing", w.reviewed_at if status in ("processing", "paid") else None,
                  done=status == "paid", current=status == "processing"),
            _step("Paid", w.paid_at, done=status == "paid"),
        ]
        if status == "rejected":
            timeline = [_step("Requested", w.created_at, done=True),
                        _step("Not approved — amount returned to your balance", w.reviewed_at, done=True,
                              note=w.decision_reason)]
        elif status == "failed":
            timeline = [_step("Requested", w.created_at, done=True),
                        _step("Payment failed — amount returned to your balance", w.reviewed_at, done=True,
                              note=w.failure_reason)]
        items.append({
            "id": f"withdrawal-{w.id}", "type": "withdrawal", "status": status,
            "title": f"{PROVIDERS.get(w.provider, w.provider.title())} withdrawal",
            "brand": "", "amount": str(-w.amount), "date": w.created_at, "image": "",
            "details": {"reward_type": "Withdrawal", "send_to": f"{w.provider} · {w.handle}", "reference": _ref(w.id)},
            "timeline": timeline,
        })

    items.sort(key=lambda i: i["date"], reverse=True)
    return {
        "summary": {
            "available": str(wallet.available()),
            "pending_approval": str(Decimal(pending_total).quantize(Decimal("0.01"))),
        },
        "items": items,
    }
