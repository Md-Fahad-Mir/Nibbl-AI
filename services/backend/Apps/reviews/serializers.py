from decimal import Decimal

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from Apps.reviews.models import (
    Review,
    ReviewCampaign,
    ReviewPrompt,
    ReviewSession,
)


class ReviewPromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewPrompt
        fields = ["id", "text", "order", "source"]
        read_only_fields = ["id", "source"]


class ReviewCampaignSerializer(serializers.ModelSerializer):
    products = serializers.SerializerMethodField()
    prompts = ReviewPromptSerializer(many=True, read_only=True)

    class Meta:
        model = ReviewCampaign
        fields = [
            "id",
            "name",
            "status",
            "daily_budget",
            "reward_amount",
            "product_context",
            "auto_paused",
            "products",
            "prompts",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_products(self, obj):
        return [{"id": str(p.id), "name": p.name} for p in obj.products.all()]


class CreateReviewCampaignSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    daily_budget = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01")
    )
    reward_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True
    )
    product_context = serializers.CharField(required=False, allow_blank=True, default="")
    product_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )


class UpdateReviewCampaignSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    daily_budget = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False
    )
    reward_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False
    )
    product_context = serializers.CharField(required=False, allow_blank=True)


class SetProductsSerializer(serializers.Serializer):
    product_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


class GeneratePromptsSerializer(serializers.Serializer):
    count = serializers.IntegerField(min_value=1, max_value=10, default=4)


class AddPromptSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=500)


class ReviewCampaignPreviewSerializer(serializers.Serializer):
    campaign = ReviewCampaignSerializer()
    reward_amount = serializers.CharField()
    consumes_budget = serializers.BooleanField()


class ReviewSessionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    brand_name = serializers.CharField(
        source="review_campaign.brand.name", read_only=True
    )
    prompts = serializers.SerializerMethodField()

    class Meta:
        model = ReviewSession
        fields = [
            "id",
            "product",
            "product_name",
            "brand_name",
            "reward_amount",
            "status",
            "expires_at",
            "messages",
            "prompts",
            "ai_review_content",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ListField(child=serializers.CharField()))
    def get_prompts(self, obj):
        return [p.text for p in obj.review_campaign.prompts.all()]


class AnswerSerializer(serializers.Serializer):
    text = serializers.CharField()


class AnswerResultSerializer(serializers.Serializer):
    next_prompt = serializers.CharField(allow_null=True)
    done = serializers.BooleanField()
    #: Set only when `done` -- the AI-written review from all Q&A answers.
    #: The reviewer sees this straight after "thank you", ready to submit.
    review = serializers.CharField(allow_null=True)


class SubmitReviewSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    content = serializers.CharField(required=False, allow_blank=True, default="")


class ReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "product",
            "product_name",
            "user_email",
            "rating",
            "content",
            "status",
            "published_at",
            "created_at",
        ]
        read_only_fields = fields


class RemoveReviewSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class PublicReviewSerializer(serializers.ModelSerializer):
    """Consumer-safe review (NO email — display name + avatar only)."""

    author_name = serializers.CharField(source="user.full_name", read_only=True)
    author_avatar = serializers.URLField(source="user.avatar_url", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "author_name",
            "author_avatar",
            "rating",
            "content",
            "published_at",
            "created_at",
        ]
        read_only_fields = fields


class ProductReviewSummarySerializer(serializers.Serializer):
    rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField()
