"""Client for the Receipt Intelligence API's review-writing endpoint.

Turns a reviewer's own Q&A answers (collected in ``ReviewSession.messages``)
into prose, by posting them to the same AI microservice that does receipt OCR
(see ``Apps.receipts.ocr`` for the sibling seam). The base URL and key come
from settings (``REVIEW_AI_API_URL`` / ``REVIEW_AI_API_KEY``) — never
hardcoded here.

The provider's contract (``POST {base}/api/v1/reviews/generate``) is::

    {
      "success": bool,
      "data": {"title": str, "body": str, "rating": int, ...},
      ...
    }

Answers are what makes the review *grounded* on the provider's side (its
``ai_generated`` flag comes back false only when ``answers`` is non-empty),
so every call here includes them.
"""

from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


class ReviewWriterUnavailable(Exception):
    """The review-writing service is unreachable, timed out, or unconfigured.

    Callers fall back to stitching the reviewer's own answers together rather
    than blocking the reviewer on an external call.
    """


def _base_url() -> str:
    return (getattr(settings, "REVIEW_AI_API_URL", "") or "").strip().rstrip("/")


def is_configured() -> bool:
    return bool(_base_url())


def write_review(
    *,
    product_name: str,
    product_context: str = "",
    qa_pairs: list[tuple[str, str]],
    language: str = "English",
) -> dict:
    """POST the reviewer's Q&A to the review-writing service.

    ``qa_pairs`` is the ordered (question, answer) pairs collected over the
    session's chat. Returns ``{"title": str, "body": str, "rating": int | None}``.

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
    context = (product_context or "").strip()
    if context:
        payload["description"] = context[:2000]

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

    rating = data.get("rating")
    return {
        "title": str(data.get("title") or ""),
        "body": str(data["body"]),
        "rating": int(rating) if isinstance(rating, (int, float)) else None,
    }
