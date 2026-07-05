from django.urls import path

from Apps.admin_panel.api import views

app_name = "admin_panel"

urlpatterns = [
    path("admin/brands/<uuid:brand_id>/wallet/credit/", views.PromoCreditView.as_view(), name="promo-credit"),
    path("admin/brands/<uuid:brand_id>/plan/", views.ChangePlanView.as_view(), name="change-plan"),
    path("admin/users/", views.AdminUserListView.as_view(), name="user-list"),
    path("admin/users/<uuid:user_id>/wallet/credit/", views.AdminUserWalletCreditView.as_view(), name="user-wallet-credit"),
    path("admin/users/<uuid:user_id>/suspend/", views.SuspendUserView.as_view(), name="user-suspend"),
    path("admin/users/<uuid:user_id>/reactivate/", views.ReactivateUserView.as_view(), name="user-reactivate"),
    path("admin/fraud-flags/", views.FraudFlagListView.as_view(), name="fraud-flags"),
    path("admin/campaigns/", views.AdminCampaignListView.as_view(), name="campaigns"),
    path("admin/transactions/", views.AdminTransactionListView.as_view(), name="transactions"),
    path("admin/reviews/held/", views.AdminHeldReviewListView.as_view(), name="held-reviews"),
    path("admin/reviews/<uuid:review_id>/remove/", views.AdminRemoveReviewView.as_view(), name="review-remove"),
    path("admin/audit-logs/", views.AuditLogListView.as_view(), name="audit-logs"),
    path("admin/announcements/", views.BroadcastView.as_view(), name="announcements"),
    path("admin/role-statistics/", views.RoleStatisticsView.as_view(), name="role-statistics"),
]
