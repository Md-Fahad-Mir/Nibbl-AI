"""Review campaigns (Master #23–27): campaign management, the opportunity
rules engine, the review conversation, submission + $1 reward, moderation.

Rebuilt from the system removed in f590bdf, updated to the Master:
* $1 shopper reward (platform setting) + the plan's review fee, reserved
  when the opportunity is created; 30 days to complete.
* Only an already-verified rebate receipt creates opportunities: every line
  is matched against products in live review campaigns (any brand), one
  opportunity per product (quantity never duplicates), max 5 per receipt,
  per-shopper+product cooldown, the campaign's daily opportunity cap.
* Conversation: product questions (AI) + one rotated brand question; the AI
  writes the review from the answers; the shopper may edit or regenerate.
* Submitting pays $1 immediately. 4–5★ publish now; 1–3★ are held 7 days
  for the brand to respond or flag, then publish unless flagged.
"""

from __future__ import annotations

import datetime as dt
import logging

from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from Apps.billing import services as billing_services
from Apps.brands.models import Brand
from Apps.common.exceptions import DomainError
from Apps.common.models import AuditLog
from Apps.common.money import ZERO, to_money
from Apps.products.models import Product
from Apps.products.selectors import match_product
from Apps.reviews import review_writer
from Apps.reviews.models import Review, ReviewCampaign, ReviewPrompt, ReviewSession
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry

logger = logging.getLogger(__name__)

RECOMMEND_QUESTION = "Would you buy it again or recommend it to a friend?"
# Master "Flag Review for Removal" reasons.
FLAG_REASONS = (
    "Wrong product (does not match receipt)",
    "Unrelated content (not about the product)",
    "Spam or fraud (fake or incentivized content)",
    "Personal information (PII)",
    "Profanity or abusive language",
    "Prohibited claim (e.g., medical, health, unverified)",
    "Other policy violation",
)


class ReviewCampaignError(DomainError):
    """Expected, user-facing review-campaign errors (HTTP 400)."""


def reward_amount():
    return to_money(settings.REVIEW_REWARD_AMOUNT)


# ---------------------------------------------------------------------------
# Campaign management (brand)
# ---------------------------------------------------------------------------
def _products(brand, product_ids) -> list[Product]:
    ids = list(dict.fromkeys(str(p) for p in product_ids or []))
    products = list(Product.objects.filter(id__in=ids, brand=brand, is_active=True))
    if len(products) != len(ids):
        raise ReviewCampaignError("One or more products were not found in your product library.")
    return products


def _validate(campaign: ReviewCampaign) -> None:
    if not campaign.one_time_only and campaign.product_cooldown_days not in ReviewCampaign.COOLDOWN_CHOICES:
        raise ReviewCampaignError("Product cooldown must be none, 30, 60 or 90 days, or one time.")
    if campaign.daily_opportunities < 1:
        raise ReviewCampaignError("Set at least one review opportunity per day.")
    if campaign.start_at and campaign.end_at and campaign.end_at <= campaign.start_at:
        raise ReviewCampaignError("The end date must be after the start date.")


FIELDS = ("name", "product_context", "start_at", "end_at", "daily_opportunities",
          "product_cooldown_days", "one_time_only")


@transaction.atomic
def create_campaign(*, brand, product_ids=None, **fields) -> ReviewCampaign:
    campaign = ReviewCampaign(brand=brand, **{k: v for k, v in fields.items() if k in FIELDS and v is not None})
    _validate(campaign)
    campaign.save()
    if product_ids:
        campaign.products.set(_products(brand, product_ids))
    return campaign


def update_campaign(campaign: ReviewCampaign, *, product_ids=None, **fields) -> ReviewCampaign:
    if campaign.status in (ReviewCampaign.Status.ENDED, ReviewCampaign.Status.ARCHIVED):
        raise ReviewCampaignError("This campaign can no longer be edited.")
    for key, value in fields.items():
        if key in FIELDS:
            setattr(campaign, key, value)
    _validate(campaign)
    campaign.save()
    if product_ids is not None:
        campaign.products.set(_products(campaign.brand, product_ids))
    return campaign


