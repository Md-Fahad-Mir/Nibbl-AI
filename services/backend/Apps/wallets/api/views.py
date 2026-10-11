"""Wallet HTTP layer: brand escrow wallet + customer wallet."""

import datetime as dt

from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.brands.models import Brand
from Apps.brands.selectors import get_active_membership
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.wallets import serializers as s
from Apps.wallets import services, statements
from Apps.wallets.selectors import customer_statement, ledger_for_wallet


def _brand_or_404(brand_id) -> Brand:
    brand = Brand.objects.filter(id=brand_id).first()
    if brand is None:
        raise NotFound("Brand not found.")
    return brand


def _require_membership(user, brand, *, manager=False, active=False):
    """Enforce brand tenancy — platform admins bypass all checks."""
    if getattr(user, "is_platform_admin", False):
        return get_active_membership(user, brand)

    membership = get_active_membership(user, brand)
    if membership is None:
        raise PermissionDenied("You are not a member of this brand.")
    if manager and not membership.is_manager:
        raise PermissionDenied("Brand owner/admin role required.")
    if active and not brand.is_operational:
        raise PermissionDenied("This brand is suspended.")
    return membership


# ---------------------------------------------------------------------------
# Brand (escrow) wallet
# ---------------------------------------------------------------------------
@extend_schema(tags=["wallets"])
class BrandRefundRequestView(APIView):
    """Master Wallet "Request Refund". GET: refundable Available Cash + the
    brand's requests. POST {amount, reason}: Owner only (billing)."""

    permission_classes = [IsAuthenticated]

    def _payload(self, brand):
        from Apps.wallets import refunds

        wallet = services.get_or_create_brand_wallet(brand)
        return {
            "refundable": str(refunds.refundable(wallet)),
            "requests": [refunds.row(r) for r in brand.refund_requests.select_related("brand", "requested_by")[:50]],
        }

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        brand = _brand_or_404(brand_id)
        _require_membership(request.user, brand)
        return Response(self._payload(brand))

    @extend_schema(request=None, responses={201: None})
    def post(self, request, brand_id):
        from Apps.brands.access import require_membership
        from Apps.wallets import refunds

        brand = _brand_or_404(brand_id)
        require_membership(request.user, brand, owner=True)
        try:
            refunds.request_refund(
                brand, amount=request.data.get("amount"), reason=str(request.data.get("reason", "")), user=request.user,
            )
        except refunds.RefundError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(self._payload(brand), status=201)


@extend_schema(tags=["wallets"])
class BrandWalletView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.WalletSerializer})
    def get(self, request, brand_id):
        brand = _brand_or_404(brand_id)
        _require_membership(request.user, brand)
        wallet = services.get_or_create_brand_wallet(brand)
        return Response(s.WalletSerializer(wallet).data)


@extend_schema(tags=["wallets"])
class BrandWalletTransactionsView(generics.ListAPIView):
    serializer_class = s.LedgerEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        brand = _brand_or_404(self.kwargs["brand_id"])
        _require_membership(self.request.user, brand)
        wallet = services.get_or_create_brand_wallet(brand)
        return ledger_for_wallet(wallet)


