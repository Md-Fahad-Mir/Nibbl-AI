"""Notifications: device tokens, templates, per-user preferences, and history."""

from django.conf import settings
from django.db import models

from Apps.common.models import BaseModel


class NotificationType(models.TextChoices):
    RECEIPT_REMINDER = "receipt_reminder", "Upload your receipt"
    REVIEW_REMINDER = "review_reminder", "Finish your review"
    REWARDS_WAITING = "rewards_waiting", "You have rewards waiting"
    NEW_OFFERS = "new_offers", "New offers available"
    INACTIVE = "inactive", "We miss you"
    PROMOTIONAL = "promotional", "Promotional"
    # Brand-facing billing alerts (not preference-gated — critical).
    AUTO_REFILL_FAILED = "auto_refill_failed", "Automatic refill failed"


# Maps a notification type to the preference flag that gates it.
TYPE_TO_PREFERENCE = {
    NotificationType.RECEIPT_REMINDER: "receipt_reminders",
    NotificationType.REVIEW_REMINDER: "review_reminders",
    NotificationType.REWARDS_WAITING: "rewards",
    NotificationType.NEW_OFFERS: "new_offers",
    NotificationType.INACTIVE: "inactivity",
    NotificationType.PROMOTIONAL: "promotional",
}


class DeviceToken(BaseModel):
    class Platform(models.TextChoices):
        IOS = "ios", "iOS"
        ANDROID = "android", "Android"
        WEB = "web", "Web"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="device_tokens"
    )
    token = models.CharField(max_length=512, unique=True)
    platform = models.CharField(max_length=10, choices=Platform.choices, default=Platform.WEB)
    is_active = models.BooleanField(default=True)
    last_seen = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.platform} token for {self.user_id}"


class NotificationTemplate(BaseModel):
    """Title/body templates per type. `{placeholder}` fields filled at send."""

    type = models.CharField(max_length=30, choices=NotificationType.choices, unique=True)
    title = models.CharField(max_length=255)
    body = models.CharField(max_length=500)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.type


class NotificationPreference(BaseModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notification_preference"
    )
    push_enabled = models.BooleanField(default=True)  # master toggle
    receipt_reminders = models.BooleanField(default=True)
    review_reminders = models.BooleanField(default=True)
    rewards = models.BooleanField(default=True)
    new_offers = models.BooleanField(default=True)
    inactivity = models.BooleanField(default=True)
    promotional = models.BooleanField(default=True)

    def __str__(self):
        return f"Preferences for {self.user_id}"

    def allows(self, notification_type) -> bool:
        if not self.push_enabled:
            return False
        field = TYPE_TO_PREFERENCE.get(notification_type)
        return bool(getattr(self, field, True)) if field else True


class Notification(BaseModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SENT = "sent", "Sent"
        SUPPRESSED = "suppressed", "Suppressed"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    type = models.CharField(max_length=30, choices=NotificationType.choices)
    title = models.CharField(max_length=255)
    body = models.CharField(max_length=500)
    data = models.JSONField(default=dict, blank=True)

    # FK-free reference to the originating object (reservation, session, campaign).
    reference_type = models.CharField(max_length=50, blank=True)
    reference_id = models.CharField(max_length=64, blank=True)

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.PENDING)
    read_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["user", "type", "reference_id"]),
        ]

    def __str__(self):
        return f"{self.type} → {self.user_id} ({self.status})"