def activate(campaign: ReviewCampaign) -> ReviewCampaign:
    if campaign.status in (ReviewCampaign.Status.ENDED, ReviewCampaign.Status.ARCHIVED):
        raise ReviewCampaignError("This campaign can no longer be activated.")
    if not campaign.products.exists():
        raise ReviewCampaignError("Add at least one eligible product before activating.")
    wallet = wallet_services.get_or_create_brand_wallet(campaign.brand)
    per_review = reward_amount() + _fee(campaign)
    if wallet.reward_available() < per_review:
        raise ReviewCampaignError("Add wallet funds to cover at least one review before activating.")
    campaign.status = ReviewCampaign.Status.ACTIVE
    campaign.auto_paused = False
    campaign.save(update_fields=["status", "auto_paused", "updated_at"])
    return campaign


def pause(campaign: ReviewCampaign) -> ReviewCampaign:
    if campaign.status != ReviewCampaign.Status.ACTIVE:
        raise ReviewCampaignError("Only an active campaign can be paused.")
    campaign.status = ReviewCampaign.Status.PAUSED
    campaign.save(update_fields=["status", "updated_at"])
    return campaign


def archive(campaign: ReviewCampaign) -> ReviewCampaign:
    campaign.status = ReviewCampaign.Status.ARCHIVED
    campaign.save(update_fields=["status", "updated_at"])
    return campaign


def add_prompt(campaign: ReviewCampaign, *, text, source=ReviewPrompt.Source.BRAND) -> ReviewPrompt:
    text = " ".join(str(text or "").split())
    if not text:
        raise ReviewCampaignError("Enter the question.")
    return ReviewPrompt.objects.create(review_campaign=campaign, text=text[:500], source=source)


def suggest_prompts(campaign: ReviewCampaign, *, count=4) -> list[str]:
    """Suggested brand questions (Master: brand can request suggestions)."""
    product = campaign.products.first()
    try:
        return review_writer.suggest_questions(
            product_name=product.name if product else campaign.name,
            category=product.category if product else None, count=count,
        )
    except review_writer.ReviewWriterUnavailable as exc:
        raise ReviewCampaignError("Suggestions are unavailable right now. Try again shortly.") from exc


# ---------------------------------------------------------------------------
# Opportunity rules engine (on a verified rebate receipt)
# ---------------------------------------------------------------------------
def _fee(campaign: ReviewCampaign):
    plan = campaign.brand.plan
    return billing_services.review_fee(plan) if plan else ZERO


def _in_cooldown(user, product, campaign: ReviewCampaign, now) -> bool:
    """Per shopper + product: an open opportunity, or a review within the
    campaign's cooldown (any time for one-time)."""
    if ReviewSession.objects.filter(user=user, product=product, status=ReviewSession.Status.ACTIVE).exists():
        return True
    reviews = Review.objects.filter(user=user, product=product).exclude(status=Review.Status.REMOVED)
    if campaign.one_time_only:
        return reviews.exists()
    if not campaign.product_cooldown_days:
        return False
    return reviews.filter(created_at__gte=now - dt.timedelta(days=campaign.product_cooldown_days)).exists()


def _receipt_products(receipt) -> list[Product]:
    """Products on the receipt that are in a live review campaign: lines the
    rebate check matched, and every other line matched by name/alias to a
    brand that runs a review campaign."""
    live_brand_ids = set(
        ReviewCampaign.objects.filter(status=ReviewCampaign.Status.ACTIVE).values_list("brand_id", flat=True)
    )
    found, seen = [], set()
    brands = {b.id: b for b in Brand.objects.filter(id__in=live_brand_ids)}
    for line in receipt.line_items.all():
        candidates = [line.matched_product] if line.matched_product_id else [
            match_product(brand=brand, text=line.description) for brand in brands.values()
        ]
        for product in candidates:
            if product is not None and product.id not in seen and product.brand_id in live_brand_ids:
                seen.add(product.id)
                found.append(product)
    return found


