"""Product Library: brand-owned products, their receipt aliases, and tags.

The alias system is what lets noisy OCR receipt text (M8) resolve to a known
product. Every product also stores a ``normalized_name`` so the product name
itself is a zero-config match target.
"""

from django.db import models

from Apps.common.models import BaseModel
from Apps.common.text import normalize_text, random_code


class Product(BaseModel):
    """A product a brand runs campaigns on. Scoped to a single brand (tenant)."""

    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="products"
    )
    name = models.CharField(max_length=255)
    normalized_name = models.CharField(max_length=255, db_index=True, editable=False)
    sku = models.CharField(max_length=100, blank=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True)
    category = models.CharField(max_length=100, blank=True)
    flavor = models.CharField(max_length=100, blank=True)
    format = models.CharField(max_length=100, blank=True)
    size_volume = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["brand", "name"], name="uniq_brand_product_name"
            )
        ]
        indexes = [
            models.Index(fields=["brand", "is_active"]),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_text(self.name)
        super().save(*args, **kwargs)


class ProductAlias(BaseModel):
    """An alternate string (as seen on receipts) that maps to a product.

    ``brand`` is denormalized so an alias is unique *within a brand* — two
    products in the same brand can't claim the same alias (avoids ambiguous
    matches). Different brands may reuse the same alias text.
    """

    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="aliases"
    )
    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="product_aliases"
    )
    alias_text = models.CharField(max_length=255)
    normalized = models.CharField(max_length=255, db_index=True, editable=False)

    class Meta:
        ordering = ["alias_text"]
        constraints = [
            models.UniqueConstraint(
                fields=["brand", "normalized"], name="uniq_brand_alias"
            )
        ]

    def __str__(self):
        return self.alias_text

    def save(self, *args, **kwargs):
        self.normalized = normalize_text(self.alias_text)
        super().save(*args, **kwargs)


class Tag(BaseModel):
    """A generated code/label tied to a product, pulled from the library.

    The Tag Generator creates these from existing products (no manual upload).
    """

    brand = models.ForeignKey(
        "brands.Brand", on_delete=models.CASCADE, related_name="tags"
    )
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="tags"
    )
    code = models.CharField(max_length=16, unique=True, editable=False)
    label = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self._generate_unique_code()
        super().save(*args, **kwargs)

    @staticmethod
    def _generate_unique_code() -> str:
        for _ in range(10):
            code = random_code(10)
            if not Tag.objects.filter(code=code).exists():
                return code
        return random_code(14)
