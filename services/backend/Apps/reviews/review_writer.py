"""Client for the AI service's review-generation endpoint.

Turns a user's own Q&A answers about a product into a finished review, by
posting them to the same independently-deployed AI microservice that does
receipt OCR (see ``Apps.receipts.ocr`` for the sibling seam; production:
``https://api.joinnibbl.com/ai``). The base URL and key come from settings
(``REVIEW_AI_API_URL`` / ``REVIEW_AI_API_KEY``) — never hardcoded here. This
module only consumes that service's documented response shape; it makes no
changes to the AI service's own code, API, or deployment.

Question generation is NOT handled here: the frontend calls the AI service's
``/reviews/questions`` endpoint directly and collects the user's answers, so
this backend only ever sees the finished (question, answer) pairs.

The provider's contract (``POST {base}/api/v1/reviews/generate``) is::

    {
      "success": bool,
      "data": {"title": str, "body": str, "rating": int,
                "ai_generated": bool, "disclosure": str, ...},
      ...
    }

Answers are what makes the review *grounded* on the provider's side (its
``ai_generated`` flag comes back false only when ``answers`` is non-empty),
so a call is only made once at least one answer has been collected.
"""

from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class ReviewWriterUnavailable(Exception):
    """The review-writing service is unreachable, timed out, unconfigured,
    or returned something unusable.

    Callers must not save a review or issue a reward when this is raised —
    unlike the OCR seam, there is no safe fallback for a review that wasn't
    actually written by the AI service.
    """


def _base_url() -> str:
    return (getattr(settings, "REVIEW_AI_API_URL", "") or "").strip().rstrip("/")


def is_configured() -> bool:
    return bool(_base_url())


def write_review(
    *,
    product_name: str,
    category: str | None = None,
    description: str | None = None,
    attributes: dict[str, str] | None = None,
    qa_pairs: list[tuple[str, str]],
    rating: int | None = None,
    language: str = "English",
) -> dict:
    """POST product information + the user's Q&A to the review-generation service.

    ``qa_pairs`` is the ordered (question, answer) pairs the frontend
    collected after calling the AI service's ``/reviews/questions`` endpoint
    directly and showing them to the user.

    Returns ``{"data": {...GeneratedReview fields...}, "raw": {...full envelope...}}``.
    Raises ReviewWriterUnavailable if the service can't produce a review.
    """
    base = _base_url()
    if not base:
        raise ReviewWriterUnavailable("The review-writing service is not configured.")

    try:
        import httpx
    except ImportError as exc:  # pragma: no cover - dependency is installed
        raise ReviewWriterUnavailable("The review-writing client is unavailable.") from exc

    path = getattr(settings, "REVIEW_AI_GENERATE_PATH", "/api/v1/reviews/generate")
    url = f"{base}/{path.lstrip('/')}"

    headers = {}
    api_key = (getattr(settings, "REVIEW_AI_API_KEY", "") or "").strip()
    if api_key:
        headers["X-API-Key"] = api_key

    payload = {
        "product_name": product_name[:200],
        "answers": [
            {"question": q[:500], "answer": a[:2000]} for q, a in qa_pairs if a and a.strip()
        ],
        "language": language,
    }
    category = (category or "").strip()
    if category:
        payload["category"] = category[:100]
    description = (description or "").strip()
    if description:
        payload["description"] = description[:2000]
    if attributes:
        payload["attributes"] = {str(k): str(v) for k, v in attributes.items() if v}
    if rating is not None:
        payload["rating"] = int(rating)

    try:
        resp = httpx.post(
            url,
            json=payload,
            headers=headers,
            timeout=getattr(settings, "REVIEW_AI_TIMEOUT", 30.0),
        )
    except Exception as exc:  # noqa: BLE001 - network/timeout => unavailable
        logger.warning("Review-writing request failed: %s", exc)
        raise ReviewWriterUnavailable("The review-writing service is unavailable.") from exc

    if resp.status_code >= 400:
        logger.warning("Review-writing service returned HTTP %s", resp.status_code)
        raise ReviewWriterUnavailable("The review-writing service is unavailable.")

    try:
        body = resp.json()
    except Exception as exc:  # noqa: BLE001 - malformed JSON
        raise ReviewWriterUnavailable(
            "The review-writing service returned an invalid response."
        ) from exc

    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, dict) or not data.get("body"):
        raise ReviewWriterUnavailable("The review-writing service returned no review text.")

    return {"data": data, "raw": body}