@transaction.atomic
def create_opportunities(receipt) -> list[ReviewSession]:
    """Review opportunities for a verified rebate receipt. Ineligible
    products are skipped silently (never an error to the shopper)."""
    user, now = receipt.user, timezone.now()
    slots = settings.REVIEW_MAX_PER_RECEIPT - ReviewSession.objects.filter(receipt=receipt).count()
    created: list[ReviewSession] = []
    for product in _receipt_products(receipt):
        if len(created) >= slots:
            break
        campaign = next((c for c in product.review_campaigns.all() if c.is_live and not c.auto_paused), None)
        if campaign is None or _in_cooldown(user, product, campaign, now):
            continue
        today = timezone.localdate()
        if ReviewSession.objects.filter(review_campaign=campaign, created_at__date=today).count() >= campaign.daily_opportunities:
            continue
        reward, fee = reward_amount(), _fee(campaign)
        expires = now + dt.timedelta(days=settings.REVIEW_SESSION_DAYS)
        session = ReviewSession(
            review_campaign=campaign, product=product, user=user, receipt=receipt,
            reward_amount=reward, fee_amount=fee, expires_at=expires,
        )
        try:
            session.hold = wallet_services.place_hold(
                wallet=wallet_services.get_or_create_brand_wallet(campaign.brand),
                amount=reward + fee, reference_type="review_session", reference_id=receipt.id,
                expires_at=expires,
            )
        except wallet_services.InsufficientFunds:
            continue  # pause new opportunities only when funds run out
        session.save()
        created.append(session)
    return created


# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------
def _product_info(product) -> dict:
    info = {"name": product.name, "category": product.category or "", "description": product.description or ""}
    for field in ("flavor", "format", "size_volume"):
        if getattr(product, field, ""):
            info[field] = getattr(product, field)
    return info


def _fallback_questions(product, count) -> list[str]:
    name = product.name
    return [
        f"What made you choose {name}?",
        f"How would you describe {name} to a friend?",
        f"What did you like most about {name}?",
        f"Is there anything you'd change about {name}?",
        f"How did {name} compare with what you usually buy?",
    ][:count]


def _pick_brand_question(campaign: ReviewCampaign) -> str:
    prompt = campaign.prompts.order_by("times_used", "created_at").first()
    if prompt is None:
        return ""
    ReviewPrompt.objects.filter(pk=prompt.pk).update(times_used=F("times_used") + 1)
    return prompt.text


def start(session: ReviewSession) -> ReviewSession:
    """Plan the conversation on first open: product questions with the
    rotated brand question placed naturally in the middle, then the
    recommendation question. Asks the first question."""
    if session.questions:
        return session
    count = settings.REVIEW_PRODUCT_QUESTIONS
    try:
        product_questions = review_writer.suggest_questions(
            product_name=session.product.name, category=session.product.category or None, count=count,
        )[:count]
    except review_writer.ReviewWriterUnavailable:
        product_questions = _fallback_questions(session.product, count)
    brand_question = _pick_brand_question(session.review_campaign)
    questions = list(product_questions)
    if brand_question:
        questions.insert(min(2, len(questions)), brand_question)
    questions.append(RECOMMEND_QUESTION)
    session.questions = questions
    session.brand_question = brand_question
    session.messages = [{"role": "assistant", "content": questions[0]}]
    session.save(update_fields=["questions", "brand_question", "messages", "updated_at"])
    return session


def _qa_pairs(session: ReviewSession) -> list[tuple[str, str]]:
    pairs, question = [], None
    for message in session.messages:
        if message.get("role") == "assistant":
            question = message.get("content")
        elif message.get("role") == "user" and question:
            pairs.append((question, message.get("content", "")))
            question = None
    return pairs


def _require_open(session: ReviewSession) -> None:
    if session.status != ReviewSession.Status.ACTIVE:
        raise ReviewCampaignError("This review opportunity is no longer open.")
    if timezone.now() >= session.expires_at:
        raise ReviewCampaignError("This review opportunity has expired.")


def _write(session: ReviewSession) -> None:
    try:
        result = review_writer.write_review(
            product_name=session.product.name, category=session.product.category or None,
            description=session.product.description or None, qa_pairs=_qa_pairs(session),
        )
        session.ai_review_title = str(result["data"].get("title") or "")[:255]
        session.ai_review_content = str(result["data"].get("body") or "")
    except review_writer.ReviewWriterUnavailable:
        # Never dead-end: the shopper's own answers become the draft to edit.
        session.ai_review_title = ""
        session.ai_review_content = " ".join(a.strip() for _q, a in _qa_pairs(session) if a.strip())


