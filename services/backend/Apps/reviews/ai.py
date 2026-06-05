"""AI prompt generation seam (Claude, ChatGPT, Google Studio).

`generate_prompts` returns conversational review prompts based on brand-supplied
product data. It checks which API key is configured in settings and uses the corresponding
service: Anthropic (Claude), OpenAI (ChatGPT), or Google Generative AI (Gemini/Google Studio).
If no API key is provided, it falls back to a deterministic mock.
"""

from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def _mock_prompts(product_name: str, count: int) -> list[str]:
    base = [
        f"What did you think of {product_name}?",
        f"How would you describe the quality of {product_name}?",
        f"What stood out most about {product_name}?",
        f"Would you buy {product_name} again? Why or why not?",
        f"Who would you recommend {product_name} to?",
    ]
    return base[:count]


def _generate_with_claude(*, product_name, product_context, count, api_key) -> list[str]:
    from anthropic import Anthropic

    client = Anthropic(api_key=api_key)
    system = (
        "You generate short, friendly, open-ended prompts for a chat-based "
        "product review. Return exactly one prompt per line, no numbering."
    )
    user = (
        f"Product: {product_name}\n"
        f"Context: {product_context or 'n/a'}\n"
        f"Generate {count} prompts."
    )
    message = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=512,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(block.text for block in message.content if block.type == "text")
    prompts = [line.strip(" -•\t") for line in text.splitlines() if line.strip()]
    return prompts[:count] or _mock_prompts(product_name, count)


def _generate_with_openai(*, product_name, product_context, count, api_key) -> list[str]:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    system = (
        "You generate short, friendly, open-ended prompts for a chat-based "
        "product review. Return exactly one prompt per line, no numbering."
    )
    user = (
        f"Product: {product_name}\n"
        f"Context: {product_context or 'n/a'}\n"
        f"Generate {count} prompts."
    )
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        max_tokens=512,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
    )
    text = response.choices[0].message.content or ""
    prompts = [line.strip(" -•\t") for line in text.splitlines() if line.strip()]
    return prompts[:count] or _mock_prompts(product_name, count)


def _generate_with_gemini(*, product_name, product_context, count, api_key) -> list[str]:
    from google import genai

    client = genai.Client(api_key=api_key)
    prompt = (
        "System Instruction: You generate short, friendly, open-ended prompts for a chat-based "
        "product review. Return exactly one prompt per line, no numbering.\n\n"
        f"Product: {product_name}\n"
        f"Context: {product_context or 'n/a'}\n"
        f"Generate {count} prompts."
    )
    response = client.models.generate_content(
        model=settings.GOOGLE_MODEL,
        contents=prompt,
    )
    text = response.text or ""
    prompts = [line.strip(" -•\t") for line in text.splitlines() if line.strip()]
    return prompts[:count] or _mock_prompts(product_name, count)


def generate_prompts(*, product_name: str, product_context: str = "", count: int = 4) -> list[str]:
    # 1. Claude
    if settings.ANTHROPIC_API_KEY:
        try:
            return _generate_with_claude(
                product_name=product_name, product_context=product_context,
                count=count, api_key=settings.ANTHROPIC_API_KEY,
            )
        except Exception:
            logger.exception("Claude prompt generation failed; trying next configured AI provider.")

    # 2. ChatGPT (OpenAI)
    if settings.OPENAI_API_KEY:
        try:
            return _generate_with_openai(
                product_name=product_name, product_context=product_context,
                count=count, api_key=settings.OPENAI_API_KEY,
            )
        except Exception:
            logger.exception("ChatGPT prompt generation failed; trying next configured AI provider.")

    # 3. Google Studio (Gemini)
    google_key = settings.GOOGLE_STUDIO_API_KEY or settings.GOOGLE_AI_API_KEY
    if google_key:
        try:
            return _generate_with_gemini(
                product_name=product_name, product_context=product_context,
                count=count, api_key=google_key,
            )
        except Exception:
            logger.exception("Google Studio prompt generation failed; falling back to mock prompts.")

    return _mock_prompts(product_name, count)
