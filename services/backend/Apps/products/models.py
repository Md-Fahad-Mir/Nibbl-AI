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
    image_url = models.ImageField(upload_to="product_images/%Y/%m/", blank=True, null=True)
    category = models.CharField(max_length=100, blank=True)
    flavor = models.CharField(max_length=100, blank=True)
    format = models.CharField(max_length=100, blank=True)
    size_volume = models.CharField(max_length=100, blank=True)
    # Master Product Library: Size + Unit + Pack Count, and a permanent
    # brand-scoped Product ID (PRD-001) assigned on save.
    unit = models.CharField(max_length=20, blank=True)
    pack_count = models.PositiveSmallIntegerField(default=1)
    code = models.CharField(max_length=20, blank=True, editable=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            # One record per flavor / size: the same name may repeat across variants.
            models.UniqueConstraint(
                fields=["brand", "name", "flavor", "size_volume", "unit", "pack_count"],
                name="uniq_brand_product_variant",
            ),
        ]
        indexes = [
            models.Index(fields=["brand", "is_active"]),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.normalized_name = normalize_text(self.name)
        if not self.code and self.brand_id:
            self.code = next_product_code(self.brand_id)
        super().save(*args, **kwargs)

    @property
    def size_label(self) -> str:
        """"12 oz", "6 × 12 oz" — for cards and review screens."""
        size = " ".join(p for p in (self.size_volume, self.unit) if p)
        return f"{self.pack_count} × {size}" if size and self.pack_count > 1 else size


def next_product_code(brand_id) -> str:
    """Next PRD-### for a brand (never reused: counts archived products too)."""
    numbers = [
        int(c[4:]) for c in Product.objects.filter(brand_id=brand_id, code__startswith="PRD-")
        .values_list("code", flat=True) if c[4:].isdigit()
    ]
    return f"PRD-{max(numbers, default=0) + 1:03d}"


class ProductCategory(BaseModel):
    """Standardized, admin-managed product category."""

    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class CategoryRequest(BaseModel):
    """A brand asking Nibbl to add a category."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    brand = models.ForeignKey("brands.Brand", on_delete=models.CASCADE, related_name="category_requests")
    requested_by = models.ForeignKey("accounts.User", null=True, on_delete=models.SET_NULL, related_name="+")
    name = models.CharField(max_length=100)
    note = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    decision_note = models.CharField(max_length=255, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


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
    # Master Receipt Matching: optional retailer (alias only matches that
    # store's receipts) and optional item code printed on the receipt.
    retailer = models.CharField(max_length=100, blank=True)
    item_code = models.CharField(max_length=64, blank=True, db_index=True)

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
