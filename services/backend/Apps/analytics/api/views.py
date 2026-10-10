"""Analytics endpoints: brand dashboards (tenant-scoped) + platform (admin)."""

import datetime as dt

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.analytics import serializers as s
from Apps.analytics import services
from Apps.analytics.models import PlatformStat
from Apps.analytics import discovery
from Apps.analytics.revenue import revenue_dashboard
from Apps.brands.access import get_brand_or_404, require_membership
from Apps.common.permissions import IsPlatformAdmin


@extend_schema(tags=["analytics"])
class BrandOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.BrandOverviewSerializer})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        return Response(s.BrandOverviewSerializer(services.brand_overview(brand)).data)


def _parse_period_days(raw, default: int = 30) -> int:
    """Parse a ?period=<N>d query value (e.g. '30d') into a day count."""
    if not raw:
        return default
    text = str(raw).strip().lower().rstrip("d")
    try:
        n = int(text)
    except ValueError:
        return default
    return n if 1 <= n <= 365 else default


@extend_schema(tags=["analytics"])
class BrandRebatesSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.BrandRebatesSummarySerializer})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        period_days = _parse_period_days(request.query_params.get("period"))
        return Response(
            s.BrandRebatesSummarySerializer(
                services.brand_rebates_summary(brand, period_days=period_days)
            ).data
        )


@extend_schema(tags=["analytics"])
class BrandCampaignAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.CampaignMetricSerializer(many=True)})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        rows = []
        for campaign in brand.campaigns.all():
            rows.append(
                {
                    "campaign_id": campaign.id,
                    "name": campaign.name,
                    "status": campaign.status,
                    **services.campaign_metrics(campaign),
                }
            )
        return Response(s.CampaignMetricSerializer(rows, many=True).data)


@extend_schema(tags=["analytics"])
class BrandProductAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ProductMetricSerializer(many=True)})
    def get(self, request, brand_id):
        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        rows = []
        for product in brand.products.all():
            rows.append(
                {
                    "product_id": product.id,
                    "name": product.name,
                    **services.product_metrics(product),
                }
            )
        return Response(s.ProductMetricSerializer(rows, many=True).data)


@extend_schema(tags=["admin-analytics"])
class PlatformOverviewView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: s.PlatformOverviewSerializer})
    def get(self, request):
        return Response(s.PlatformOverviewSerializer(services.platform_overview()).data)


@extend_schema(tags=["admin-analytics"])
class PlatformSnapshotListView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: s.PlatformStatSerializer(many=True)})
    def get(self, request):
        return Response(
            s.PlatformStatSerializer(PlatformStat.objects.all(), many=True).data
        )


@extend_schema(tags=["analytics"])
class BrandDashboardView(APIView):
    """Dashboard snapshots, conversion and campaign performance to the Master
    definitions (?days=30 default)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        from Apps.analytics.dashboard import brand_dashboard

        brand = get_brand_or_404(brand_id)
        require_membership(request.user, brand)
        try:
            days = max(1, min(int(request.query_params.get("days", 30)), 365))
        except ValueError:
            days = 30
        return Response(brand_dashboard(brand, days))


def _day(value):
    """YYYY-MM-DD → start of that day (aware), or None."""
    if not value:
        return None
    try:
        return timezone.make_aware(dt.datetime.combine(dt.date.fromisoformat(value), dt.time.min))
    except ValueError:
        raise ValidationError({"detail": "Dates must be YYYY-MM-DD."})


def _discovery_filters(params) -> dict:
    end = _day(params.get("to"))
    return {
        "start": _day(params.get("from")), "end": end + dt.timedelta(days=1) if end else None,
        "retailer": params.get("retailer", ""), "state": params.get("state", ""),
        "category": params.get("category", ""), "brand": params.get("brand", ""),
    }


@extend_schema(tags=["admin-analytics"])
class AdminRevenueDashboardView(APIView):
    """Revenue summary, brand-funded rewards, needs-attention counts and
    revenue per brand. ?from=YYYY-MM-DD&to=YYYY-MM-DD (default last 30 days),
    &status=active|suspended &plan=starter|pro|scale &sort=lowest|highest."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request):
        params = request.query_params
        end = _day(params.get("to"))
        return Response(revenue_dashboard(
            start=_day(params.get("from")), end=end + dt.timedelta(days=1) if end else None,
            status=params.get("status", ""), plan=params.get("plan", ""), sort=params.get("sort", "lowest"),
        ))


@extend_schema(tags=["admin-analytics"])
class BrandDiscoveryView(APIView):
    """Receipt Brand Discovery: unpartnered brands on verified receipts.
    ?from&to&brand&category&retailer&state; &export=csv downloads the leads."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request):
        data = discovery.discovery(**_discovery_filters(request.query_params))
        if request.query_params.get("export") != "csv":
            return Response(data)
        import csv
        import io

        from django.http import HttpResponse

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["brand", "product_texts", "categories", "retailers", "states", "unique_shoppers",
                         "receipt_volume", "repeat_purchasers"])
        for lead in data["leads"]:
            writer.writerow([lead["brand"], " | ".join(lead["product_texts"]), " | ".join(lead["categories"]),
                             " | ".join(lead["retailers"]), " | ".join(lead["states"]), lead["unique_shoppers"],
                             lead["receipt_volume"], lead["repeat_purchasers"]])
        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="brand-discovery-leads.csv"'
        return response


@extend_schema(tags=["admin-analytics"])
class BrandDiscoveryInsightView(APIView):
    """Selected Brand Insight + outreach message. PUT {token, display_name,
    ignored} renames/merges or ignores a detected brand."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(responses={200: None})
    def get(self, request, brand):
        from rest_framework.exceptions import NotFound

        row = discovery.insight(brand, **_discovery_filters(request.query_params))
        if row is None:
            raise NotFound("No receipt activity for that brand.")
        return Response(row)

    @extend_schema(request=None, responses={200: None})
    def put(self, request, brand):
        token = str(request.data.get("token") or brand)
        rule = discovery.set_rule(token, display_name=str(request.data.get("display_name", "")),
                                  ignored=bool(request.data.get("ignored")))
        return Response({"token": rule.token, "display_name": rule.display_name, "ignored": rule.ignored})
