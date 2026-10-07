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


class AutoRefillInputSerializer(serializers.Serializer):
    """Write a brand's auto-refill configuration."""

    enabled = serializers.BooleanField()
    amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0")
    )
    payment_method_id = serializers.CharField(
        required=False, allow_blank=True, default=""
    )


class AutoRefillStatusSerializer(serializers.Serializer):
    """Config plus the computed 7-day estimate, trigger point, and recommendation."""

    enabled = serializers.BooleanField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_method_id = serializers.CharField(allow_blank=True)
    estimated_seven_day = serializers.DecimalField(max_digits=10, decimal_places=2)
    trigger_at = serializers.DecimalField(max_digits=10, decimal_places=2)
    recommended_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    last_refilled_at = serializers.DateTimeField(allow_null=True)
