"""Twilio Verify integration for SMS code verification.

Isolated behind this module so services and tests patch these two functions.
Raises TwilioNotConfigured until the Twilio env vars are set (so the app runs
fine without it, and callers can return a clear "unavailable" response).
"""

from __future__ import annotations

import httpx
from django.conf import settings

_BASE = "https://verify.twilio.com/v2/Services"


class TwilioNotConfigured(Exception):
    """Twilio Verify credentials are missing for this environment."""


def _config():
    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    service = settings.TWILIO_VERIFY_SERVICE_SID
    if not (sid and token and service):
        raise TwilioNotConfigured("Twilio Verify is not configured.")
    return sid, token, service


def start_verification(phone: str) -> None:
    """Send an SMS verification code to ``phone`` via Twilio Verify."""
    sid, token, service = _config()
    resp = httpx.post(
        f"{_BASE}/{service}/Verifications",
        data={"To": phone, "Channel": "sms"},
        auth=(sid, token),
        timeout=15,
    )
    resp.raise_for_status()


def check_verification(phone: str, code: str) -> bool:
    """Return True only if ``code`` is the valid, current code for ``phone``."""
    sid, token, service = _config()
    resp = httpx.post(
        f"{_BASE}/{service}/VerificationCheck",
        data={"To": phone, "Code": code},
        auth=(sid, token),
        timeout=15,
    )
    if resp.status_code >= 400:
        return False
    return resp.json().get("status") == "approved"
