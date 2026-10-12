"""Cross-cutting DRF permissions reused across apps."""

from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsPlatformAdmin(BasePermission):
    """Allow only NibblAI platform admins (admin role or Django superuser)."""

    message = "Platform admin access required."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if not user.is_platform_admin:
            return False
        # Master Admin Users: the Analytics role is read-only.
        if user.admin_staff_role == "analytics" and request.method not in SAFE_METHODS:
            self.message = "Your Admin role is read-only."
            return False
        return True


class IsAdministrator(IsPlatformAdmin):
    """Administrator staff role only (Admin Users; changing Admin Settings)."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.user.admin_staff_role != "administrator":
            self.message = "Only an Administrator can do this."
            return False
        return True
