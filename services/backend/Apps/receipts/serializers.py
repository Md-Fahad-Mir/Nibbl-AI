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

    Deliberately omits ``full_fingerprint`` — it is an internal fraud control,
    and exposing it would let a client probe whether a given physical receipt
    has already been used.
    """

    line_items = ReceiptLineItemSerializer(many=True, read_only=True)
    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
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


class ReviewItemSerializer(serializers.ModelSerializer):
    receipt = ReceiptSerializer(read_only=True)

    class Meta:
        model = ManualReviewItem
        fields = ["id", "status", "receipt", "created_at"]
        read_only_fields = fields


class DeclineSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=255)


class AddAliasInlineSerializer(serializers.Serializer):
    line_item = serializers.UUIDField()
    product = serializers.UUIDField()


class FlagUserSerializer(serializers.Serializer):
    user = serializers.UUIDField()
    reason = serializers.ChoiceField(
        choices=FraudFlag.Reason.choices, default=FraudFlag.Reason.MANUAL
    )
    detail = serializers.CharField(required=False, allow_blank=True, default="")
