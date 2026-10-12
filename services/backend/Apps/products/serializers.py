from django.db.models import Avg
from rest_framework import serializers

from Apps.products.models import Product, ProductAlias, Tag


class ProductSerializer(serializers.ModelSerializer):
    alias_count = serializers.IntegerField(source="aliases.count", read_only=True)
    review_count = serializers.IntegerField(source="reviews.count", read_only=True)
    avg_rating = serializers.SerializerMethodField()
    size_label = serializers.CharField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "code",
            "name",
            "sku",
            "description",
            "image_url",
            "category",
            "flavor",
            "format",
            "size_volume",
            "unit",
            "pack_count",
            "size_label",
            "is_active",
            "alias_count",
            "review_count",
            "avg_rating",
            "created_at",
        ]
        read_only_fields = [
            "id", "code", "size_label", "is_active", "alias_count", "review_count", "avg_rating", "created_at"
        ]

    def get_avg_rating(self, obj):
        avg = obj.reviews.aggregate(value=Avg("rating"))["value"]
        return round(avg, 1) if avg is not None else None


class ProductWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["name", "sku", "description", "image_url", "category", "flavor", "format", "size_volume",
                  "unit", "pack_count"]


class ProductAliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductAlias
        fields = ["id", "alias_text", "normalized", "retailer", "item_code", "created_at"]
        read_only_fields = ["id", "normalized", "created_at"]


class AddAliasSerializer(serializers.Serializer):
    alias_text = serializers.CharField(max_length=255)
    retailer = serializers.CharField(max_length=100, required=False, allow_blank=True)
    item_code = serializers.CharField(max_length=64, required=False, allow_blank=True)


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
