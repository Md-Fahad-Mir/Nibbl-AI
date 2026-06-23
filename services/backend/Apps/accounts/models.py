"""Identity models: the custom User, verification codes, and social links."""

import secrets

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from Apps.accounts.managers import UserManager
from Apps.common.models import BaseModel, UUIDModel

# Unambiguous alphabet for human-friendly referral codes (no 0/O/1/I).
_REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_referral_code(length: int = 8) -> str:
    return "".join(secrets.choice(_REFERRAL_ALPHABET) for _ in range(length))


def generate_numeric_code(length: int = 6) -> str:
    return "".join(secrets.choice("0123456789") for _ in range(length))


class User(UUIDModel, AbstractBaseUser, PermissionsMixin):
    """Platform user. Email is the login identifier across all roles.

    Brand membership and admin scoping are layered on later milestones;
    ``role`` only records which family of user this is.
    """

    class Role(models.TextChoices):
        CONSUMER = "consumer", "Consumer"
        BRAND = "brand", "Brand member"
        ADMIN = "admin", "Platform admin"

    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=255)
    avatar = models.ImageField(upload_to="avatars/%Y/%m/", blank=True, null=True)

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CONSUMER)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    is_email_verified = models.BooleanField(default=False)
    is_phone_verified = models.BooleanField(default=False)

    accepted_terms_at = models.DateTimeField(null=True, blank=True)

    referral_code = models.CharField(max_length=12, unique=True, editable=False)
    referred_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="referrals",
    )

    # Soft-deletion of accounts (kept FK-friendly for downstream financial data).
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if not self.referral_code:
            self.referral_code = self._generate_unique_referral_code()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_unique_referral_code() -> str:
        for _ in range(10):
            code = generate_referral_code()
            if not User.objects.filter(referral_code=code).exists():
                return code
        # Extremely unlikely; widen the space rather than fail.
        return generate_referral_code(12)

    def get_full_name(self) -> str:
        return self.full_name

    def get_short_name(self) -> str:
        return self.full_name.split(" ")[0] if self.full_name else self.email


class VerificationCode(BaseModel):
    """Short-lived numeric code for email/phone verification and password reset.

    A single model with a ``purpose`` keeps the codebase DRY; only one
    unconsumed code per (user, purpose) is valid at a time.
    """

    class Purpose(models.TextChoices):
        EMAIL_VERIFY = "email_verify", "Email verification"
        PHONE_VERIFY = "phone_verify", "Phone verification"
        PASSWORD_RESET = "password_reset", "Password reset"

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="verification_codes"
    )
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    code = models.CharField(max_length=6)
    # Snapshot of the email/phone the code was sent to.
    destination = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "purpose", "consumed_at"]),
        ]

    def __str__(self):
        return f"{self.purpose} for {self.user_id}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def is_consumed(self) -> bool:
        return self.consumed_at is not None

    def is_valid(self) -> bool:
        return not self.is_consumed and not self.is_expired

    def consume(self):
        self.consumed_at = timezone.now()
        self.save(update_fields=["consumed_at", "updated_at"])


class PendingUser(BaseModel):
    """Temporary storage for user registration details until email is verified."""

    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128)  # Stores the hashed password
    full_name = models.CharField(max_length=255)
    referral_code = models.CharField(max_length=12, null=True, blank=True)
    verification_code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Pending registration for {self.email}"

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at





class SocialAccount(BaseModel):
    """Link between a User and an external identity provider (Google/Apple).

    The model + endpoint are scaffolded in M1; real provider token
    verification is wired up during the mobile integration.
    """

    class Provider(models.TextChoices):
        GOOGLE = "google", "Google"
        APPLE = "apple", "Apple"

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="social_accounts"
    )
    provider = models.CharField(max_length=20, choices=Provider.choices)
    provider_user_id = models.CharField(max_length=255)
    email = models.EmailField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_user_id"],
                name="uniq_provider_account",
            )
        ]

    def __str__(self):
        return f"{self.provider}:{self.provider_user_id}"
