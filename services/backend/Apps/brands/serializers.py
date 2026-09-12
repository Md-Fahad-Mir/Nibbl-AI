from rest_framework import serializers

from Apps.billing.models import Plan
from Apps.billing.serializers import PlanSerializer
from Apps.brands.models import Brand, BrandApplication, BrandMembership


class BrandSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)
    logo = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            "id",
            "name",
            "slug",
            "legal_name",
            "description",
            "website",
            "logo",
            "logo_url",
            "contact_email",
            "status",
            "plan",
            "created_at",
        ]
        read_only_fields = ["id", "slug", "status", "plan", "created_at"]

    def get_logo(self, obj):
        """Relative media path of the uploaded logo, or None."""
        return obj.logo.url if obj.logo else None

    def get_logo_url(self, obj):
        """Absolute URL of the uploaded logo; falls back to the stored URL.

        Brands with no uploaded ``logo`` keep returning their existing
        ``logo_url`` value, so their response is unchanged.
        """
        if obj.logo:
            request = self.context.get("request")
            return (
                request.build_absolute_uri(obj.logo.url) if request else obj.logo.url
            )
        return obj.logo_url or None


class BrandUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = [
            "legal_name",
            "description",
            "website",
            "logo",
            "logo_url",
            "contact_email",
        ]


class BrandApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrandApplication
        fields = [
            "id",
            "brand_name",
            "contact_email",
            "website",
            "message",
            "requested_plan",
            "status",
            "decision_reason",
            "brand",
            "reviewed_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "decision_reason",
            "brand",
            "reviewed_at",
            "created_at",
        ]

    requested_plan = serializers.SlugRelatedField(
        slug_field="slug",
        queryset=Plan.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )


class BrandMembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = BrandMembership
        fields = [
            "id",
            "user",
            "user_email",
            "user_full_name",
            "role",
            "is_active",
            "created_at",
        ]
        read_only_fields = fields


class AddMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(
        choices=[
            (BrandMembership.Role.ADMIN, "Admin"),
            (BrandMembership.Role.MEMBER, "Member"),
        ],
        default=BrandMembership.Role.MEMBER,
    )


class RejectApplicationSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")
