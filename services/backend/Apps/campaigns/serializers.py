from decimal import Decimal

from rest_framework import serializers

from Apps.campaigns.models import (
    Campaign,
    FallbackOffer,
    Restriction,
    RewardTier,
)


class RewardTierSerializer(serializers.ModelSerializer):
    class Meta:
        model = RewardTier
        fields = ["id", "reward_amount", "allocation_percent"]
        read_only_fields = ["id"]


class RestrictionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Restriction
        fields = ["restriction_type", "min_units", "description"]
        read_only_fields = fields


class FallbackOfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = FallbackOffer
        fields = ["reward_amount", "is_enabled", "description"]
        read_only_fields = fields


class CampaignSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField(read_only=True)
    products = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    tiers = RewardTierSerializer(many=True, read_only=True)
    restriction = RestrictionSerializer(read_only=True)
    fallback_offer = FallbackOfferSerializer(read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id",
            "name",
            "description",
            "status",
            "products",
            "product_name",
            "daily_budget",
            "min_purchase_units",
            "is_bogo",
            "cooldown_days",
            "start_at",
            "end_at",
            "auto_paused",
            "tiers",
            "restriction",
            "fallback_offer",
            "created_at",
        ]
        read_only_fields = fields

    def get_product_name(self, obj):
        first_product = obj.products.first()
        return first_product.name if first_product else ""


class CampaignCreateSerializer(serializers.Serializer):
    product = serializers.ListField(child=serializers.UUIDField())
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    daily_budget = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01")
    )
    min_purchase_units = serializers.IntegerField(min_value=1, default=1)
    is_bogo = serializers.BooleanField(default=False)
    cooldown_days = serializers.IntegerField(min_value=0, default=30)
    start_at = serializers.DateTimeField(required=False, allow_null=True)
    end_at = serializers.DateTimeField(required=False, allow_null=True)


class CampaignUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    daily_budget = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False
    )
    min_purchase_units = serializers.IntegerField(min_value=1, required=False)
    is_bogo = serializers.BooleanField(required=False)
    cooldown_days = serializers.IntegerField(min_value=0, required=False)
    start_at = serializers.DateTimeField(required=False, allow_null=True)
    end_at = serializers.DateTimeField(required=False, allow_null=True)


class TierInputSerializer(serializers.Serializer):
    reward_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01")
    )
    allocation_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.01")
    )


class SetTiersSerializer(serializers.Serializer):
    tiers = TierInputSerializer(many=True, allow_empty=False)


class SetFallbackSerializer(serializers.Serializer):
    reward_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01")
    )
    is_enabled = serializers.BooleanField(default=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")


class CampaignAccessSerializer(serializers.Serializer):
    campaign_url = serializers.CharField()
    qr_data = serializers.CharField()


class CampaignPreviewSerializer(serializers.Serializer):
    campaign = CampaignSerializer()
    best_offer = serializers.DecimalField(
        max_digits=14, decimal_places=2, allow_null=True
    )
    campaign_url = serializers.CharField()
    qr_data = serializers.CharField()
    consumes_budget = serializers.BooleanField()
    creates_reservation = serializers.BooleanField()
