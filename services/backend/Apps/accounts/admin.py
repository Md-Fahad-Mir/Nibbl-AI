from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from Apps.accounts.models import SocialAccount, User, VerificationCode


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-created_at",)
    list_display = ("email", "full_name", "role", "is_approved", "is_email_verified", "is_active", "created_at")
    list_filter = ("role", "is_approved", "is_active", "is_email_verified", "is_phone_verified", "is_staff")
    search_fields = ("email", "full_name", "phone", "referral_code")
    readonly_fields = ("id", "referral_code", "last_login", "created_at", "updated_at")
    actions = ["approve_brands"]

    fieldsets = (
        (None, {"fields": ("id", "email", "password")}),
        ("Profile", {"fields": ("full_name", "phone", "role")}),
        ("Verification", {"fields": ("is_approved", "is_email_verified", "is_phone_verified", "accepted_terms_at")}),
        ("Referral", {"fields": ("referral_code", "referred_by")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Deletion", {"fields": ("is_deleted", "deleted_at")}),
        ("Important dates", {"fields": ("last_login", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("email", "full_name", "password1", "password2"),
        }),
    )

    @admin.action(description="Approve selected brand accounts")
    def approve_brands(self, request, queryset):
        from Apps.brands.services import ensure_brand_for_user

        pending = queryset.filter(is_approved=False)
        approved = 0
        for user in pending:
            user.is_approved = True
            user.save(update_fields=["is_approved", "updated_at"])
            if user.role == User.Role.BRAND:
                ensure_brand_for_user(user)
            approved += 1
        self.message_user(request, f"{approved} brand account(s) approved.")


@admin.register(VerificationCode)
class VerificationCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "purpose", "destination", "expires_at", "consumed_at", "created_at")
    list_filter = ("purpose",)
    search_fields = ("user__email", "destination")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SocialAccount)
class SocialAccountAdmin(admin.ModelAdmin):
    list_display = ("user", "provider", "provider_user_id", "created_at")
    list_filter = ("provider",)
    search_fields = ("user__email", "provider_user_id")