@extend_schema(tags=["wallets"])
class BrandWalletLedgerExportView(APIView):
    """CSV export of the brand wallet's detailed ledger: every ledger entry
    plus reward reservations and released reservations.
    Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD (inclusive)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        brand = _brand_or_404(brand_id)
        _require_membership(request.user, brand)
        wallet = services.get_or_create_brand_wallet(brand)
        start = _parse_day(request.query_params.get("from"))
        end = _parse_day(request.query_params.get("to"))
        rows = statements.ledger_rows(
            wallet,
            start=statements.day_bounds(start)[0] if start else None,
            end=statements.day_bounds(end)[0] + dt.timedelta(days=1) if end else None,
        )
        return _csv(
            f"{brand.slug}-wallet-ledger.csv",
            [statements.LEDGER_HEADER, *(statements.ledger_csv_row(r) for r in rows)],
        )


def _parse_day(value):
    if not value:
        return None
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        raise ValidationError({"detail": "Dates must be YYYY-MM-DD."})


def _csv(filename, rows):
    import csv
    import io

    from django.http import HttpResponse

    buffer = io.StringIO()
    csv.writer(buffer).writerows(rows)
    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@extend_schema(tags=["wallets"])
class BrandFundingView(APIView):
    """Campaign Funding (7-day need vs Available Funds) + Spending Overview
    for ?from=&to= (default last 30 days)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        from django.utils import timezone

        brand = _brand_or_404(brand_id)
        _require_membership(request.user, brand)
        wallet = services.get_or_create_brand_wallet(brand)
        start = _parse_day(request.query_params.get("from"))
        end = _parse_day(request.query_params.get("to"))
        begin = statements.day_bounds(start)[0] if start else timezone.now() - dt.timedelta(days=30)
        finish = statements.day_bounds(end)[0] + dt.timedelta(days=1) if end else timezone.now()
        return Response({
            "funding": statements.campaign_funding(brand),
            "spending": {"from": begin, "to": finish, **statements.spending(wallet, begin, finish)},
        })


@extend_schema(tags=["wallets"])
class BrandWeeklyStatementsView(APIView):
    """One summarized row per week, newest first (?weeks=, default 12, max 104)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        brand = _brand_or_404(brand_id)
        _require_membership(request.user, brand)
        wallet = services.get_or_create_brand_wallet(brand)
        try:
            weeks = min(max(int(request.query_params.get("weeks", 12)), 1), 104)
        except ValueError:
            weeks = 12
        return Response(statements.weekly_statements(wallet, weeks))


@extend_schema(tags=["wallets"])
class BrandWeeklyStatementExportView(APIView):
    """CSV for one week: the summary, then that week's detailed ledger."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id, week_start):
        brand = _brand_or_404(brand_id)
        _require_membership(request.user, brand)
        wallet = services.get_or_create_brand_wallet(brand)
        start = statements.week_start(_parse_day(week_start))
        summary = statements.week_summary(wallet, start)
        begin, end = statements.day_bounds(start)
        rows = [
            ["Weekly statement", brand.name],
            ["Week", f"{summary['week_start']} to {summary['week_end']}"],
            ["Rebate rewards", summary["rebate_rewards"]],
            ["Review rewards", summary["review_rewards"]],
            ["Fees", summary["fees"]],
            ["Plan charges", summary["plan_charges"]],
            ["Credits applied", summary["credits_applied"]],
            ["Total cash spent", summary["total_cash_spent"]],
            [],
            statements.LEDGER_HEADER,
            *(statements.ledger_csv_row(r) for r in statements.ledger_rows(wallet, start=begin, end=end)),
        ]
        return _csv(f"{brand.slug}-statement-{start}.csv", rows)


# ---------------------------------------------------------------------------
# Customer wallet
# ---------------------------------------------------------------------------
@extend_schema(tags=["wallets"])
class CustomerWalletView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.WalletSerializer})
    def get(self, request):
        wallet = services.get_or_create_customer_wallet(request.user)
        return Response(s.WalletSerializer(wallet).data)


@extend_schema(tags=["wallets"])
class CustomerWalletTransactionsView(generics.ListAPIView):
    serializer_class = s.LedgerEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        wallet = services.get_or_create_customer_wallet(self.request.user)
        return ledger_for_wallet(wallet)


@extend_schema(tags=["wallets"])
class CustomerActivityView(generics.ListAPIView):
    """Normalized customer activity feed (Rewards Hub) — the money trail."""

    serializer_class = s.ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        wallet = services.get_or_create_customer_wallet(self.request.user)
        return ledger_for_wallet(wallet)


@extend_schema(tags=["wallets"])
class CustomerStatementView(APIView):
    """Merged statement: completed ledger entries + open (pending) withdrawals."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        operation_id="wallet_statement",
        responses={200: paginated_response_serializer(s.StatementItemSerializer)},
    )
    def get(self, request):
        items = customer_statement(request.user)
        return paginate(self, request, items, s.StatementItemSerializer)
