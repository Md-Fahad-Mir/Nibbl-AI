"""Business logic for the accounts app.

Views stay thin and delegate here. All multi-step / stateful operations
(registration, code issuance, verification, password reset) live in this layer
so they can be unit-tested and reused independent of HTTP.
"""

from __future__ import annotations

import datetime as dt

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from Apps.accounts import emails
from django.contrib.auth.hashers import make_password
from Apps.accounts.models import (
    User,
    VerificationCode,
    generate_numeric_code,
    PendingUser,
)
from Apps.accounts.signals import email_verified
from Apps.accounts.selectors import (
    get_active_user_by_email,
    get_user_by_referral_code,
)
from Apps.common.models import AuditLog

CODE_TTL = dt.timedelta(minutes=15)

_PURPOSE_LABEL = {
    VerificationCode.Purpose.EMAIL_VERIFY: "email verification",
    VerificationCode.Purpose.PHONE_VERIFY: "phone verification",
    VerificationCode.Purpose.PASSWORD_RESET: "password reset",
}


class AccountError(Exception):
    """Raised for expected, user-facing account errors (mapped to HTTP 400)."""


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------
def issue_tokens(user: User, *, remember_me: bool = False) -> dict:
    """Return an access/refresh token pair, honoring the remember-me window."""
    refresh = RefreshToken.for_user(user)
    if remember_me:
        lifetime = settings.SIMPLE_JWT.get(
            "REFRESH_TOKEN_REMEMBER_LIFETIME", dt.timedelta(days=30)
        )
        refresh.set_exp(lifetime=lifetime)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


# ---------------------------------------------------------------------------
# Verification codes
# ---------------------------------------------------------------------------
def _issue_code(user: User, purpose: str, destination: str) -> VerificationCode:
    # Invalidate any outstanding codes for this purpose before issuing a new one.
    VerificationCode.objects.filter(
        user=user, purpose=purpose, consumed_at__isnull=True
    ).update(consumed_at=timezone.now())

    return VerificationCode.objects.create(
        user=user,
        purpose=purpose,
        code=generate_numeric_code(),
        destination=destination,
        expires_at=timezone.now() + CODE_TTL,
    )


def _verify_code(user: User, purpose: str, code: str) -> VerificationCode:
    record = (
        VerificationCode.objects.filter(
            user=user, purpose=purpose, consumed_at__isnull=True
        )
        .order_by("-created_at")
        .first()
    )
    if record is None or record.code != code or not record.is_valid():
        raise AccountError("Invalid or expired code.")
    record.consume()
    return record


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------
@transaction.atomic
def register_user(
    *,
    full_name: str,
    email: str,
    password: str,
    role: str = User.Role.CONSUMER,
    referral_code: str | None = None,
) -> PendingUser:
    # Self-registration can never grant platform-admin access.
    if role == User.Role.ADMIN:
        raise AccountError("Invalid role for registration.")
    if User.objects.filter(email__iexact=email, is_deleted=False).exists():
        raise AccountError("A user with this email already exists.")

    PendingUser.objects.filter(email__iexact=email).delete()

    code = generate_numeric_code()
    expires_at = timezone.now() + CODE_TTL

    pending = PendingUser.objects.create(
        email=email.lower(),
        password=make_password(password),
        full_name=full_name,
        role=role,
        referral_code=referral_code,
        verification_code=code,
        expires_at=expires_at,
    )

    emails.send_email_code(
        to_email=pending.email,
        code=pending.verification_code,
        purpose_label="email verification",
    )

    return pending


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------
def start_email_verification(user: User) -> None:
    code = _issue_code(user, VerificationCode.Purpose.EMAIL_VERIFY, user.email)
    emails.send_email_code(
        to_email=user.email,
        code=code.code,
        purpose_label=_PURPOSE_LABEL[VerificationCode.Purpose.EMAIL_VERIFY],
    )


def resend_email_verification(*, email: str) -> None:
    pending = PendingUser.objects.filter(email__iexact=email).first()
    if pending:
        pending.verification_code = generate_numeric_code()
        pending.expires_at = timezone.now() + CODE_TTL
        pending.save(update_fields=["verification_code", "expires_at", "updated_at"])

        emails.send_email_code(
            to_email=pending.email,
            code=pending.verification_code,
            purpose_label="email verification",
        )


