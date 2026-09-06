"""Reviews business logic: campaigns, AI prompts, rules engine, sessions,
reward issuance, and moderation."""

from __future__ import annotations

import datetime as dt
import logging
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from Apps.billing import services as billing_services
from Apps.common.exceptions import DomainError
from Apps.common.money import ZERO, to_money
from Apps.products.models import Product
from Apps.reviews import ai, review_writer
from Apps.reviews.models import (
    Review,
    ReviewCampaign,
    ReviewModeration,
    ReviewPrompt,
    ReviewSession,
)
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry

logger = logging.getLogger(__name__)


class ReviewError(DomainError):
    """Expected, user-facing review errors (mapped to HTTP 400)."""


def _default_reward() -> Decimal:
    return to_money(settings.REVIEW_REWARD_AMOUNT)


# ---------------------------------------------------------------------------
# Campaign management (brand)
# ---------------------------------------------------------------------------
def create_review_campaign(*, brand, name, daily_budget, reward_amount=None,
                           product_context="", product_ids=None) -> ReviewCampaign:
    daily_budget = to_money(daily_budget)
    if daily_budget <= ZERO:
        raise ReviewError("Daily budget must be positive.")
    reward = to_money(reward_amount) if reward_amount is not None else _default_reward()
    if reward <= ZERO:
        raise ReviewError("Reward must be positive.")

    campaign = ReviewCampaign.objects.create(
        brand=brand, name=name, daily_budget=daily_budget,
        reward_amount=reward, product_context=product_context,
    )
    if product_ids:
        set_products(campaign, product_ids)
    return campaign


def update_review_campaign(campaign: ReviewCampaign, **fields) -> ReviewCampaign:
    if campaign.status in (ReviewCampaign.Status.COMPLETED, ReviewCampaign.Status.ARCHIVED):
        raise ReviewError("This campaign can no longer be edited.")
    if "daily_budget" in fields:
        fields["daily_budget"] = to_money(fields["daily_budget"])
        if fields["daily_budget"] <= ZERO:
            raise ReviewError("Daily budget must be positive.")
    for key, value in fields.items():
        setattr(campaign, key, value)
    campaign.save()
    return campaign


def set_products(campaign: ReviewCampaign, product_ids) -> ReviewCampaign:
    products = Product.objects.filter(
        id__in=product_ids, brand=campaign.brand, is_active=True
    )
    if products.count() != len(set(product_ids)):
        raise ReviewError("One or more products were not found in the brand library.")
    campaign.products.set(products)
    return campaign


def archive_review_campaign(campaign: ReviewCampaign) -> ReviewCampaign:
    campaign.status = ReviewCampaign.Status.ARCHIVED
    campaign.auto_paused = False
    campaign.save(update_fields=["status", "auto_paused", "updated_at"])
    return campaign


def activate_review_campaign(campaign: ReviewCampaign) -> ReviewCampaign:
    if campaign.status in (ReviewCampaign.Status.COMPLETED, ReviewCampaign.Status.ARCHIVED):
        raise ReviewError("This campaign can no longer be activated.")
    if not campaign.products.exists():
        raise ReviewError("Add at least one product before activating.")
    if not campaign.prompts.exists():
        raise ReviewError("Add or generate review prompts before activating.")
    wallet = wallet_services.get_or_create_brand_wallet(campaign.brand)
    if wallet.available() < campaign.daily_budget:
        raise ReviewError("Insufficient wallet funds to run this review campaign.")
    campaign.status = ReviewCampaign.Status.ACTIVE
    campaign.auto_paused = False
    campaign.save(update_fields=["status", "auto_paused", "updated_at"])
    return campaign


def pause_review_campaign(campaign: ReviewCampaign) -> ReviewCampaign:
    if campaign.status != ReviewCampaign.Status.ACTIVE:
        raise ReviewError("Only an active campaign can be paused.")
    campaign.status = ReviewCampaign.Status.PAUSED
    campaign.auto_paused = False
    campaign.save(update_fields=["status", "auto_paused", "updated_at"])
    return campaign


