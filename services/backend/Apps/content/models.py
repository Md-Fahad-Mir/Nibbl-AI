"""Public site content: newsletter signups, FAQs, and legal documents.

All three are simple, admin-managed content surfaces consumed by the website
and mobile app. They carry no business logic beyond storage + ordering.
"""

from django.db import models

from Apps.common.models import BaseModel


class NewsletterSubscription(BaseModel):
    """An email captured from a public newsletter signup form."""

    class Status(models.TextChoices):
        SUBSCRIBED = "subscribed", "Subscribed"
        UNSUBSCRIBED = "unsubscribed", "Unsubscribed"

    email = models.EmailField(unique=True)
    source = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SUBSCRIBED
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email


class FAQ(BaseModel):
    """A public frequently-asked-question entry."""

    question = models.CharField(max_length=500)
    answer = models.TextField()
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "created_at"]
        verbose_name = "FAQ"
        verbose_name_plural = "FAQs"

    def __str__(self):
        return self.question


class LegalDocument(BaseModel):
    """A single editable legal document (terms, privacy policy)."""

    class Slug(models.TextChoices):
        TERMS = "terms", "Terms & Conditions"
        PRIVACY = "privacy-policy", "Privacy Policy"

    slug = models.SlugField(max_length=40, unique=True, choices=Slug.choices)
    title = models.CharField(max_length=255)
    content = models.TextField(blank=True)

    class Meta:
        ordering = ["slug"]

    def __str__(self):
        return self.title