@transaction.atomic
def verify_email(*, email: str, code: str) -> User:
    pending = PendingUser.objects.filter(email__iexact=email).first()
    if pending is None:
        user = get_active_user_by_email(email)
        if user and user.is_email_verified:
            return user
        raise AccountError("Invalid or expired code.")

    if pending.verification_code != code or pending.is_expired:
        raise AccountError("Invalid or expired code.")

    referred_by = None
    if pending.referral_code:
        referred_by = get_user_by_referral_code(pending.referral_code)

    # Brand accounts need admin approval before they can log in.
    needs_approval = pending.role == User.Role.BRAND

    user = User(
        email=pending.email,
        password=pending.password,
        full_name=pending.full_name,
        role=pending.role,
        is_email_verified=True,
        is_approved=not needs_approval,
        referred_by=referred_by,
        accepted_terms_at=timezone.now(),
    )
    user.save()

    pending.delete()

    AuditLog.objects.create(
        action=AuditLog.Action.CREATE,
        actor_type="user",
        actor_id=str(user.id),
        target_type="user",
        target_id=str(user.id),
        metadata={"event": "register", "referred": bool(referred_by)},
    )

    email_verified.send(sender=User, user=user)
    return user


# ---------------------------------------------------------------------------
# Phone verification
# ---------------------------------------------------------------------------
def normalize_phone(raw: str, country: str | None = None) -> str:
    """Validate a mobile number from any country and return it in E.164 form
    (e.g. +8801712345678). Give either a full international number (+880…)
    or a local number plus its ISO ``country`` (e.g. "01712…" + "BD"), so
    each country's own rules — like a leading 0 — are applied. Numbers that
    can't receive SMS — landlines, toll-free, premium-rate (a common
    SMS-fraud vector) — are rejected."""
    import phonenumbers
    from phonenumbers import PhoneNumberType as T

    value = str(raw or "").strip()
    if value.startswith("00"):
        value = "+" + value[2:]
    region = (country or "").strip().upper() or None
    if not value.startswith("+") and region is None:
        raise AccountError("Include your country code, e.g. +1 (US) or +44 (UK).")
    try:
        number = phonenumbers.parse(value, None if value.startswith("+") else region)
    except phonenumbers.NumberParseException:
        raise AccountError("Enter a valid mobile number.")
    if not phonenumbers.is_valid_number(number):
        raise AccountError("Enter a valid mobile number.")
    if phonenumbers.number_type(number) in {
        T.FIXED_LINE, T.TOLL_FREE, T.PREMIUM_RATE, T.SHARED_COST,
        T.PAGER, T.UAN, T.VOICEMAIL,
    }:
        raise AccountError("That number can't receive text messages. Use a mobile number.")
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


def start_phone_verification(user: User, *, phone: str, country: str = "") -> None:
    from Apps.accounts import twilio_verify

    phone = normalize_phone(phone, country)
    if (
        User.objects.filter(phone=phone, is_deleted=False)
        .exclude(pk=user.pk)
        .exists()
    ):
        raise AccountError("That phone number is already in use.")

    user.phone = phone
    user.is_phone_verified = False
    user.save(update_fields=["phone", "is_phone_verified", "updated_at"])

    if twilio_verify.is_configured():
        # Twilio Verify generates, sends, expires and rate-limits the code.
        try:
            twilio_verify.start_verification(phone)
        except Exception:
            raise AccountError("We couldn't send a code to that number. Check it and try again.")
        return

    # No SMS provider (dev/staging): issue our own code; it's logged, not sent.
    code = _issue_code(user, VerificationCode.Purpose.PHONE_VERIFY, phone)
    emails.send_sms_code(
        to_phone=phone,
        code=code.code,
        purpose_label=_PURPOSE_LABEL[VerificationCode.Purpose.PHONE_VERIFY],
    )


def verify_phone(user: User, *, code: str) -> User:
    from Apps.accounts import twilio_verify

    if not user.phone:
        raise AccountError("Add a phone number first.")
    if twilio_verify.is_configured():
        if not twilio_verify.check_verification(user.phone, code):
            raise AccountError("Invalid or expired code.")
    else:
        _verify_code(user, VerificationCode.Purpose.PHONE_VERIFY, code)

    now = timezone.now()
    fields = ["is_phone_verified", "phone_verified_at", "last_verified_phone", "updated_at"]
    # Verifying a different number than the last verified one is a phone
    # change: pause withdrawals (account-takeover guard).
    if user.last_verified_phone and user.last_verified_phone != user.phone:
        user.withdrawals_paused_until = now + dt.timedelta(
            hours=settings.PHONE_CHANGE_WITHDRAWAL_PAUSE_HOURS
        )
        fields.append("withdrawals_paused_until")
    user.is_phone_verified = True
    user.phone_verified_at = now
    user.last_verified_phone = user.phone
    user.save(update_fields=fields)
    return user


