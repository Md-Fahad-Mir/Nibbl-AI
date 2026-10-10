"""HTTP layer for the accounts app. Thin views that delegate to services."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from Apps.accounts import serializers as s
from Apps.accounts import services
from Apps.accounts.models import User
from Apps.accounts.services import AccountError


def _run(func, *args, **kwargs):
    """Call a service, translating AccountError into a DRF 400 response."""
    try:
        return func(*args, **kwargs)
    except AccountError as exc:
        from rest_framework.exceptions import ValidationError

        raise ValidationError({"detail": str(exc)})


@extend_schema(tags=["auth"])
class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=s.RegisterSerializer, responses={201: s.UserSerializer})
    def post(self, request):
        serializer = s.RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        pending = _run(
            services.register_user,
            full_name=data["full_name"],
            email=data["email"],
            password=data["password"],
            role=data["role"],
            referral_code=data.get("referral_code") or None,
            verify_via=data.get("verify_via", "code"),
            brand_application=data.get("brand_application") or {},
        )
        return Response(
            {
                "id": None,
                "email": pending.email,
                "phone": None,
                "full_name": pending.full_name,
                "role": pending.role,
                "is_approved": pending.role != User.Role.BRAND,
                "is_email_verified": False,
                "is_phone_verified": False,
                "referral_code": "",
                "created_at": pending.created_at,
            },
            status=status.HTTP_201_CREATED,
        )


@extend_schema(tags=["auth"])
class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=s.LoginSerializer, responses={200: s.TokenPairSerializer})
    def post(self, request):
        serializer = s.LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        result = _run(
            services.login,
            email=data["email"],
            password=data["password"],
            remember_me=data["remember_me"],
            client={
                "ip": request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
                or request.META.get("REMOTE_ADDR"),
                "user_agent": request.META.get("HTTP_USER_AGENT", ""),
            },
        )
        user_data = s.UserSerializer(result["user"], context={"request": request}).data
        return Response(
            {**result["tokens"], "user": user_data},
            status=status.HTTP_200_OK,
        )


@extend_schema(tags=["auth"])
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.LogoutSerializer, responses={205: None})
    def post(self, request):
        serializer = s.LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "Invalid or expired refresh token."})
        return Response(status=status.HTTP_205_RESET_CONTENT)


@extend_schema(tags=["auth"])
class VerifyEmailView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=s.VerifyEmailSerializer, responses={200: s.UserSerializer})
    def post(self, request):
        serializer = s.VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _run(services.verify_email, **serializer.validated_data)
        return Response(s.UserSerializer(user).data)


@extend_schema(tags=["auth"])
class ResendEmailVerificationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=s.ResendEmailVerificationSerializer, responses={202: None}
    )
    def post(self, request):
        serializer = s.ResendEmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.resend_email_verification(
            email=serializer.validated_data["email"],
            verify_via=serializer.validated_data["verify_via"],
        )
        # Always 202 to avoid leaking which emails exist.
        return Response(status=status.HTTP_202_ACCEPTED)


@extend_schema(tags=["auth"])
class RequestPasswordResetView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=s.RequestPasswordResetSerializer, responses={202: None})
    def post(self, request):
        serializer = s.RequestPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_password_reset(**serializer.validated_data)
        return Response(status=status.HTTP_202_ACCEPTED)


@extend_schema(tags=["auth"])
class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=s.ResetPasswordSerializer, responses={200: None})
    def post(self, request):
        serializer = s.ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(services.reset_password, **serializer.validated_data)
        return Response({"detail": "Password has been reset."})


@extend_schema(tags=["auth"])
class SocialLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=s.SocialLoginSerializer, responses={200: s.TokenPairSerializer})
    def post(self, request):
        serializer = s.SocialLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tokens = _run(services.social_login, **serializer.validated_data)
        return Response(tokens)


@extend_schema(tags=["users"])
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.UserSerializer})
    def get(self, request):
        return Response(s.UserSerializer(request.user).data)

    @extend_schema(request=s.ProfileUpdateSerializer, responses={200: s.UserSerializer})
    def patch(self, request):
        serializer = s.ProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(s.UserSerializer(request.user).data)

    @extend_schema(request=s.DeleteAccountSerializer, responses={204: None})
    def delete(self, request):
        # Re-authenticate before an irreversible, destructive action.
        serializer = s.DeleteAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["password"]):
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "Password is incorrect."})
        services.delete_account(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["users"])
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.ChangePasswordSerializer, responses={200: None})
    def post(self, request):
        serializer = s.ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(services.change_password, request.user, **serializer.validated_data)
        return Response({"detail": "Password changed."})


@extend_schema(tags=["users"])
class AddPhoneView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.AddPhoneSerializer, responses={202: None})
    def post(self, request):
        serializer = s.AddPhoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        _run(services.start_phone_verification, request.user, **serializer.validated_data)
        # The normalized number the code was sent to, e.g. "+8801617078998".
        return Response({"phone": request.user.phone}, status=status.HTTP_202_ACCEPTED)


@extend_schema(tags=["users"])
class VerifyPhoneView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(request=s.VerifyPhoneSerializer, responses={200: s.UserSerializer})
    def post(self, request):
        serializer = s.VerifyPhoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = _run(services.verify_phone, request.user, **serializer.validated_data)
        return Response(s.UserSerializer(user).data)


@extend_schema(tags=["users"])
class ReferralView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: s.ReferralOverviewSerializer})
    def get(self, request):
        referrals = request.user.referrals.filter(is_deleted=False)
        payload = {
            "referral_code": request.user.referral_code,
            "total_referrals": referrals.count(),
            "referrals": referrals,
        }
        return Response(s.ReferralOverviewSerializer(payload).data)


@extend_schema(tags=["users"])
class ReferralInviteView(APIView):
    """Send a referral invite to a friend by email (phone gated until SMS)."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "invite"

    @extend_schema(request=s.ReferralInviteSerializer, responses={202: None})
    def post(self, request):
        serializer = s.ReferralInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = _run(
            services.send_referral_invite,
            inviter=request.user,
            full_name=serializer.validated_data["full_name"],
            contact=serializer.validated_data["contact"],
        )
        return Response(result, status=status.HTTP_202_ACCEPTED)


