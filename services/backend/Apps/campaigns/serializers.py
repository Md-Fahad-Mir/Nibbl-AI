from decimal import Decimal

from rest_framework import serializers

from Apps.campaigns.models import (
    Campaign,
    CampaignReview,
    FallbackOffer,
    Retailer,
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


class RetailerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Retailer
        fields = ["id", "name", "is_verified"]
        read_only_fields = fields


class RetailerCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)


class CampaignReviewSerializer(serializers.ModelSerializer):
    """One entry of a campaign's review activity (Master ⑥)."""

    class Meta:
        model = CampaignReview
        fields = [
            "id", "kind", "status", "changes", "submitted_at",
            "reviewed_at", "comment",
        ]
        read_only_fields = fields


class CampaignSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField(read_only=True)
    # Open revision of an approved campaign (the live version is unchanged
    # until Nibbl approves it); null when there is none.
    pending_revision = serializers.SerializerMethodField(read_only=True)
    # Nibbl's latest comment to the brand (changes requested / rejected).
    review_comment = serializers.SerializerMethodField(read_only=True)
    # Brand-facing status: draft / pending_review / changes_requested /
    # rejected / approved / scheduled / active / paused / ended.
    display_status = serializers.CharField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    # Retailer Availability (Where to Buy) + Featured Retailers: [{id, name}].
    retailers = serializers.SerializerMethodField(read_only=True)
    featured_retailers = serializers.SerializerMethodField(read_only=True)
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
            # Nibbl approval (additive).
            "review_status",
            "pending_revision",
            "review_comment",
            "display_status",
            "allowed_merchants",
            "retailers",
            "featured_retailers",
            "retailer_required",
            "geography",
            "geography_states",
            "geography_areas",
            "image_url",
        ]
        read_only_fields = fields

    def get_product_name(self, obj):
        first_product = obj.products.first()
        return first_product.name if first_product else ""

    def get_pending_revision(self, obj):
        from Apps.campaigns.approvals import open_revision

        review = open_revision(obj)
        return CampaignReviewSerializer(review).data if review else None

    def get_retailers(self, obj) -> list[dict]:
        return [{"id": str(r.id), "name": r.name} for r in obj.retailers.all()]

    def get_featured_retailers(self, obj) -> list[dict]:
        return [{"id": str(r.id), "name": r.name} for r in obj.featured_retailers.all()]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url

    def get_review_comment(self, obj) -> str:
        # Only while it still applies: the latest review is waiting on the
        # brand (changes requested) or rejected the campaign itself.
        latest = obj.reviews.order_by("-submitted_at").first()
        if latest is None or not latest.comment:
            return ""
        if latest.status == CampaignReview.Status.CHANGES_REQUESTED or (
            latest.status == CampaignReview.Status.REJECTED
            and latest.kind == CampaignReview.Kind.NEW
        ):
            return latest.comment
        return ""

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
    # Receipt eligibility: blank = Any Retailer; otherwise the receipt must
    # show one of these (comma-separated) retailer names.
    allowed_merchants = serializers.CharField(required=False, allow_blank=True)
    # Retailer directory ids; Retailer Required → receipts must be from one.
    retailers = serializers.ListField(child=serializers.UUIDField(), required=False)
    featured_retailers = serializers.ListField(
        child=serializers.UUIDField(), required=False, max_length=3
    )
    retailer_required = serializers.BooleanField(required=False)
    # Discovery Geography: nationwide | states | zip_radius.
    geography = serializers.ChoiceField(choices=Campaign.Geography.choices, required=False)
    geography_states = serializers.ListField(
        child=serializers.CharField(max_length=2), required=False
    )
    geography_areas = serializers.ListField(child=serializers.DictField(), required=False)


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


class ReviewDecisionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, default="")


class AdminCampaignReviewSerializer(serializers.ModelSerializer):
    """Approval queue row: the essential terms Nibbl checks (offer, products,
    retailers, cooldown, 25-hour redemption goal, funding) plus, for a
    revision, the proposed changes."""

    campaign = CampaignSerializer(read_only=True)
    brand_id = serializers.UUIDField(source="campaign.brand_id", read_only=True)
    brand_name = serializers.CharField(source="campaign.brand.name", read_only=True)
    product_names = serializers.SerializerMethodField()
    wallet_available = serializers.SerializerMethodField()
    submitted_by_email = serializers.EmailField(source="submitted_by.email", read_only=True, default=None)
    # A revision's newly uploaded campaign image, if it proposes one.
    proposed_image_url = serializers.SerializerMethodField()

    class Meta:
        model = CampaignReview
        fields = [
            "id", "kind", "status", "changes", "submitted_at", "submitted_by_email",
            "brand_id", "brand_name", "product_names", "wallet_available", "campaign",
            "proposed_image_url",
        ]
        read_only_fields = fields

    def get_proposed_image_url(self, obj):
        name = (obj.changes or {}).get("image")
        if not name:
            return None
        from django.core.files.storage import default_storage

        url = default_storage.url(name)
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_product_names(self, obj) -> list[str]:
        return [p.name for p in obj.campaign.products.all()]

    def get_wallet_available(self, obj) -> str:
        from Apps.wallets.services import get_or_create_brand_wallet

        return str(get_or_create_brand_wallet(obj.campaign.brand).reward_available())


class CampaignImageSerializer(serializers.Serializer):
    image = serializers.ImageField()
