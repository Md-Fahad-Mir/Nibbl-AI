from decimal import Decimal

from rest_framework import serializers

from Apps.campaigns.models import Campaign
from Apps.common.models import AuditLog
from Apps.receipts.models import FraudFlag
from Apps.reviews.models import Review
from Apps.wallets.models import LedgerEntry


class PromoCreditSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01")
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")


class ChangePlanSerializer(serializers.Serializer):
    plan = serializers.CharField()


class SuspendUserSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class BroadcastSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    message = serializers.CharField(max_length=500)


class AdminCampaignSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id", "name", "status", "brand", "brand_name", "product_name",
            "daily_budget", "auto_paused", "created_at",
        ]
        read_only_fields = fields


class FraudFlagSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True, default=None)

    class Meta:
        model = FraudFlag
        fields = ["id", "user", "user_email", "brand", "brand_name", "reason", "detail", "resolved", "created_at"]
        read_only_fields = fields


class AdminUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    full_name = serializers.CharField()
    role = serializers.CharField()
    is_active = serializers.BooleanField()
    is_email_verified = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class AdminLedgerEntrySerializer(serializers.ModelSerializer):
    wallet_kind = serializers.CharField(source="wallet.kind", read_only=True)

    class Meta:
        model = LedgerEntry
        fields = ["id", "wallet", "wallet_kind", "entry_type", "amount", "category", "balance_after", "description", "created_at"]
        read_only_fields = fields


class HeldReviewSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    brand_name = serializers.CharField(source="review_campaign.brand.name", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "product_name", "brand_name", "rating", "content", "status", "created_at"]
        read_only_fields = fields


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ["id", "action", "actor_type", "actor_id", "target_type", "target_id", "metadata", "created_at"]
        read_only_fields = fields


class RoleStatisticsSerializer(serializers.Serializer):
    consumers = serializers.IntegerField()
    brands = serializers.IntegerField()
    admins = serializers.IntegerField()
    total = serializers.IntegerField()

