from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from Apps.accounts.api import views

app_name = "accounts"

auth_patterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("verify-email/", views.VerifyEmailView.as_view(), name="verify-email"),
    path(
        "resend-email-verification/",
        views.ResendEmailVerificationView.as_view(),
        name="resend-email-verification",
    ),
    path(
        "password/forgot/",
        views.RequestPasswordResetView.as_view(),
        name="password-forgot",
    ),
    path(
        "password/reset/",
        views.ResetPasswordView.as_view(),
        name="password-reset",
    ),
    path("social/", views.SocialLoginView.as_view(), name="social-login"),
]

user_patterns = [
    path("me/", views.MeView.as_view(), name="me"),
    path("me/change-password/", views.ChangePasswordView.as_view(), name="change-password"),
    path("me/sessions/", views.SessionListView.as_view(), name="sessions"),
    path("me/sessions/sign-out-others/", views.SignOutOtherSessionsView.as_view(), name="sign-out-others"),
    path("me/phone/", views.AddPhoneView.as_view(), name="add-phone"),
    path("me/phone/verify/", views.VerifyPhoneView.as_view(), name="verify-phone"),
    path("me/consents/", views.MarketingConsentListView.as_view(), name="consents"),
    path("me/consents/withdraw/", views.MarketingConsentWithdrawView.as_view(), name="consent-withdraw"),
    path("me/referrals/", views.ReferralView.as_view(), name="referrals"),
    path("me/referrals/invite/", views.ReferralInviteView.as_view(), name="referral-invite"),
]

urlpatterns = [
    path("auth/", include((auth_patterns, "auth"))),
    path("users/", include((user_patterns, "users"))),
]
