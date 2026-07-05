"""Wallet HTTP layer: brand escrow wallet + customer wallet."""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.brands.models import Brand
from Apps.brands.selectors import get_active_membership
from Apps.common.pagination import paginate, paginated_response_serializer
from Apps.wallets import serializers as s
from Apps.wallets import services
from Apps.wallets.models import LedgerEntry
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
class FundBrandWalletView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.FundWalletSerializer, responses={200: s.WalletSerializer})
    def post(self, request, brand_id):
        brand = _brand_or_404(brand_id)
        _require_membership(request.user, brand, manager=True, active=True)
        serializer = s.FundWalletSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        wallet = services.get_or_create_brand_wallet(brand)
        try:
            # Mock funding provider — real escrow funding integrates here.
            services.credit(
                wallet=wallet,
                amount=serializer.validated_data["amount"],
                category=LedgerEntry.Category.FUNDING,
                reference_type="funding",
                description="Wallet funding (mock)",
                idempotency_key=serializer.validated_data.get("idempotency_key") or None,
            )
        except services.WalletError as exc:
            raise ValidationError({"detail": str(exc)})

        wallet.refresh_from_db()
        return Response(s.WalletSerializer(wallet).data, status=status.HTTP_200_OK)


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
