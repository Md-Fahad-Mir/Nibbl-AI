"""Notification delivery for verification codes.

In dev, EMAIL_BACKEND is the console backend, so emails print to the runserver
output. SMS has no provider yet (no Celery/Twilio per the M0 decision); phone
codes are logged so they can be read during local development. Both functions
are the seam where real email/SMS providers get plugged in later.
"""

import logging

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

SHOPPER_ACCENT = "#3E3EDF"
BRAND_ACCENT = "#001BD2"


def branded_html(subject: str, *, heading: str, intro: str, accent: str = SHOPPER_ACCENT, **extra) -> str:
    """The branded HTML version of an email; the plain-text body stays the fallback."""
    context = {"subject": subject, "heading": heading, "intro": intro, "accent": accent,
               "preheader": extra.pop("preheader", intro), **extra}
    return render_to_string("emails/layout.html", context)


def send_email_code(*, to_email: str, code: str, purpose_label: str) -> None:
    subject = f"NibblAI: your {purpose_label} code"
    body = (
        f"Your {purpose_label} code is: {code}\n\n"
        "It expires shortly. If you didn't request this, you can ignore it."
    )
    try:
        send_mail(
            subject,
            body,
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@nibblai.app"),
            [to_email],
            fail_silently=False,
            html_message=branded_html(
                subject, heading=f"Your {purpose_label} code",
                intro="Enter this code to continue. It expires shortly.",
                code=code, preheader=f"Your code is {code}",
                note="If you didn't request this, you can safely ignore this email.",
            ),
        )
    except Exception as exc:
        logger.error(
            "Failed to send %s code email to %s: %s",
            purpose_label,
            to_email,
            exc,
            exc_info=True,
        )


def send_email_link(*, to_email: str, url: str) -> None:
    """Brand signup: verify the work email through a secure one-time link."""
    subject = "NibblAI: verify your work email"
    body = (
        "Confirm your work email to finish setting up your brand account:\n\n"
        f"{url}\n\n"
        "This link works once and expires in 15 minutes. "
        "If you didn't sign up, you can ignore this email."
    )
    try:
        send_mail(
            subject,
            body,
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@nibblai.app"),
            [to_email],
            fail_silently=False,
            html_message=branded_html(
                subject, heading="Verify your work email", accent=BRAND_ACCENT,
                intro="Confirm your work email to finish setting up your brand account.",
                button_label="Verify email", button_url=url,
                note="This link works once and expires in 15 minutes. "
                     "If you didn't sign up, you can ignore this email.",
            ),
        )
    except Exception as exc:
        logger.error("Failed to send verification link to %s: %s", to_email, exc, exc_info=True)


def send_sms_code(*, to_phone: str, code: str, purpose_label: str) -> None:
    # TODO(integration): replace with Twilio Verify when SMS is wired up.
    logger.info("SMS %s code for %s: %s", purpose_label, to_phone, code)


def send_referral_invite(
    *, to_email: str, friend_name: str, inviter_name: str, referral_code: str
) -> None:
    """Email a friend an invite carrying the inviter's referral code."""
    base_url = getattr(settings, "PUBLIC_BASE_URL", "http://localhost:8000")
    signup_url = f"{base_url.rstrip('/')}/r/{referral_code}"
    greeting = f"Hi {friend_name}," if friend_name else "Hi,"
    subject = f"{inviter_name} invited you to NibblAI"
    body = (
        f"{greeting}\n\n"
        f"{inviter_name} thinks you'll love NibblAI — upload receipts, earn cash.\n\n"
        f"Sign up with their referral code {referral_code}:\n{signup_url}\n"
    )
    try:
        send_mail(
            subject,
            body,
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@nibblai.app"),
            [to_email],
            fail_silently=False,
            html_message=branded_html(
                subject, heading=f"{inviter_name} invited you to Nibbl", greeting=greeting,
                intro=f"{inviter_name} thinks you'll love Nibbl — upload receipts, earn cash. "
                      f"Sign up with their referral code {referral_code}.",
                button_label="Join Nibbl", button_url=signup_url,
            ),
        )
    except Exception as exc:
        logger.error(
            "Failed to send referral invite email to %s: %s",
            to_email,
            exc,
            exc_info=True,
        )


def send_magic_link(*, to_email: str, url: str) -> None:
    """Passwordless brand sign-in link (works once, 15 minutes)."""
    subject = "Nibbl: your secure sign-in link"
    try:
        send_mail(
            subject,
            "Use this secure link to sign in to your Nibbl brand workspace:\n\n"
            f"{url}\n\nThe link works once and expires in 15 minutes. "
            "If you didn't ask to sign in, you can ignore this email.",
            getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@nibblai.app"),
            [to_email],
            fail_silently=False,
            html_message=branded_html(
                subject, heading="Sign in to Nibbl", accent=BRAND_ACCENT,
                intro="Use this secure link to sign in to your Nibbl brand workspace.",
                button_label="Sign in", button_url=url,
                note="The link works once and expires in 15 minutes. "
                     "If you didn't ask to sign in, you can ignore this email.",
            ),
        )
    except Exception as exc:
        logger.error("Failed to send sign-in link to %s: %s", to_email, exc, exc_info=True)
