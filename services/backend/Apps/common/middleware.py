"""Nibbl Admin Mode audit trail (Master: Admin Brand Access — "every action
is logged").

The brand app sends ``X-Nibbl-Admin-Brand: <brand id>`` while a platform admin
is viewing a brand. Every write such a request makes is recorded here, after
DRF has authenticated the request (DRF copies the user onto the Django
request).
"""

from Apps.common.models import AuditLog

HEADER = "HTTP_X_NIBBL_ADMIN_BRAND"
SAFE = {"GET", "HEAD", "OPTIONS"}


class AdminBrandAccessAuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        brand_id = request.META.get(HEADER, "")
        user = getattr(request, "user", None)
        if (brand_id and request.method not in SAFE and user is not None
                and getattr(user, "is_authenticated", False) and getattr(user, "is_platform_admin", False)):
            AuditLog.objects.create(
                action=AuditLog.Action.OTHER, actor_type="admin", actor_id=str(user.id),
                target_type="brand", target_id=brand_id[:64],
                metadata={"event": "admin_brand_action", "method": request.method,
                          "path": request.path[:300], "status": response.status_code},
            )
        return response
