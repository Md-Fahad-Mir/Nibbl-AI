from django.urls import reverse
from rest_framework import serializers

from Apps.receipts.models import Receipt
from Apps.reservations.models import Reservation


class ReservationSerializer(serializers.ModelSerializer):
    """Claim details — everything the app needs to submit a receipt."""

    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    brand_name = serializers.CharField(source="campaign.brand.name", read_only=True)
    product_name = serializers.SerializerMethodField()
    # Where the app POSTs the receipt photo. Our own endpoint — the OCR service
    # is internal and is never called directly by the client.
    receipt_upload_url = serializers.SerializerMethodField()
    receipt_status = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            "id",
            "campaign",
            "campaign_name",
            "brand_name",
            "product_name",
            "kind",
            "offer_type",
            "reward_amount",
            "status",
            "expires_at",
            "redeemed_at",
            "created_at",
            "receipt_upload_url",
            "receipt_status",
        ]
        read_only_fields = fields

    def get_product_name(self, obj):
        first_product = obj.campaign.products.first()
        return first_product.name if first_product else ""

    def get_receipt_upload_url(self, obj):
        path = reverse("v1:receipts:receipt-list")
        request = self.context.get("request")
        return request.build_absolute_uri(path) if request else path

    def get_receipt_status(self, obj):
        receipt = (
            obj.receipts.exclude(status=Receipt.Status.REJECTED)
            .order_by("-created_at")
            .first()
        ) or obj.receipts.order_by("-created_at").first()
        return receipt.status if receipt else None


class CreateReservationSerializer(serializers.Serializer):
    campaign = serializers.UUIDField()
