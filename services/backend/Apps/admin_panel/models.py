from django.conf import settings
from django.db import models

from Apps.common.models import BaseModel


class ShopperNote(BaseModel):
    """Internal Admin note on a shopper (Master Admin Shoppers). Never shown
    to the shopper."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="admin_notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    body = models.TextField()

    class Meta:
        ordering = ["-created_at"]
