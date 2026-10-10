"""JWT authentication that honours signed-out sessions.

Tokens issued at sign-in carry the ``UserSession`` id (``sid``). A token from
a revoked session ("sign out other sessions") is rejected even though the JWT
itself hasn't expired. Tokens issued before sessions existed have no ``sid``
and keep working until they expire.
"""

from __future__ import annotations

import datetime as dt

from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

TOUCH_EVERY = dt.timedelta(hours=1)


def check_session(sid) -> None:
    """Raise if the session was signed out; record recent use."""
    if not sid:
        return
    from Apps.accounts.models import UserSession

    session = UserSession.objects.filter(id=sid).only("id", "revoked_at", "last_used_at").first()
    if session is None or session.revoked_at is not None:
        raise AuthenticationFailed("This session was signed out. Please sign in again.", code="session_revoked")
    now = timezone.now()
    if session.last_used_at is None or now - session.last_used_at > TOUCH_EVERY:
        UserSession.objects.filter(id=sid).update(last_used_at=now)


class SessionJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        check_session(validated_token.get("sid"))
        return super().get_user(validated_token)


class SessionTokenRefreshSerializer(TokenRefreshSerializer):
    def validate(self, attrs):
        try:
            sid = RefreshToken(attrs["refresh"]).get("sid")
        except Exception:
            sid = None  # invalid tokens are rejected by the parent class
        check_session(sid)
        return super().validate(attrs)
