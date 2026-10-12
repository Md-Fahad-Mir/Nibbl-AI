"""Brand-scoped HTTP layer for the product library."""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.brands.access import get_brand_or_404, require_membership
from Apps.products import serializers as s
from Apps.products import services
from Apps.products.models import ProductAlias
from Apps.products.selectors import (
    get_brand_product,
    match_product,
    products_for_brand,
)
from Apps.products.services import ProductError


def _run(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except ProductError as exc:
        raise ValidationError({"detail": str(exc)})


def _get_product(brand, product_id):
    product = get_brand_product(brand, product_id)
    if product is None:
        raise NotFound("Product not found.")
    return product


@extend_schema(tags=["products"])
class ProductListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ProductSerializer(many=True)})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        products = products_for_brand(brand)
        return Response(s.ProductSerializer(products, many=True).data)

    @extend_schema(request=s.ProductWriteSerializer, responses={201: s.ProductSerializer})
    def post(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        serializer = s.ProductWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = _run(services.create_product, brand=brand, **serializer.validated_data)
        return Response(
            s.ProductSerializer(product).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["products"])
class ProductDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ProductSerializer})
    def get(self, request, brand_id, product_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        product = _get_product(brand, product_id)
        return Response(s.ProductSerializer(product).data)

    @extend_schema(request=s.ProductWriteSerializer, responses={200: s.ProductSerializer})
    def patch(self, request, brand_id, product_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        product = _get_product(brand, product_id)
        serializer = s.ProductWriteSerializer(product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        product = _run(services.update_product, product, **serializer.validated_data)
        return Response(s.ProductSerializer(product).data)

    @extend_schema(responses={204: None})
    def delete(self, request, brand_id, product_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        product = _get_product(brand, product_id)
        services.archive_product(product)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["products"])
class AliasListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ProductAliasSerializer(many=True)})
    def get(self, request, brand_id, product_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        product = _get_product(brand, product_id)
        return Response(s.ProductAliasSerializer(product.aliases.all(), many=True).data)

    @extend_schema(request=s.AddAliasSerializer, responses={201: s.ProductAliasSerializer})
    def post(self, request, brand_id, product_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        product = _get_product(brand, product_id)
        serializer = s.AddAliasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        alias = _run(
            services.add_alias,
            product=product,
            alias_text=serializer.validated_data["alias_text"],
            retailer=serializer.validated_data.get("retailer", ""),
            item_code=serializer.validated_data.get("item_code", ""),
        )
        return Response(
            s.ProductAliasSerializer(alias).data, status=status.HTTP_201_CREATED
        )


@extend_schema(tags=["products"])
class AliasDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, brand_id, product_id, alias_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        product = _get_product(brand, product_id)
        alias = ProductAlias.objects.filter(id=alias_id, product=product).first()
        if alias is None:
            raise NotFound("Alias not found.")
        services.remove_alias(alias)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["products"])
class ProductMatchView(APIView):
    """Utility: preview which product a piece of receipt text resolves to."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        parameters=[s.MatchQuerySerializer],
        responses={200: s.ProductSerializer},
    )
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        query = s.MatchQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        product = match_product(brand=brand, text=query.validated_data["text"])
        return Response(
            {
                "matched": product is not None,
                "product": s.ProductSerializer(product).data if product else None,
            }
        )


@extend_schema(tags=["products"])
class TagListView(generics.ListAPIView):
    serializer_class = s.TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        brand = get_brand_or_404(self.kwargs["brand_id"])
        require_membership(self.request.user, brand)
        return brand.tags.select_related("product").all()


@extend_schema(tags=["products"])
class GenerateTagsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.GenerateTagsSerializer, responses={201: s.TagSerializer(many=True)})
    def post(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        serializer = s.GenerateTagsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tags = services.generate_tags(
            brand=brand, product_ids=serializer.validated_data.get("product_ids")
        )
        return Response(
            s.TagSerializer(tags, many=True).data, status=status.HTTP_201_CREATED
        )


# ---------------------------------------------------------------------------
# Standardized categories (Master Product Library #6)
# ---------------------------------------------------------------------------
@extend_schema(tags=["products"])
class ProductCategoryListView(APIView):
    """GET: Nibbl's active categories plus this brand's pending requests and
    any older free-text category its products still use."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        from Apps.products.models import CategoryRequest, Product, ProductCategory

        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        standard = list(ProductCategory.objects.filter(is_active=True).values_list("name", flat=True))
        in_use = sorted({c for c in Product.objects.filter(brand=brand).exclude(category="")
                         .values_list("category", flat=True)} - set(standard))
        requests = CategoryRequest.objects.filter(brand=brand).order_by("-created_at")[:20]
        return Response({
            "categories": standard,
            "legacy": in_use,
            "requests": [{"id": str(r.id), "name": r.name, "status": r.status, "decision_note": r.decision_note,
                          "created_at": r.created_at} for r in requests],
        })


@extend_schema(tags=["products"])
class CategoryRequestCreateView(APIView):
    """POST {name, note}: ask Nibbl to add a category."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={201: None})
    def post(self, request, brand_id):
        from Apps.products.models import CategoryRequest, ProductCategory

        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand, manager=True, active=True)
        name = str(request.data.get("name", "")).strip()[:100]
        if not name:
            raise ValidationError({"detail": "Enter the category name."})
        if ProductCategory.objects.filter(name__iexact=name, is_active=True).exists():
            raise ValidationError({"detail": "That category already exists — pick it from the list."})
        if CategoryRequest.objects.filter(brand=brand, name__iexact=name, status=CategoryRequest.Status.PENDING).exists():
            raise ValidationError({"detail": "You've already requested this category."})
        r = CategoryRequest.objects.create(brand=brand, requested_by=request.user, name=name,
                                           note=str(request.data.get("note", ""))[:255])
        return Response({"id": str(r.id), "name": r.name, "status": r.status}, status=status.HTTP_201_CREATED)