def answer(session: ReviewSession, *, text: str) -> dict:
    """Record an answer; return the next question, or (when done) the
    AI-written draft for the shopper to edit and submit."""
    _require_open(session)
    start(session)
    text = str(text or "").strip()
    if not text:
        raise ReviewCampaignError("Type an answer or pick a suggestion.")
    session.messages.append({"role": "user", "content": text[:2000]})
    asked = sum(1 for m in session.messages if m.get("role") == "assistant")

    next_q = None
    if asked < len(session.questions):
        next_q = session.questions[asked]
        # Adaptive follow-ups once the AI endpoint exists (the brand and
        # recommendation questions stay as planned).
        if review_writer.adaptive_available() and next_q not in (session.brand_question, RECOMMEND_QUESTION):
            try:
                next_q = review_writer.next_question(
                    product=_product_info(session.product), conversation=session.messages,
                    brand_question=session.brand_question, questions_asked=asked,
                    total_questions=len(session.questions),
                ) or next_q
            except review_writer.ReviewWriterUnavailable:
                pass
    if next_q:
        session.messages.append({"role": "assistant", "content": next_q})
        session.save(update_fields=["messages", "updated_at"])
        return {"next_prompt": next_q, "done": False, "review": None, "title": None}
    _write(session)
    session.save(update_fields=["messages", "ai_review_title", "ai_review_content", "updated_at"])
    return {"next_prompt": None, "done": True, "review": session.ai_review_content, "title": session.ai_review_title}


def regenerate(session: ReviewSession) -> dict:
    """A fresh draft from the same answers (Master: regenerate)."""
    _require_open(session)
    if not _qa_pairs(session):
        raise ReviewCampaignError("Answer the questions first.")
    _write(session)
    session.save(update_fields=["ai_review_title", "ai_review_content", "updated_at"])
    return {"title": session.ai_review_title, "review": session.ai_review_content}


def _display_name(user) -> str:
    """First name + last initial (Master: Final Approval)."""
    parts = (user.full_name or "").split()
    if not parts:
        return "Verified shopper"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0].upper()}."


@transaction.atomic
def submit(session: ReviewSession, *, rating, content="", title="", would_recommend=None) -> Review:
    """Final approval: pay $1 now (every rating), then publish (4–5★) or
    hold for the brand response period (1–3★)."""
    session = ReviewSession.objects.select_for_update().get(pk=session.pk)
    _require_open(session)
    rating = int(rating)
    if not 1 <= rating <= 5:
        raise ReviewCampaignError("Rating must be between 1 and 5.")
    body = (content or "").strip() or session.ai_review_content
    if not body:
        raise ReviewCampaignError("Your review can't be empty.")

    _pay(session)
    now = timezone.now()
    publish = rating >= 4
    review = Review.objects.create(
        product=session.product, brand=session.review_campaign.brand, user=session.user,
        review_campaign=session.review_campaign, session=session,
        title=(title or session.ai_review_title or "")[:255], content=body, rating=rating,
        ai_generated=False, disclosure="Verified purchase. This shopper received a $1 reward for an honest review.",
        questions_and_answers=[{"question": q, "answer": a} for q, a in _qa_pairs(session)],
        would_recommend=would_recommend,
        status=Review.Status.PUBLISHED if publish else Review.Status.HELD,
        published_at=now if publish else None,
        held_until=None if publish else now + dt.timedelta(days=settings.REVIEW_HOLD_DAYS),
    )
    session.status = ReviewSession.Status.COMPLETED
    session.save(update_fields=["status", "updated_at"])
    if not publish:
        from Apps.notifications.brand import notify_brand

        notify_brand(
            review.brand, "low_rating_review",
            message=(
                f"A {rating}★ review of {review.product.name} is held until {review.held_until:%b %d, %Y}. "
                "Respond publicly or flag it for Nibbl in Review Management."
            ),
            reference_type="review", reference_id=review.id,
        )
    return review


