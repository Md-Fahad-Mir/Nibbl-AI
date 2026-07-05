"""Cross-cutting DRF permissions reused across apps."""

from rest_framework.permissions import BasePermission


class IsPlatformAdmin(BasePermission):
    """Allow only NibblAI platform admins (admin role or Django superuser)."""

    message = "Platform admin access required."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        return user.is_platform_admin
