"""Read-side queries for the product library (all brand-scoped)."""

from Apps.common.text import normalize_text
from Apps.products.models import Product, ProductAlias


def products_for_brand(brand):
    return Product.objects.filter(brand=brand, is_active=True)


def get_brand_product(brand, product_id) -> Product | None:
    return Product.objects.filter(brand=brand, id=product_id).first()


def _retailer_ok(alias: ProductAlias, merchant: str) -> bool:
    """An alias tied to a retailer only matches that retailer's receipts."""
    if not alias.retailer:
        return True
    want, got = normalize_text(alias.retailer), normalize_text(merchant)
    return bool(got) and (want in got or got in want)


def match_product(*, brand, text: str = "", sku: str = "", merchant: str = "") -> Product | None:
    """Resolve a receipt line to one of the brand's active products.

    Preferred order: SKU / item code (exact, case-insensitive — unambiguous
    when the OCR provider reads one: the product's UPC/SKU or an alias's item
    code) -> alias (indexed; a retailer-specific alias only on that retailer's
    receipts) -> normalized product name. Returns None on no match — callers
    treat this as "needs review".
    """
    cleaned_sku = (sku or "").strip()
    if cleaned_sku:
        by_sku = Product.objects.filter(
            brand=brand, is_active=True, sku__iexact=cleaned_sku
        ).first()
        if by_sku is not None:
            return by_sku
        by_code = (
            ProductAlias.objects.filter(brand=brand, item_code__iexact=cleaned_sku, product__is_active=True)
            .select_related("product").first()
        )
        if by_code is not None and _retailer_ok(by_code, merchant):
            return by_code.product

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
    if alias is not None and _retailer_ok(alias, merchant):
        return alias.product

    return Product.objects.filter(
        brand=brand, is_active=True, normalized_name=norm
    ).order_by("code").first()


def name_candidates(*, brand, text: str) -> list[Product]:
    """Every active product whose name matches the receipt wording — more
    than one means the shopper must pick (Master: Multiple Matches)."""
    norm = normalize_text(text)
    if not norm:
        return []
    return list(Product.objects.filter(brand=brand, is_active=True, normalized_name=norm).order_by("code"))
