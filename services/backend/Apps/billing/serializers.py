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
