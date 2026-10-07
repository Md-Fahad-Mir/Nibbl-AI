from decimal import Decimal

from rest_framework import serializers

from Apps.billing.models import Plan


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "monthly_price",
            "rebate_fee_percent",
            "review_fee",
            "data_access_level",
            "customer_data_module",
            "sort_order",
        ]
        read_only_fields = fields


class AddFundsSerializer(serializers.Serializer):
    """Request to add funds to the brand wallet via a Stripe card payment."""

    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.50")
    )


class TopupIntentSerializer(serializers.Serializer):
    """The PaymentIntent details the frontend needs to confirm the card."""

    client_secret = serializers.CharField()
    payment_intent_id = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)


class SetupIntentSerializer(serializers.Serializer):
    """The SetupIntent details the frontend needs to save a card."""

    client_secret = serializers.CharField()
    setup_intent_id = serializers.CharField()


class SavedCardSerializer(serializers.Serializer):
    id = serializers.CharField()
    brand = serializers.CharField(allow_null=True)
    last4 = serializers.CharField(allow_null=True)
    exp_month = serializers.IntegerField(allow_null=True)
    exp_year = serializers.IntegerField(allow_null=True)


class AutoRefillSerializer(serializers.Serializer):
    """Read/write a brand's auto-refill configuration."""

    enabled = serializers.BooleanField()
    threshold = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0")
    )
    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0")
    )
    payment_method_id = serializers.CharField(
        source="stripe_payment_method_id",
        required=False,
        allow_blank=True,
        default="",
    )
    last_refilled_at = serializers.DateTimeField(read_only=True)
