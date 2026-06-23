"""Request/response serializers for the accounts API.

Serializers validate shape and field-level rules only; cross-cutting business
logic lives in services.py.
"""

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from Apps.accounts.models import SocialAccount, User


class UserSerializer(serializers.ModelSerializer):
    """Public representation of a user (safe fields only)."""

    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "phone",
            "full_name",
            "avatar",
            "avatar_url",
            "role",
            "is_email_verified",
            "is_phone_verified",
            "referral_code",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "email",
            "role",
            "is_email_verified",
            "is_phone_verified",
            "referral_code",
            "created_at",
            "avatar_url",
        ]

    def get_avatar_url(self, obj):
        if obj.avatar:
            request = self.context.get("request")
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class RegisterSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, validators=[validate_password])
    referral_code = serializers.CharField(required=False, allow_blank=True)
    accept_terms = serializers.BooleanField()

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value, is_deleted=False).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_accept_terms(self, value):
        if value is not True:
            raise serializers.ValidationError(
                "You must accept the terms and conditions."
            )
        return value


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    remember_me = serializers.BooleanField(required=False, default=False)


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)


class ResendEmailVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()


class RequestPasswordResetSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(
        write_only=True, validators=[validate_password]
    )


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True, validators=[validate_password]
    )


class AddPhoneSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)


class VerifyPhoneSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["full_name", "avatar"]


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class SocialLoginSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=SocialAccount.Provider.choices)
    token = serializers.CharField()


class ReferralUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "full_name", "created_at"]
        read_only_fields = fields


class ReferralOverviewSerializer(serializers.Serializer):
    referral_code = serializers.CharField()
    total_referrals = serializers.IntegerField()
    referrals = ReferralUserSerializer(many=True)


class ReferralInviteSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255, min_length=2)
    contact = serializers.CharField(max_length=255)


class DeleteAccountSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