# ---------------------------------------------------------------------------
# Prompts (AI + custom)
# ---------------------------------------------------------------------------
def generate_ai_prompts(campaign: ReviewCampaign, *, count=4) -> list[ReviewPrompt]:
    product = campaign.products.first()
    product_name = product.name if product else campaign.name
    texts = ai.generate_prompts(
        product_name=product_name, product_context=campaign.product_context, count=count
    )
    # Replace existing AI prompts; keep brand custom prompts.
    campaign.prompts.filter(source=ReviewPrompt.Source.AI).delete()
    start = campaign.prompts.count()
    prompts = [
        ReviewPrompt(review_campaign=campaign, text=text, order=start + i,
                     source=ReviewPrompt.Source.AI)
        for i, text in enumerate(texts)
    ]
    ReviewPrompt.objects.bulk_create(prompts)
    return list(campaign.prompts.all())


def add_custom_prompt(campaign: ReviewCampaign, *, text) -> ReviewPrompt:
    order = campaign.prompts.count()
    return ReviewPrompt.objects.create(
        review_campaign=campaign, text=text, order=order,
        source=ReviewPrompt.Source.CUSTOM,
    )


def build_preview(campaign: ReviewCampaign) -> dict:
    return {
        "campaign": campaign,
        "products": list(campaign.products.all()),
        "prompts": list(campaign.prompts.all()),
        "reward_amount": str(campaign.reward_amount),
        "consumes_budget": False,
    }


# ---------------------------------------------------------------------------
# Rules engine — generate review opportunities for a verified receipt
# ---------------------------------------------------------------------------
def _reviewed_within_cooldown(user, product) -> bool:
    cutoff = timezone.now() - dt.timedelta(days=settings.REVIEW_PRODUCT_COOLDOWN_DAYS)
    return Review.objects.filter(
        user=user, product=product, created_at__gte=cutoff
    ).exclude(status=Review.Status.REMOVED).exists()


def _review_daily_used(campaign: ReviewCampaign) -> Decimal:
    today = timezone.localdate()
    total = ZERO
    rows = ReviewSession.objects.filter(
        review_campaign=campaign, created_at__date=today,
        status__in=ReviewSession.BUDGET_CONSUMING,
    ).values_list("reward_amount", "fee_amount")
    for reward, fee in rows:
        total += reward + fee
    return total


def _prioritize(user, products: list[Product]) -> list[Product]:
    """Smart prioritization: new brands, then new products, then oldest reviewed."""
    reviewed_brand_ids = set(
        Review.objects.filter(user=user)
        .values_list("product__brand_id", flat=True)
    )
    reviewed_product_ids = set(
        Review.objects.filter(user=user).values_list("product_id", flat=True)
    )
    last_review = {}
    for product_id, created in Review.objects.filter(
        user=user, product__in=products
    ).values_list("product_id", "created_at"):
        if product_id not in last_review or created > last_review[product_id]:
            last_review[product_id] = created

    epoch = timezone.make_aware(dt.datetime(1970, 1, 1))

    def sort_key(p):
        new_brand = p.brand_id not in reviewed_brand_ids
        new_product = p.id not in reviewed_product_ids
        last = last_review.get(p.id, epoch)
        # Lower tuple sorts first: new brand, then new product, then oldest reviewed.
        return (not new_brand, not new_product, last)

    return sorted(products, key=sort_key)


def _active_campaign_for_product(product) -> ReviewCampaign | None:
    return (
        product.review_campaigns.filter(status=ReviewCampaign.Status.ACTIVE)
        .order_by("created_at")
        .first()
    )


@transaction.atomic
def generate_opportunities(receipt) -> list[ReviewSession]:
    """Create review opportunities (sessions) for eligible products on a receipt.

    Applies the rules engine: 90-day per-product cooldown, max-5-per-receipt,
    smart prioritization, and silent filtering (ineligible products are simply
    skipped, never surfaced as errors). Reserves reward+fee before showing.
    """
    user = receipt.user

    # Candidate products: matched line items that belong to an active review campaign.
    candidates = []
    seen = set()
    for li in receipt.line_items.select_related("matched_product").all():
        product = li.matched_product
        if product is None or product.id in seen:
            continue
        if _active_campaign_for_product(product) is None:
            continue
        seen.add(product.id)
        candidates.append(product)

    # 90-day cooldown filter (silent).
    candidates = [p for p in candidates if not _reviewed_within_cooldown(user, p)]
    candidates = _prioritize(user, candidates)

    # Max 5 review opportunities per receipt.
    existing = ReviewSession.objects.filter(receipt=receipt).count()
    slots = max(0, settings.REVIEW_MAX_PER_RECEIPT - existing)

    created: list[ReviewSession] = []
    for product in candidates:
        if len(created) >= slots:
            break
        campaign = _active_campaign_for_product(product)
        if campaign is None:
            continue
        if ReviewSession.objects.filter(
            user=user, product=product, receipt=receipt
        ).exists():
            continue

        reward = campaign.reward_amount
        plan = campaign.brand.plan
        fee = billing_services.review_fee(plan) if plan else ZERO
        reserve = reward + fee

        # Daily budget (includes the platform fee) — silent skip if exceeded.
        if _review_daily_used(campaign) + reserve > campaign.daily_budget:
            continue

        wallet = wallet_services.get_or_create_brand_wallet(campaign.brand)
        try:
            hold = wallet_services.place_hold(
                wallet=wallet, amount=reserve,
                reference_type="review_session", reference_id=receipt.id,
                expires_at=timezone.now() + dt.timedelta(
                    days=settings.REVIEW_SESSION_EXPIRY_DAYS
                ),
            )
        except wallet_services.InsufficientFunds:
            continue  # silent

        session = ReviewSession.objects.create(
            review_campaign=campaign, product=product, user=user, receipt=receipt,
            reward_amount=reward, fee_amount=fee, hold=hold,
            expires_at=timezone.now() + dt.timedelta(
                days=settings.REVIEW_SESSION_EXPIRY_DAYS
            ),
        )
        created.append(session)
    return created