@transaction.atomic
def reset_phone(*, user: User, admin: User, reason: str = "") -> User:
    """Admin: clear a shopper's phone (e.g. lost phone) so they can add a new
    one. The next number they verify counts as a change (48h pause)."""
    user.phone = None
    user.is_phone_verified = False
    user.save(update_fields=["phone", "is_phone_verified", "updated_at"])
    AuditLog.objects.create(
        action=AuditLog.Action.UPDATE,
        actor_type="admin",
        actor_id=str(admin.id),
        target_type="user",
        target_id=str(user.id),
        metadata={"event": "phone_reset", "reason": reason},
    )
    return user


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------
def login(*, email: str, password: str, remember_me: bool = False) -> dict:
    user = authenticate(username=email, password=password)
    if user is None or not user.is_active or user.is_deleted:
        raise AccountError("Invalid email or password.")
    if not user.is_email_verified:
        raise AccountError("Email address is not verified.")
    if not user.is_approved:
        raise AccountError(
            "Your account is pending admin approval. "
            "You will be notified once it is approved."
        )

    AuditLog.objects.create(
        action=AuditLog.Action.LOGIN,
        actor_type="user",
        actor_id=str(user.id),
        target_type="user",
        target_id=str(user.id),
    )
    tokens = issue_tokens(user, remember_me=remember_me)
    return {"user": user, "tokens": tokens}



# ---------------------------------------------------------------------------
# Password management
# ---------------------------------------------------------------------------
def request_password_reset(*, email: str) -> None:
    user = get_active_user_by_email(email)
    # Do not reveal whether the email exists (enumeration protection).
    if user is None:
        return
    code = _issue_code(user, VerificationCode.Purpose.PASSWORD_RESET, user.email)
    emails.send_email_code(
        to_email=user.email,
        code=code.code,
        purpose_label=_PURPOSE_LABEL[VerificationCode.Purpose.PASSWORD_RESET],
    )


def reset_password(*, email: str, code: str, new_password: str) -> None:
    user = get_active_user_by_email(email)
    if user is None:
        raise AccountError("Invalid or expired code.")
    _verify_code(user, VerificationCode.Purpose.PASSWORD_RESET, code)
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])


def change_password(user: User, *, current_password: str, new_password: str) -> None:
    if not user.check_password(current_password):
        raise AccountError("Current password is incorrect.")
    user.set_password(new_password)
    user.save(update_fields=["password", "updated_at"])


# ---------------------------------------------------------------------------
# Account deletion
# ---------------------------------------------------------------------------
def delete_account(user: User) -> None:
    """Soft-delete: deactivate and free up the email/phone for reuse."""
    user.is_active = False
    user.is_deleted = True
    user.deleted_at = timezone.now()
    # Release unique identifiers so the person can sign up again later.
    user.email = f"deleted+{user.id}@nibblai.invalid"
    user.phone = None
    user.save(
        update_fields=[
            "is_active",
            "is_deleted",
            "deleted_at",
            "email",
            "phone",
            "updated_at",
        ]
    )
    AuditLog.objects.create(
        action=AuditLog.Action.DELETE,
        actor_type="user",
        actor_id=str(user.id),
        target_type="user",
        target_id=str(user.id),
        metadata={"event": "account_deletion"},
    )


# ---------------------------------------------------------------------------
# Social login (scaffold — provider verification wired up during integration)
# ---------------------------------------------------------------------------
def social_login(*, provider: str, token: str) -> dict:
    raise AccountError(
        f"Social login via {provider} is not yet configured on this environment."
    )


# ---------------------------------------------------------------------------
# Referral invites
# ---------------------------------------------------------------------------
def send_referral_invite(*, inviter: User, full_name: str, contact: str) -> dict:
    """Send a referral invite by email. Phone/SMS is gated until Twilio is wired.

    Always reports success without revealing whether the contact is already a
    registered user (enumeration protection). Blocks self-invites.
    """
    contact = contact.strip()
    is_email = "@" in contact

    if not is_email:
        # Phone path requires SMS (Twilio), which isn't integrated yet.
        raise AccountError("Phone invites aren't available yet — use an email address.")

    if contact.lower() == (inviter.email or "").lower():
        raise AccountError("You can't invite yourself.")

    # Send unless the friend already has an account (don't reveal which).
    if not User.objects.filter(email__iexact=contact, is_deleted=False).exists():
        emails.send_referral_invite(
            to_email=contact,
            friend_name=full_name.strip(),
            inviter_name=inviter.full_name or "A friend",
            referral_code=inviter.referral_code,
        )

    return {"status": "sent", "channel": "email"}
