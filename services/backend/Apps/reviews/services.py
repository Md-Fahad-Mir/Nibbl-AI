"""Reviews business logic: AI-generated product reviews + reward issuance."""

from __future__ import annotations

from django.conf import settings
from django.db import IntegrityError, transaction

from Apps.common.exceptions import DomainError
from Apps.common.money import to_money
from Apps.reviews import review_writer
from Apps.reviews.models import Review
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class ReviewError(DomainError):
    """Expected, user-facing review errors (mapped to HTTP 400)."""


class DuplicateReview(ReviewError):
    """This user has already reviewed this product (mapped to HTTP 409)."""


class ReviewGenerationUnavailable(ReviewError):
    """The AI review-writing service is down or unconfigured (HTTP 503)."""


class RewardUnavailable(ReviewError):
    """The reviewed product's brand wallet can't cover the reward (HTTP 503)."""


def _product_attributes(product) -> dict[str, str]:
    """Extra product context worth telling the AI writer about."""
    attrs = {}
    for field in ("flavor", "format", "size_volume"):
        value = (getattr(product, field, "") or "").strip()
        if value:
            attrs[field] = value
    if product.brand_id:
        attrs["brand"] = product.brand.name
    return attrs


@transaction.atomic
def generate_and_submit_review(
    *, user, product, answers: list[tuple[str, str]], rating: int | None = None
) -> Review:
    """Generate a review for ``product`` from the user's Q&A, save it, and
    pay the flat per-review reward exactly once.

    ``answers`` is the ordered (question, answer) pairs the frontend
    collected after calling the AI service's own ``/reviews/questions``
    endpoint directly and showing them to the user — this backend never
    generates questions itself, only reviews.

    Reward is issued only when a review is actually created: a duplicate
    (user, product) is rejected before any AI call or money moves, and the
    whole operation is one transaction, so a failed reward debit rolls the
    review back too rather than leaving an unpaid review on record.
    """
    if Review.objects.filter(user=user, product=product).exists():
        raise DuplicateReview("You have already reviewed this product.")
    if not answers:
        raise ReviewError("At least one answered question is required.")

    try:
        result = review_writer.write_review(
            product_name=product.name,
            category=product.category or None,
            description=product.description or None,
            attributes=_product_attributes(product),
            qa_pairs=answers,
            rating=rating,
        )
    except review_writer.ReviewWriterUnavailable as exc:
        raise ReviewGenerationUnavailable(str(exc))

    data = result["data"]
    review_rating = data.get("rating")
    try:
        review = Review.objects.create(
            user=user,
            product=product,
            brand=product.brand,
            title=str(data.get("title") or ""),
            content=str(data.get("body") or ""),
            rating=int(review_rating) if review_rating else (rating or 3),
            ai_generated=bool(data.get("ai_generated", True)),
            disclosure=str(data.get("disclosure") or ""),
            questions_and_answers=[
                {"question": q, "answer": a} for q, a in answers
            ],
            ai_raw_response=result["raw"],
        )
    except IntegrityError:
        # Closes the check-then-insert race between two concurrent
        # submissions for the same (user, product) that both passed the
        # existence check above before either had inserted.
        raise DuplicateReview("You have already reviewed this product.")

    _issue_review_reward(review)
    return review


def _issue_review_reward(review: Review) -> None:
    """Pay the flat per-review reward from the product's brand wallet to the
    reviewer's wallet.

    Idempotent on ``review.id``: since each Review row is created at most
    once per (user, product) and this is only ever called once per newly
    created row, a retried request can never pay (or debit) twice — the
    idempotency key guards a retry of this exact call, and
    wallet_services.credit/debit return the original ledger entry instead of
    creating a second one when the key repeats.
    """
    reward = to_money(settings.REVIEW_REWARD_AMOUNT)
    brand_wallet = wallet_services.get_or_create_brand_wallet(review.brand)
    customer_wallet = wallet_services.get_or_create_customer_wallet(review.user)

    try:
        wallet_services.debit(
            wallet=brand_wallet, amount=reward,
            category=LedgerEntry.Category.REVIEW_REWARD,
            reference_type="review", reference_id=review.id,
            description="Review reward",
            idempotency_key=f"review-reward-debit:{review.id}",
        )
    except wallet_services.InsufficientFunds as exc:
        raise RewardUnavailable(str(exc))

    wallet_services.credit(
        wallet=customer_wallet, amount=reward,
        category=LedgerEntry.Category.REVIEW_REWARD,
        reference_type="review", reference_id=review.id,
        description="Review reward",
        idempotency_key=f"review-reward-credit:{review.id}",
    )