def _pay(session: ReviewSession) -> None:
    brand_wallet = wallet_services.get_or_create_brand_wallet(session.review_campaign.brand)
    if session.hold_id and session.hold.status == Hold.Status.ACTIVE:
        wallet_services.capture_hold(
            hold=session.hold, amount=session.reward_amount, category=LedgerEntry.Category.REVIEW_REWARD,
            description="Review reward", idempotency_key=f"review-reward:{session.id}",
        )
    else:
        wallet_services.debit(
            wallet=brand_wallet, amount=session.reward_amount, category=LedgerEntry.Category.REVIEW_REWARD,
            reference_type="review_session", reference_id=session.id,
            idempotency_key=f"review-reward:{session.id}", real_only=True,
        )
    if session.fee_amount > ZERO:
        wallet_services.charge_eligible(
            wallet=brand_wallet, amount=session.fee_amount, category=LedgerEntry.Category.REVIEW_FEE,
            reference_type="review_session", reference_id=session.id, description="Review fee",
            idempotency_key=f"review-fee:{session.id}",
        )
    wallet_services.credit(
        wallet=wallet_services.get_or_create_customer_wallet(session.user), amount=session.reward_amount,
        category=LedgerEntry.Category.REVIEW_REWARD, reference_type="review_session", reference_id=session.id,
        description="Review reward", idempotency_key=f"review-customer:{session.id}",
    )


# ---------------------------------------------------------------------------
# Moderation (brand + Nibbl)
# ---------------------------------------------------------------------------
def _audit(review, action, actor, **meta) -> None:
    AuditLog.objects.create(
        action=action, actor_type="admin" if getattr(actor, "is_platform_admin", False) else "brand_user",
        actor_id=str(actor.id) if actor else "", target_type="review", target_id=str(review.id), metadata=meta,
    )


def respond(review: Review, *, text: str, actor) -> Review:
    text = (text or "").strip()
    if not text:
        raise ReviewCampaignError("Enter your response.")
    review.brand_response = text[:2000]
    review.brand_response_at = timezone.now()
    review.save(update_fields=["brand_response", "brand_response_at", "updated_at"])
    _audit(review, AuditLog.Action.UPDATE, actor, event="brand_response")
    return review


def flag(review: Review, *, reason: str, note: str = "", actor) -> Review:
    if review.status not in (Review.Status.HELD, Review.Status.PUBLISHED):
        raise ReviewCampaignError("This review can't be flagged.")
    if reason not in FLAG_REASONS:
        raise ReviewCampaignError("Choose a removal reason.")
    review.status = Review.Status.FLAGGED
    review.flag_reason, review.flag_note, review.flagged_at = reason, (note or "")[:500], timezone.now()
    review.save(update_fields=["status", "flag_reason", "flag_note", "flagged_at", "updated_at"])
    _audit(review, AuditLog.Action.UPDATE, actor, event="flagged", reason=reason, note=note)
    return review


def decide_flag(review: Review, *, remove: bool, admin, note: str = "") -> Review:
    """Nibbl's decision on a brand flag: remove, or keep (publish)."""
    if review.status != Review.Status.FLAGGED:
        raise ReviewCampaignError("This review isn't waiting for a decision.")
    review.status = Review.Status.REMOVED if remove else Review.Status.PUBLISHED
    if not remove and review.published_at is None:
        review.published_at = timezone.now()
    review.save(update_fields=["status", "published_at", "updated_at"])
    _audit(review, AuditLog.Action.APPROVE if remove else AuditLog.Action.REJECT, admin,
           event="flag_decision", removed=remove, note=note)
    return review


def release_held(now=None) -> int:
    """1–3★ reviews publish when their 7-day response period ends (unless
    the brand flagged them — those wait for Nibbl)."""
    now = now or timezone.now()
    return Review.objects.filter(status=Review.Status.HELD, held_until__lte=now).update(
        status=Review.Status.PUBLISHED, published_at=now, updated_at=now
    )


def expire_sessions(now=None) -> int:
    """Unfinished opportunities expire after 30 days, releasing the reserve."""
    now = now or timezone.now()
    count = 0
    for session in ReviewSession.objects.filter(status=ReviewSession.Status.ACTIVE, expires_at__lte=now).select_related("hold"):
        with transaction.atomic():
            session.status = ReviewSession.Status.EXPIRED
            session.save(update_fields=["status", "updated_at"])
            if session.hold_id and session.hold.status == Hold.Status.ACTIVE:
                wallet_services.release_hold(hold=session.hold)
        count += 1
    return count