@extend_schema(tags=["users"])
class MarketingConsentListView(APIView):
    """The shopper's email+SMS marketing consents: Nibbl's (brand null) and
    each brand's, with status and dates."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: None})
    def get(self, request):
        from Apps.accounts.models import MarketingConsent

        consents = MarketingConsent.objects.filter(user=request.user).select_related("brand")
        return Response([
            {
                "brand": str(c.brand_id) if c.brand_id else None,
                "brand_name": c.brand.name if c.brand_id else "NibblAI",
                "opted_in": c.opted_in,
                "consented_at": c.consented_at,
                "withdrawn_at": c.revoked_at,
            }
            for c in consents.order_by("brand__name")
        ])


@extend_schema(tags=["users"])
class MarketingConsentWithdrawView(APIView):
    """Withdraw marketing consent: {"brand": "<uuid>"} for one brand, or
    {"brand": null} for NibblAI. History is kept; the brand sees Opted Out
    and the shopper is left out of its downloads."""

    permission_classes = [IsAuthenticated]

    @extend_schema(request=None, responses={200: None})
    def post(self, request):
        from django.utils import timezone

        from Apps.accounts.models import MarketingConsent

        brand = (request.data or {}).get("brand")
        consent = MarketingConsent.objects.filter(
            user=request.user, **({"brand_id": brand} if brand else {"brand__isnull": True})
        ).first()
        if consent is None:
            raise NotFound("No marketing consent to withdraw.")
        if consent.opted_in:
            consent.opted_in = False
            consent.revoked_at = timezone.now()
            consent.save(update_fields=["opted_in", "revoked_at", "updated_at"])
        return Response({"brand": brand, "opted_in": False, "withdrawn_at": consent.revoked_at})


def _current_sid(request):
    token = getattr(request, "auth", None)
    return token.get("sid") if token is not None and hasattr(token, "get") else None


@extend_schema(tags=["users"])
class SessionListView(APIView):
    """Security overview: sign-in method, most recent sign-in and active
    sessions (Master: Settings §5)."""

    @extend_schema(responses={200: None})
    def get(self, request):
        current = _current_sid(request)
        sessions = services.active_sessions(request.user)
        return Response({
            "passwordless_enabled": False,
            "sign_in_method": "Email and password",
            "last_sign_in": request.user.last_login,
            "sessions": [
                {
                    "id": str(x.id), "current": str(x.id) == str(current), "ip_address": x.ip_address,
                    "user_agent": x.user_agent, "signed_in_at": x.created_at, "last_used_at": x.last_used_at,
                }
                for x in sessions
            ],
        })


@extend_schema(tags=["users"])
class SignOutOtherSessionsView(APIView):
    @extend_schema(request=None, responses={200: None})
    def post(self, request):
        count = services.sign_out_other_sessions(request.user, current_sid=_current_sid(request))
        return Response({"signed_out": count})
