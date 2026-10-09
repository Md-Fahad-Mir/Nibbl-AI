from decimal import Decimal

from rest_framework import serializers

from Apps.receipts.models import (
    FraudFlag,
    ManualReviewItem,
    Receipt,
    ReceiptLineItem,
)


class ReceiptLineItemSerializer(serializers.ModelSerializer):
    matched_product_name = serializers.CharField(
        source="matched_product.name", read_only=True, default=None
    )

    class Meta:
        model = ReceiptLineItem
        fields = [
            "id",
            "description",
            "quantity",
            "unit_price",
            "matched_product",
            "matched_product_name",
        ]
        read_only_fields = fields


class ReceiptSerializer(serializers.ModelSerializer):
    """Customer-facing receipt state.

    Deliberately omits the identity hashes (``merchant_hash``,
    ``purchase_date_hash``, ``purchase_time_hash``, ``product_description_hash``)
    — they are an internal fraud control, and exposing them would let a
    client probe whether a given physical receipt has already been used.
    """

    line_items = ReceiptLineItemSerializer(many=True, read_only=True)
    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    # Shopper-facing offer wording (campaign_name is the internal name).
    offer_headline = serializers.CharField(source="campaign.offer_headline", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    reward_amount = serializers.DecimalField(
        source="reservation.reward_amount", max_digits=14, decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Receipt
        fields = [
            "id",
            "reservation",
            "campaign",
            "campaign_name",
            "offer_headline",
            "brand_name",
            "status",
            "merchant",
            "purchased_at",
            "receipt_number",
            "total",
            "matched",
            "matched_units",
            "reward_amount",
            "decision_reason",
            "line_items",
            "created_at",
        ]
        read_only_fields = fields


class LineItemInputSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=255)
    quantity = serializers.IntegerField(min_value=1, default=1)
    unit_price = serializers.DecimalField(
        max_digits=14, decimal_places=2, required=False, allow_null=True,
        min_value=Decimal("0.00"),
    )


class UploadReceiptSerializer(serializers.Serializer):
    """Receipt submission: ``reservation`` + the receipt photo, as multipart.

    The image is REQUIRED. Every identifying value (shop, date, time, receipt
    number, line items) is read from the photo by OCR — the client cannot
    supply them, because a client-declared receipt would be trivially forgeable
    and is what the reward is paid against.
    """

    reservation = serializers.UUIDField()
    image = serializers.FileField()


class FraudFlagSerializer(serializers.ModelSerializer):
    class Meta:
        model = FraudFlag
        fields = ["id", "reason", "detail", "resolved", "created_at"]
        read_only_fields = fields


class ReviewQueueReceiptSerializer(serializers.ModelSerializer):
    """Brand-facing receipt for the manual review queue.

    A superset of the consumer ``ReceiptSerializer`` carrying the reviewer-only
    context a brand needs to judge a claim (claimant identity, receipt image,
    matched product, fraud flags). Kept separate so the consumer receipt
    endpoints' response is not changed.
    """

    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    # Shopper-facing offer wording (campaign_name is the internal name).
    offer_headline = serializers.CharField(source="campaign.offer_headline", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_avatar_url = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    matched_product_name = serializers.CharField(
        source="matched_product.name", read_only=True, default=None
    )
    reward_amount = serializers.DecimalField(
        source="reservation.reward_amount", max_digits=14, decimal_places=2,
        read_only=True,
    )
    line_items = ReceiptLineItemSerializer(many=True, read_only=True)
    fraud_flags = FraudFlagSerializer(many=True, read_only=True)

    class Meta:
        model = Receipt
        fields = [
            "id",
            "reservation",
            "campaign",
            "campaign_name",
            "offer_headline",
            "brand_name",
            "user",
            "user_name",
            "user_email",
            "user_avatar_url",
            "image_url",
            "status",
            "merchant",
            "purchased_at",
            "receipt_number",
            "total",
            "matched",
            "matched_units",
            "matched_product",
            "matched_product_name",
            "reward_amount",
            "decision_reason",
            "line_items",
            "fraud_flags",
            "created_at",
        ]
        read_only_fields = fields

    def _absolute_url(self, file_field):
        if not file_field:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(file_field.url) if request else file_field.url

    def get_user_avatar_url(self, obj):
        return self._absolute_url(obj.user.avatar)

    def get_image_url(self, obj):
        return self._absolute_url(obj.image)


class ReviewItemSerializer(serializers.ModelSerializer):
    receipt = ReviewQueueReceiptSerializer(read_only=True)
    # Master: the claim's locked terms + the eligible products to map to.
    locked_terms = serializers.SerializerMethodField()
    outcome_label = serializers.SerializerMethodField()
    rejection_reason_label = serializers.SerializerMethodField()

    class Meta:
        model = ManualReviewItem
        fields = [
            "id", "status", "receipt", "created_at",
            # Decision (additive)
            "deadline_at", "outcome", "outcome_label", "rejection_reason",
            "rejection_reason_label", "calculated_reward", "selected_lines",
            "confirmed_product", "resolved_at", "locked_terms",
        ]
        read_only_fields = fields

    def get_outcome_label(self, obj) -> str:
        return obj.get_outcome_display() if obj.outcome else ""

    def get_rejection_reason_label(self, obj) -> str:
        return obj.get_rejection_reason_display() if obj.rejection_reason else ""

    def get_locked_terms(self, obj) -> dict:
        from Apps.products.models import Product
        from Apps.rebates.reward_math import required_units

        reservation = obj.receipt.reservation
        if reservation.deal_type:
            ids = list(reservation.eligible_product_ids)
            needed = required_units(reservation.deal_type, reservation.required_quantity or 1)
            merchants = reservation.allowed_merchants
        else:
            ids = [str(pid) for pid in obj.receipt.campaign.products.values_list("id", flat=True)]
            needed = reservation.campaign.min_purchase_units
            merchants = reservation.campaign.allowed_merchants
        products = Product.objects.filter(id__in=ids).values("id", "name")
        return {
            "deal_type": reservation.deal_type or None,
            "required_units": needed,
            "max_rebate": str(reservation.max_rebate) if reservation.max_rebate is not None else None,
            "fixed_reward": str(reservation.fixed_reward) if reservation.fixed_reward is not None else None,
            "max_reward": str(reservation.reward_amount),
            "eligible_products": [{"id": str(p["id"]), "name": p["name"]} for p in products],
            "eligible_retailers": [m.strip() for m in (merchants or "").split(",") if m.strip()],
            "claimed_at": reservation.created_at,
            "claim_expires_at": reservation.expires_at,
        }


class ReviewLineSerializer(serializers.Serializer):
    line_item = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, required=False)
    unit_price = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=0, required=False, allow_null=True
    )


class ReviewSelectionSerializer(serializers.Serializer):
    """Reviewer's selected receipt lines + confirmed product (Master ④⑤)."""

    lines = ReviewLineSerializer(many=True, required=False)
    product = serializers.UUIDField(required=False)


class ApproveReviewSerializer(ReviewSelectionSerializer):
    # Optional and off by default (Master ⑥).
    save_alias = serializers.BooleanField(required=False, default=False)


class DeclineSerializer(serializers.Serializer):
    # Standardized reason (Master); ``reason`` is an optional extra note.
    reason_code = serializers.ChoiceField(
        choices=ManualReviewItem.RejectionReason.choices, required=False
    )
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs.get("reason_code") and not attrs.get("reason"):
            raise serializers.ValidationError({"reason_code": "Choose a rejection reason."})
        return attrs


class AddAliasInlineSerializer(serializers.Serializer):
    line_item = serializers.UUIDField()
    product = serializers.UUIDField()


class FlagUserSerializer(serializers.Serializer):
    user = serializers.UUIDField()
    reason = serializers.ChoiceField(
        choices=FraudFlag.Reason.choices, default=FraudFlag.Reason.MANUAL
    )
    detail = serializers.CharField(required=False, allow_blank=True, default="")
