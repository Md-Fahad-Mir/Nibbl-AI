from django.urls import reverse
from rest_framework import serializers

from Apps.receipts.models import Receipt
from Apps.reservations.models import Reservation


class ReservationSerializer(serializers.ModelSerializer):
    """Claim details — everything the app needs to submit a receipt."""

    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    # Shopper-facing offer wording (campaign_name is the internal name).
    offer_headline = serializers.CharField(source="campaign.offer_headline", read_only=True)
    brand_name = serializers.CharField(source="campaign.brand.name", read_only=True)
    product_name = serializers.SerializerMethodField()
    # Where the app POSTs the receipt photo. Our own endpoint — the OCR service
    # is internal and is never called directly by the client.
    receipt_upload_url = serializers.SerializerMethodField()
    receipt_status = serializers.SerializerMethodField()
    # Additive (Master Receipt Submission / Outcomes): the claim's locked
    # receipt requirements and the one-resubmission state.
    receipt_requirements = serializers.SerializerMethodField()
    resubmissions_left = serializers.SerializerMethodField()
    last_receipt_rejection = serializers.CharField(read_only=True)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "campaign",
            "campaign_name",
            "offer_headline",
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
            "receipt_requirements",
            "resubmissions_left",
            "last_receipt_rejection",
        ]
        read_only_fields = fields

    def get_receipt_requirements(self, obj) -> dict:
        campaign = obj.campaign
        snapshot = bool(obj.deal_type)
        merchants = (obj.allowed_merchants if snapshot else campaign.allowed_merchants) or ""
        product_ids = obj.eligible_product_ids if snapshot and obj.eligible_product_ids else None
        products = campaign.products.all() if product_ids is None else campaign.products.filter(id__in=product_ids)
        return {
            "purchase_after": obj.created_at,
            "submit_by": obj.expires_at,
            "products": [p.name for p in products],
            "required_quantity": obj.required_quantity or 1,
            "retailers": [m.strip() for m in merchants.split(",") if m.strip()],
        }

    def get_resubmissions_left(self, obj) -> int:
        return 1 if obj.receipt_rejections == 0 else 0

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
    # Two separate, optional marketing consents (email + SMS each).
    consent_nibbl = serializers.BooleanField(required=False, default=False)
    consent_brand = serializers.BooleanField(required=False, default=False)


class ClaimSlotsSerializer(serializers.Serializer):
    used = serializers.IntegerField()
    limit = serializers.IntegerField()
    available = serializers.IntegerField()
