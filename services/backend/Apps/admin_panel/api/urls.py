from django.urls import path

from Apps.admin_panel.api import views

app_name = "admin_panel"

urlpatterns = [
    path("admin/settings/", views.AdminSettingsView.as_view(), name="settings"),
    path("admin/promo-codes/", views.AdminPromoCodeListCreateView.as_view(), name="promo-codes"),
    path("admin/brands/<uuid:brand_id>/wallet/credit/", views.PromoCreditView.as_view(), name="promo-credit"),
    path("admin/brands/<uuid:brand_id>/plan/", views.ChangePlanView.as_view(), name="change-plan"),
    path("admin/users/", views.AdminUserListView.as_view(), name="user-list"),
    path("admin/users/<uuid:user_id>/wallet/credit/", views.AdminUserWalletCreditView.as_view(), name="user-wallet-credit"),
    path("admin/users/<uuid:user_id>/suspend/", views.SuspendUserView.as_view(), name="user-suspend"),
    path("admin/users/<uuid:user_id>/reset-phone/", views.ResetUserPhoneView.as_view(), name="user-reset-phone"),
    path("admin/users/<uuid:user_id>/reactivate/", views.ReactivateUserView.as_view(), name="user-reactivate"),
    path("admin/users/<uuid:user_id>/approve-brand/", views.AdminApproveBrandView.as_view(), name="user-approve-brand"),
    path("admin/fraud-flags/", views.FraudFlagListView.as_view(), name="fraud-flags"),
    path("admin/campaigns/", views.AdminCampaignListView.as_view(), name="campaigns"),
    path("admin/campaign-approvals/", views.CampaignApprovalQueueView.as_view(), name="campaign-approvals"),
    path("admin/campaign-approvals/<uuid:review_id>/<str:action>/", views.CampaignApprovalDecisionView.as_view(), name="campaign-approval-decision"),
    path("admin/transactions/", views.AdminTransactionListView.as_view(), name="transactions"),
    path("admin/audit-logs/", views.AuditLogListView.as_view(), name="audit-logs"),
    path("admin/announcements/", views.BroadcastView.as_view(), name="announcements"),
    path("admin/role-statistics/", views.RoleStatisticsView.as_view(), name="role-statistics"),
]
