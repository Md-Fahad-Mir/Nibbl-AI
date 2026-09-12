from rest_framework import serializers

from Apps.rebates.models import Redemption
from Apps.receipts.serializers import ReceiptLineItemSerializer
from Apps.reviews.models import Review


class RedemptionSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    receipt_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Redemption
        fields = [
            "id",
            "reservation",
            "receipt",
            "receipt_image_url",
            "campaign",
            "campaign_name",
            "brand_name",
            "user_email",
            "reward_amount",
            "fee_amount",
            "status",
            "issued_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_receipt_image_url(self, obj):
        receipt = obj.receipt
        if receipt and receipt.image:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(receipt.image.url)
            return receipt.image.url
        return None


class BrandRedemptionDetailSerializer(serializers.ModelSerializer):
    """Brand-scoped single redemption with nested campaign, customer and receipt.

    A dedicated read serializer for the new
    GET /brands/{brand_id}/redemptions/{redemption_id}/ endpoint. It does not
    touch the existing list serializer, so no shipped response changes shape.
    """

    campaign = serializers.SerializerMethodField()
    customer = serializers.SerializerMethodField()
    receipt = serializers.SerializerMethodField()

    class Meta:
        model = Redemption
        fields = [
            "id",
            "status",
            "campaign",
            "customer",
            "receipt",
            "reward_amount",
            "fee_amount",
            "issued_at",
        ]
        read_only_fields = fields

    def _absolute_url(self, file_field):
        if not file_field:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(file_field.url) if request else file_field.url

    def get_campaign(self, obj):
        return {"id": obj.campaign_id, "name": obj.campaign.name}

    def get_customer(self, obj):
        user = obj.user
        return {
            "id": user.id,
            "name": user.full_name,
            "email": user.email,
            "avatar_url": self._absolute_url(user.avatar),
            "redemptions_count": Redemption.objects.filter(
                user=user, brand=obj.brand
            ).count(),
            "reviews_count": Review.objects.filter(user=user, brand=obj.brand).count(),
        }

    def get_receipt(self, obj):
        receipt = obj.receipt
        if receipt is None:
            return None
        return {
            "id": receipt.id,
            "image_url": self._absolute_url(receipt.image),
            "merchant": receipt.merchant,
            "purchased_at": receipt.purchased_at,
            "total": str(receipt.total) if receipt.total is not None else None,
            "status": receipt.status,
            "line_items": ReceiptLineItemSerializer(
                receipt.line_items.all(), many=True
            ).data,
        }
