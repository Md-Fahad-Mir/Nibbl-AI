from rest_framework import serializers

from Apps.reviews.models import Review


class ReviewAnswerSerializer(serializers.Serializer):
    """One (question, answer) pair, matching the AI service's own
    ReviewAnswer shape — the frontend got `question` from the AI service's
    /reviews/questions endpoint and collected `answer` from the user."""

    question = serializers.CharField(max_length=500)
    answer = serializers.CharField(max_length=2000)


class GenerateReviewSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    answers = ReviewAnswerSerializer(many=True)
    #: Optional star rating the user wants reflected; the AI service infers
    #: one from the answers when omitted.
    rating = serializers.IntegerField(
        min_value=1, max_value=5, required=False, allow_null=True, default=None
    )

    def validate_answers(self, value):
        if not value:
            raise serializers.ValidationError("At least one answer is required.")
        return value


class ReviewSerializer(serializers.ModelSerializer):
    """The reviewer's own view of a submitted review."""

    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "product",
            "product_name",
            "title",
            "content",
            "rating",
            "ai_generated",
            "disclosure",
            "questions_and_answers",
            "created_at",
        ]
        read_only_fields = fields


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
            "created_at",
        ]
        read_only_fields = fields


class ProductReviewSummarySerializer(serializers.Serializer):
    rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField()