# ---------------------------------------------------------------------------
# Chat + submission
# ---------------------------------------------------------------------------
def _qa_pairs(messages: list[dict], prompts: list[ReviewPrompt]) -> list[tuple[str, str]]:
    """Pair each asked question with the answer that followed it.

    The first prompt is put to the reviewer up front by the client (from
    ``ReviewSessionSerializer.prompts``) and is never itself written to
    ``messages`` — only the reviewer's replies and the follow-up prompts are.
    So the first user message answers ``prompts[0]``, and every later user
    message answers whichever assistant message came right before it.
    """
    pairs: list[tuple[str, str]] = []
    pending_question = prompts[0].text if prompts else None
    for message in messages:
        role = message.get("role")
        if role == "user" and pending_question is not None:
            pairs.append((pending_question, message.get("content", "")))
            pending_question = None
        elif role == "assistant":
            pending_question = message.get("content")
    return pairs


def _write_ai_review(session: ReviewSession, qa_pairs: list[tuple[str, str]]) -> str:
    """Turn the reviewer's Q&A into review prose via the AI writing service.

    Falls back to the reviewer's own answers, stitched together, if that
    service is unreachable or unconfigured — the flow must not dead-end on an
    external call.
    """
    try:
        result = review_writer.write_review(
            product_name=session.product.name,
            product_context=session.review_campaign.product_context,
            qa_pairs=qa_pairs,
        )
        return result["body"]
    except review_writer.ReviewWriterUnavailable:
        logger.warning(
            "AI review writer unavailable for session %s; using answers as-is.", session.id
        )
        return " ".join(answer.strip() for _, answer in qa_pairs if answer and answer.strip())


def append_message(session: ReviewSession, *, text) -> dict:
    """Record one answer and either return the next prompt or the AI review.

    A deliberately simple Q&A, not a free-form chatbot: the campaign's fixed
    4-6 prompts are asked one at a time, and once the last is answered the
    reviewer's answers are handed to the AI writer and the finished review
    comes back in the same response ("thank you -- here's your review").
    """
    if session.status != ReviewSession.Status.ACTIVE:
        raise ReviewError("This review session is no longer active.")
    prompts = list(session.review_campaign.prompts.all())
    answered = sum(1 for m in session.messages if m.get("role") == "user")
    session.messages.append({"role": "user", "content": text})

    next_index = answered + 1
    next_prompt = prompts[next_index].text if next_index < len(prompts) else None
    if next_prompt:
        session.messages.append({"role": "assistant", "content": next_prompt})
        session.save(update_fields=["messages", "updated_at"])
        return {"next_prompt": next_prompt, "done": False, "review": None}

    review_text = _write_ai_review(session, _qa_pairs(session.messages, prompts))
    session.ai_review_content = review_text
    session.save(update_fields=["messages", "ai_review_content", "updated_at"])
    return {"next_prompt": None, "done": True, "review": review_text}


