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
    # 25-hour cycle state for the brand ("Current Cycle Claims: 12 of 34").
    current_cycle_claims = serializers.SerializerMethodField(read_only=True)
    current_cycle_started_at = serializers.SerializerMethodField(read_only=True)
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
            # Deal model (additive).
            "deal_type",
            "max_rebate",
            "fixed_reward",
            "required_quantity",
            "offer_headline",
            "offer_description",
            "desired_redemptions",
            "estimated_redemption_rate",
            "claim_capacity",
            "one_time_only",
            "activated_at",
            "current_cycle_claims",
            "current_cycle_started_at",
        ]
        read_only_fields = fields

    def get_product_name(self, obj):
        first_product = obj.products.first()
        return first_product.name if first_product else ""

    def get_current_cycle_claims(self, obj) -> int:
        from Apps.campaigns import deals

        return deals.claims_this_cycle(obj)

    def get_current_cycle_started_at(self, obj):
        from Apps.campaigns import deals

        return deals.cycle_start(obj)


class _DealInputMixin(serializers.Serializer):
    """Deal-model inputs (Master builder ③④⑦⑧). All optional so the old
    builder keeps working; sending deal_type switches to the deal model."""

    deal_type = serializers.ChoiceField(choices=Campaign.DealType.choices, required=False)
    max_rebate = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    fixed_reward = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False, allow_null=True
    )
    required_quantity = serializers.IntegerField(min_value=1, max_value=3, required=False)
    offer_headline = serializers.CharField(max_length=255, required=False, allow_blank=True)
    offer_description = serializers.CharField(required=False, allow_blank=True)
    desired_redemptions = serializers.IntegerField(min_value=1, required=False)
    estimated_redemption_rate = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=Decimal("0.01"),
        max_value=Decimal("100"), required=False,
    )
    one_time_only = serializers.BooleanField(required=False)


class CampaignCreateSerializer(_DealInputMixin):
    product = serializers.ListField(child=serializers.UUIDField())
    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    # Old builder only; the deal model uses the 25-hour claim capacity.
    daily_budget = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False
    )
    min_purchase_units = serializers.IntegerField(min_value=1, default=1)
    is_bogo = serializers.BooleanField(default=False)
    cooldown_days = serializers.IntegerField(min_value=0, default=30)
    start_at = serializers.DateTimeField(required=False, allow_null=True)
    end_at = serializers.DateTimeField(required=False, allow_null=True)


class CampaignUpdateSerializer(_DealInputMixin):
    product = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=False,
    )
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
