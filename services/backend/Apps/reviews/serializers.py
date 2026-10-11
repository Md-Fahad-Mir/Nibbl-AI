from rest_framework import serializers

from Apps.reviews.models import Review, ReviewCampaign, ReviewPrompt, ReviewSession


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
            # Moderation (additive)
            "status",
            "published_at",
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
            # Master review display (additive)
            "title",
            "display_name",
            "verified_purchase",
            "disclosure",
            "would_recommend",
            "helpful_count",
            "brand_response",
            "brand_response_at",
            "published_at",
        ]
        read_only_fields = fields

    display_name = serializers.SerializerMethodField()
    verified_purchase = serializers.SerializerMethodField()

    def get_display_name(self, obj) -> str:
        from Apps.reviews.campaigns import _display_name

        return _display_name(obj.user)

    def get_verified_purchase(self, obj) -> bool:
        return obj.session_id is not None


class ProductReviewSummarySerializer(serializers.Serializer):
    rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField()

    # Master: overview + AI summary (additive)
    star_distribution = serializers.DictField(child=serializers.IntegerField(), required=False)
    recommendation_rate = serializers.FloatField(allow_null=True, required=False)
    ai_summary = serializers.DictField(allow_null=True, required=False)


# ---------------------------------------------------------------------------
# Review campaigns (brand)
# ---------------------------------------------------------------------------
class ReviewPromptSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewPrompt
        fields = ["id", "text", "source", "times_used"]
        read_only_fields = fields


class ReviewCampaignSerializer(serializers.ModelSerializer):
    products = serializers.SerializerMethodField()
    prompts = ReviewPromptSerializer(many=True, read_only=True)
    reward_amount = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    opportunities_today = serializers.SerializerMethodField()
    display_status = serializers.SerializerMethodField()

    class Meta:
        model = ReviewCampaign
        fields = [
            "id", "name", "status", "display_status", "image_url", "products", "prompts",
            "product_context", "start_at", "end_at", "daily_opportunities",
            "product_cooldown_days", "one_time_only", "auto_paused", "reward_amount",
            "opportunities_today", "created_at",
        ]
        read_only_fields = fields

    def get_products(self, obj) -> list[dict]:
        return [{"id": str(p.id), "name": p.name} for p in obj.products.all()]

    def get_reward_amount(self, obj) -> str:
        from Apps.reviews.campaigns import reward_amount

        return str(reward_amount())

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url

    def get_opportunities_today(self, obj) -> int:
        from django.utils import timezone

        return obj.sessions.filter(created_at__date=timezone.localdate()).count()

    def get_display_status(self, obj) -> str:
        if obj.status == ReviewCampaign.Status.ACTIVE and not obj.is_live:
            return "scheduled" if obj.start_at else "ended"
        return obj.status


class ReviewCampaignWriteSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    product_ids = serializers.ListField(child=serializers.UUIDField(), required=False)
    product_context = serializers.CharField(required=False, allow_blank=True)
    start_at = serializers.DateTimeField(required=False, allow_null=True)
    end_at = serializers.DateTimeField(required=False, allow_null=True)
    daily_opportunities = serializers.IntegerField(min_value=1, required=False)
    product_cooldown_days = serializers.IntegerField(min_value=0, required=False)
    one_time_only = serializers.BooleanField(required=False)


class SetProductsSerializer(serializers.Serializer):
    product_ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)


class AddPromptSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=500)


class SuggestPromptsSerializer(serializers.Serializer):
    count = serializers.IntegerField(min_value=1, max_value=10, default=4)


# ---------------------------------------------------------------------------
# Review opportunities / sessions (shopper)
# ---------------------------------------------------------------------------
class ReviewSessionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    brand_name = serializers.CharField(source="review_campaign.brand.name", read_only=True)
    campaign_image = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    prompts = serializers.SerializerMethodField()

    class Meta:
        model = ReviewSession
        fields = [
            "id", "product", "product_name", "product_image", "brand_name", "campaign_image",
            "reward_amount", "status", "expires_at", "messages", "prompts",
            "ai_review_title", "ai_review_content", "created_at",
        ]
        read_only_fields = fields

    def get_prompts(self, obj) -> list[str]:
        return list(obj.questions or [])

    def _url(self, field):
        if not field:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(field.url) if request else field.url

    def get_campaign_image(self, obj):
        return self._url(obj.review_campaign.image)

    def get_product_image(self, obj):
        return self._url(obj.product.image_url)


class AnswerSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000)


class SubmitSessionSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    content = serializers.CharField(required=False, allow_blank=True, default="")
    title = serializers.CharField(required=False, allow_blank=True, default="", max_length=255)
    would_recommend = serializers.BooleanField(required=False, allow_null=True, default=None)
    # Shopper confirms the review accurately reflects their experience.
    confirm_accurate = serializers.BooleanField(required=False, default=True)

    def validate_confirm_accurate(self, value):
        if not value:
            raise serializers.ValidationError("Confirm the review reflects your experience.")
        return value


# ---------------------------------------------------------------------------
# Review management (brand) + moderation
# ---------------------------------------------------------------------------
class BrandReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    shopper_name = serializers.CharField(source="user.full_name", read_only=True)
    customer_email = serializers.EmailField(source="user.email", read_only=True)
    campaign_name = serializers.CharField(source="review_campaign.name", read_only=True, default=None)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    verified_purchase = serializers.SerializerMethodField()
    reward = serializers.SerializerMethodField()
    receipt = serializers.SerializerMethodField()
    reviewer_display = serializers.SerializerMethodField()
    retailer = serializers.SerializerMethodField()
    region = serializers.SerializerMethodField()
    verification = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id", "product", "product_name", "campaign_name", "brand_name", "shopper_name", "customer_email",
            "verified_purchase", "rating", "title", "content", "status", "published_at", "held_until",
            "would_recommend", "questions_and_answers", "brand_response", "brand_response_at",
            "flag_reason", "flag_note", "flagged_at", "disclosure", "reward", "receipt", "created_at",
            "reviewer_display", "retailer", "region", "verification",
        ]
        read_only_fields = fields

    def to_representation(self, obj):
        data = super().to_representation(obj)
        # Master plans: identity limited to first name + last initial, and the
        # email shown only for negative-review service recovery (1–3★).
        if self.context.get("limited_identity"):
            data["shopper_name"] = data["reviewer_display"]
            if (obj.rating or 0) > 3:
                data["customer_email"] = ""
        return data

    def get_reviewer_display(self, obj) -> str:
        parts = (obj.user.full_name or "").split()
        if not parts:
            return "Customer"
        return f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else parts[0]

    def get_retailer(self, obj) -> str:
        receipt = obj.session.receipt if obj.session_id else None
        return receipt.merchant if receipt else ""

    def get_region(self, obj) -> str:
        location = getattr(obj.user, "discovery_location", None)
        return location.state if location else ""

    def get_verification(self, obj) -> list:
        """Gating summary: the checks the review passed before it existed."""
        session = obj.session if obj.session_id else None
        if session is None:
            return []
        receipt = session.receipt
        return [
            {"label": "Valid receipt detected", "ok": receipt is not None},
            {"label": "Product match confirmed", "ok": session.product_id == obj.product_id},
            {"label": "Purchase date within window", "ok": bool(receipt and receipt.purchased_at)},
            {"label": f"Retailer eligible ({receipt.merchant})" if receipt and receipt.merchant else "Retailer eligible",
             "ok": receipt is not None},
            {"label": "One review per product per receipt", "ok": True},
            {"label": f"Reward issued: ${session.reward_amount}", "ok": session.status == "completed"},
        ]

    def get_verified_purchase(self, obj) -> bool:
        return obj.session_id is not None

    def get_reward(self, obj) -> str | None:
        return str(obj.session.reward_amount) if obj.session_id else None

    def get_receipt(self, obj):
        receipt = obj.session.receipt if obj.session_id else None
        if receipt is None:
            return None
        request = self.context.get("request")
        image = receipt.image
        return {
            "id": str(receipt.id), "merchant": receipt.merchant, "purchased_at": receipt.purchased_at,
            "status": receipt.status,
            "image_url": (request.build_absolute_uri(image.url) if request else image.url) if image else None,
        }


class RespondSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=2000)


class FlagSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=100)
    note = serializers.CharField(required=False, allow_blank=True, default="", max_length=500)


class FlagDecisionSerializer(serializers.Serializer):
    note = serializers.CharField(required=False, allow_blank=True, default="")
