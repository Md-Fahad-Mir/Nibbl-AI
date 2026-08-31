"""Read-side queries for the product library (all brand-scoped)."""

from Apps.common.text import normalize_text
from Apps.products.models import Product, ProductAlias


def products_for_brand(brand):
    return Product.objects.filter(brand=brand)


def get_brand_product(brand, product_id) -> Product | None:
    return Product.objects.filter(brand=brand, id=product_id).first()


def match_product(*, brand, text: str = "", sku: str = "") -> Product | None:
    """Resolve a receipt line to one of the brand's active products.

    Preferred order: SKU/product code (exact, case-insensitive — unambiguous
    when the OCR provider reads one) -> alias (indexed) -> normalized product
    name. Returns None on no match — callers (M8) treat this as "needs
    review".
    """
    cleaned_sku = (sku or "").strip()
    if cleaned_sku:
        by_sku = Product.objects.filter(
            brand=brand, is_active=True, sku__iexact=cleaned_sku
        ).first()
        if by_sku is not None:
            return by_sku

    norm = normalize_text(text)
    if not norm:
        return None

    alias = (
        ProductAlias.objects.filter(
            brand=brand, normalized=norm, product__is_active=True
        )
        .select_related("product")
        .first()
    )
    if alias is not None:
        return alias.product

    return Product.objects.filter(
        brand=brand, is_active=True, normalized_name=norm
    ).first()
