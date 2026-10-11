"""Redemption history: consumer (own) + brand (tenant-scoped)."""

from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.brands.access import get_brand_or_404, require_membership
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.rebates import serializers as s
from Apps.rebates.selectors import (
    get_brand_redemption,
    get_user_redemption,
    redemptions_for_brand,
    redemptions_for_user,
)


@extend_schema(tags=["redemptions"])
class RedemptionListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="redemptions_list",
        responses={200: paginated_response_serializer(s.RedemptionSerializer)},
    )
    def get(self, request):
        return paginate(
            self, request, redemptions_for_user(request.user), s.RedemptionSerializer
        )


@extend_schema(tags=["redemptions"])
class RedemptionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.RedemptionSerializer})
    def get(self, request, redemption_id):
        redemption = get_user_redemption(request.user, redemption_id)
        if redemption is None:
            raise NotFound("Redemption not found.")
        return Response(
            s.RedemptionSerializer(redemption, context={"request": request}).data
        )


@extend_schema(tags=["redemptions"])
class BrandRedemptionListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.RedemptionSerializer(many=True)})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        return Response(
            s.RedemptionSerializer(
                redemptions_for_brand(brand), many=True, context={"request": request}
            ).data
        )


@extend_schema(tags=["redemptions"])
class BrandRedemptionExportView(APIView):
    """CSV of the brand's approved redemptions (Master: Redemptions ⑥ Export).
    Customer identity follows the plan: name + email on full-access plans,
    the anonymous ``cust_`` reference otherwise."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        import csv
        import io

        from django.http import HttpResponse

        from Apps.brands.customers import _anon_ref, _full_access

        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        full = _full_access(brand)
        serializer = s.RedemptionSerializer(context={"request": request})
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["redemption_id", "approved_at", "campaign", "offer", "customer", "customer_email",
                         "retailer", "purchase_date", "reward", "nibbl_fee", "approval"])
        for r in redemptions_for_brand(brand).select_related("campaign", "user", "receipt"):
            writer.writerow([
                r.id, (r.issued_at or r.created_at).isoformat(), r.campaign.name, r.campaign.offer_headline,
                r.user.full_name if full else _anon_ref(brand.id, r.user_id),
                r.user.email if full else "",
                r.receipt.merchant if r.receipt_id else "",
                r.receipt.purchased_at.date().isoformat() if r.receipt_id and r.receipt.purchased_at else "",
                r.reward_amount, r.fee_amount, serializer.get_approval_label(r),
            ])
        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{brand.slug}-redemptions.csv"'
        return response


@extend_schema(tags=["redemptions"])
class BrandRedemptionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.BrandRedemptionDetailSerializer})
    def get(self, request, brand_id, redemption_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        redemption = get_brand_redemption(brand, redemption_id)
        if redemption is None:
            raise NotFound("Redemption not found.")
        return Response(
            s.BrandRedemptionDetailSerializer(
                redemption, context={"request": request}
            ).data
        )
