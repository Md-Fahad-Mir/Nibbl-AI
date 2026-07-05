"""HTTP layer for brands: applications, brand profile, membership, admin ops."""

from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from Apps.brands import serializers as s
from Apps.brands import services
from Apps.brands.models import Brand, BrandApplication, BrandMembership
from Apps.brands.selectors import brands_for_user, get_active_membership
from Apps.brands.services import BrandError
from Apps.common.permissions import IsPlatformAdmin


def _run(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except BrandError as exc:
        raise ValidationError({"detail": str(exc)})


def _require_membership(user, brand, *, manager=False, active=False) -> BrandMembership:
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


def _get_brand_or_404(brand_id) -> Brand:
    brand = Brand.objects.filter(id=brand_id).first()
    if brand is None:
        raise NotFound("Brand not found.")
    return brand


# ---------------------------------------------------------------------------
# Applications (applicant-facing)
# ---------------------------------------------------------------------------
@extend_schema(tags=["brand-applications"])
class BrandApplicationListCreateView(generics.ListCreateAPIView):
    serializer_class = s.BrandApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BrandApplication.objects.filter(applicant=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        application = _run(
            services.submit_application,
            applicant=request.user,
            brand_name=data["brand_name"],
            contact_email=data["contact_email"],
            website=data.get("website", ""),
            message=data.get("message", ""),
            requested_plan=data.get("requested_plan"),
        )
        return Response(
            s.BrandApplicationSerializer(application).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["brand-applications"])
class BrandApplicationDetailView(generics.RetrieveAPIView):
    serializer_class = s.BrandApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BrandApplication.objects.filter(applicant=self.request.user)


# ---------------------------------------------------------------------------
# Brand profile + membership (member-facing)
# ---------------------------------------------------------------------------
@extend_schema(tags=["brands"])
class MyBrandListView(generics.ListAPIView):
    serializer_class = s.BrandSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return brands_for_user(self.request.user)


@extend_schema(tags=["brands"])
class BrandDetailView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.BrandSerializer})
    def get(self, request, brand_id):
        brand = _get_brand_or_404(brand_id)
        _require_membership(request.user, brand)
        return Response(s.BrandSerializer(brand).data)

    @extend_schema(request=s.BrandUpdateSerializer, responses={200: s.BrandSerializer})
    def patch(self, request, brand_id):
        brand = _get_brand_or_404(brand_id)
        _require_membership(request.user, brand, manager=True, active=True)
        serializer = s.BrandUpdateSerializer(brand, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(s.BrandSerializer(brand).data)


@extend_schema(tags=["brands"])
class BrandMembershipListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.BrandMembershipSerializer(many=True)})
    def get(self, request, brand_id):
        brand = _get_brand_or_404(brand_id)
        _require_membership(request.user, brand)
        members = brand.memberships.select_related("user").all()
        return Response(s.BrandMembershipSerializer(members, many=True).data)

    @extend_schema(request=s.AddMemberSerializer, responses={201: s.BrandMembershipSerializer})
    def post(self, request, brand_id):
        brand = _get_brand_or_404(brand_id)
        _require_membership(request.user, brand, manager=True, active=True)
        serializer = s.AddMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = _run(
            services.add_member,
            brand=brand,
            email=serializer.validated_data["email"],
            role=serializer.validated_data["role"],
        )
        return Response(
            s.BrandMembershipSerializer(membership).data,
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["brands"])
class BrandMembershipDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={204: None})
    def delete(self, request, brand_id, membership_id):
        brand = _get_brand_or_404(brand_id)
        _require_membership(request.user, brand, manager=True, active=True)
        membership = brand.memberships.filter(id=membership_id).first()
        if membership is None:
            raise NotFound("Membership not found.")
        _run(services.remove_member, membership=membership)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Admin operations
# ---------------------------------------------------------------------------
@extend_schema(tags=["admin-brands"])
class AdminApplicationListView(generics.ListAPIView):
    serializer_class = s.BrandApplicationSerializer
    permission_classes = [IsPlatformAdmin]

    def get_queryset(self):
        qs = BrandApplication.objects.select_related("applicant").all()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs


@extend_schema(tags=["admin-brands"])
class ApproveApplicationView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: s.BrandSerializer})
    def post(self, request, application_id):
        application = BrandApplication.objects.filter(id=application_id).first()
        if application is None:
            raise NotFound("Application not found.")
        brand = _run(
            services.approve_application, application=application, reviewer=request.user
        )
        return Response(s.BrandSerializer(brand).data)


@extend_schema(tags=["admin-brands"])
class RejectApplicationView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=s.RejectApplicationSerializer, responses={200: s.BrandApplicationSerializer})
    def post(self, request, application_id):
        application = BrandApplication.objects.filter(id=application_id).first()
        if application is None:
            raise NotFound("Application not found.")
        serializer = s.RejectApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = _run(
            services.reject_application,
            application=application,
            reviewer=request.user,
            reason=serializer.validated_data.get("reason", ""),
        )
        return Response(s.BrandApplicationSerializer(application).data)


@extend_schema(tags=["admin-brands"])
class AdminBrandListView(generics.ListAPIView):
    serializer_class = s.BrandSerializer
    permission_classes = [IsPlatformAdmin]

    def get_queryset(self):
        qs = Brand.objects.select_related("plan").all()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs


@extend_schema(tags=["admin-brands"])
class SuspendBrandView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: s.BrandSerializer})
    def post(self, request, brand_id):
        brand = _get_brand_or_404(brand_id)
        brand = _run(services.suspend_brand, brand=brand, admin=request.user)
        return Response(s.BrandSerializer(brand).data)


@extend_schema(tags=["admin-brands"])
class ReactivateBrandView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(request=None, responses={200: s.BrandSerializer})
    def post(self, request, brand_id):
        brand = _get_brand_or_404(brand_id)
        brand = _run(services.reactivate_brand, brand=brand, admin=request.user)
        return Response(s.BrandSerializer(brand).data)


# ---------------------------------------------------------------------------
# Customers module (plan-gated data access)
# ---------------------------------------------------------------------------
@extend_schema(tags=["brands"])
class BrandCustomerListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request, brand_id):
        from Apps.brands.customers import brand_customers

        brand = _get_brand_or_404(brand_id)
        _require_membership(request.user, brand)
        return Response(brand_customers(brand))
