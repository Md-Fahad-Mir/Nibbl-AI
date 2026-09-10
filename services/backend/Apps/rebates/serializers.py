from rest_framework import serializers

from Apps.rebates.models import Redemption


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