@transaction.atomic
def submit_review(session: ReviewSession, *, rating, content="") -> Review:
    if session.status != ReviewSession.Status.ACTIVE:
        raise ReviewError("This review session is no longer active.")
    if timezone.now() >= session.expires_at:
        raise ReviewError("This review opportunity has expired.")
    if not (1 <= int(rating) <= 5):
        raise ReviewError("Rating must be between 1 and 5.")

    # An explicit `content` (the reviewer editing the AI draft) wins; otherwise
    # publish the AI-written review from the Q&A as-is.
    final_content = content.strip() if content and content.strip() else session.ai_review_content

    # Reward is issued regardless of rating (spec 2.6).
    _issue_review_reward(session)

    now = timezone.now()
    auto_publish = int(rating) >= settings.REVIEW_AUTO_PUBLISH_MIN_RATING
    review = Review.objects.create(
        review_campaign=session.review_campaign,
        product=session.product,
        user=session.user,
        session=session,
        rating=int(rating),
        content=final_content,
        status=Review.Status.PUBLISHED if auto_publish else Review.Status.HELD,
        published_at=now if auto_publish else None,
    )
    ReviewModeration.objects.create(
        review=review,
        auto_published=auto_publish,
        held_until=None if auto_publish else now + dt.timedelta(days=settings.REVIEW_HOLD_DAYS),
    )

    session.status = ReviewSession.Status.COMPLETED
    session.save(update_fields=["status", "updated_at"])
    return review


def _issue_review_reward(session: ReviewSession) -> None:
    reward = session.reward_amount
    fee = session.fee_amount
    brand_wallet = wallet_services.get_or_create_brand_wallet(session.review_campaign.brand)
    customer_wallet = wallet_services.get_or_create_customer_wallet(session.user)

    if session.hold_id and session.hold.status == Hold.Status.ACTIVE:
        # Capture the reward portion of the (reward+fee) hold.
        wallet_services.capture_hold(
            hold=session.hold, amount=reward,
            category=LedgerEntry.Category.REVIEW_REWARD,
            description="Review reward",
            idempotency_key=f"review-reward:{session.id}",
        )
    else:
        # Fallback: hold missing/expired — debit directly (best effort).
        wallet_services.debit(
            wallet=brand_wallet, amount=reward,
            category=LedgerEntry.Category.REVIEW_REWARD,
            reference_type="review_session", reference_id=session.id,
            idempotency_key=f"review-reward:{session.id}",
        )

    if fee > ZERO:
        wallet_services.debit(
            wallet=brand_wallet, amount=fee,
            category=LedgerEntry.Category.REVIEW_FEE,
            reference_type="review_session", reference_id=session.id,
            description="Review platform fee",
            idempotency_key=f"review-fee:{session.id}",
        )

    wallet_services.credit(
        wallet=customer_wallet, amount=reward,
        category=LedgerEntry.Category.REVIEW_REWARD,
        reference_type="review_session", reference_id=session.id,
        description="Review reward",
        idempotency_key=f"review-customer:{session.id}",
    )


# ---------------------------------------------------------------------------
# Moderation
# ---------------------------------------------------------------------------
def remove_review(*, review: Review, moderator, reason="") -> Review:
    if review.status == Review.Status.REMOVED:
        raise ReviewError("This review is already removed.")
    review.status = Review.Status.REMOVED
    review.save(update_fields=["status", "updated_at"])
    mod = review.moderation
    mod.removed = True
    mod.removed_by = moderator
    mod.removal_reason = reason
    mod.save(update_fields=["removed", "removed_by", "removal_reason", "updated_at"])
    return review


def release_held_reviews(now=None) -> int:
    """Publish 1–2★ reviews whose 30-day hold has elapsed (unless removed)."""
    now = now or timezone.now()
    held = Review.objects.filter(
        status=Review.Status.HELD, moderation__held_until__lte=now
    ).select_related("moderation")
    count = 0
    for review in held:
        review.status = Review.Status.PUBLISHED
        review.published_at = now
        review.save(update_fields=["status", "published_at", "updated_at"])
        review.moderation.released_at = now
        review.moderation.save(update_fields=["released_at", "updated_at"])
        count += 1
    return count


# ---------------------------------------------------------------------------
# Session expiry
# ---------------------------------------------------------------------------
def expire_due_sessions(now=None) -> int:
    now = now or timezone.now()
    due = ReviewSession.objects.filter(
        status=ReviewSession.Status.ACTIVE, expires_at__lte=now
    ).select_related("hold")
    count = 0
    for session in due:
        with transaction.atomic():
            session.status = ReviewSession.Status.EXPIRED
            session.save(update_fields=["status", "updated_at"])
            if session.hold_id:
                wallet_services.release_hold(hold=session.hold)
        count += 1
    return count
