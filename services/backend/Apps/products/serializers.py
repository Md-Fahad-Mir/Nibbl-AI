from rest_framework import serializers

from Apps.products.models import Product, ProductAlias, Tag


class ProductSerializer(serializers.ModelSerializer):
    alias_count = serializers.IntegerField(source="aliases.count", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "sku",
            "description",
            "image_url",
            "category",
            "flavor",
            "format",
            "size_volume",
            "is_active",
            "alias_count",
            "created_at",
        ]
        read_only_fields = ["id", "is_active", "alias_count", "created_at"]


class ProductWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["name", "sku", "description", "image_url", "category", "flavor", "format", "size_volume"]


class ProductAliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAlias
        fields = ["id", "alias_text", "normalized", "created_at"]
        read_only_fields = ["id", "normalized", "created_at"]


class AddAliasSerializer(serializers.Serializer):
    alias_text = serializers.CharField(max_length=255)


class TagSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Tag
        fields = ["id", "product", "product_name", "code", "label", "created_at"]
        read_only_fields = fields


class GenerateTagsSerializer(serializers.Serializer):
    product_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, allow_empty=True
    )


class MatchQuerySerializer(serializers.Serializer):
    text = serializers.CharField()
