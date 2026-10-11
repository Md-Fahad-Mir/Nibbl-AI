from django.urls import path

from Apps.payouts.api import views

app_name = "payouts"

urlpatterns = [
    # Consumer
    path("payout-methods/", views.PayoutMethodListCreateView.as_view(), name="method-list"),
    path("payout-methods/request-review/", views.PayoutReviewRequestView.as_view(), name="method-request-review"),
    path("payout-methods/<uuid:method_id>/", views.PayoutMethodDeleteView.as_view(), name="method-delete"),
    path("withdrawals/", views.WithdrawalListCreateView.as_view(), name="withdrawal-list"),
    path("withdrawals/send-code/", views.WithdrawalSendCodeView.as_view(), name="withdrawal-send-code"),
    path("withdrawals/<uuid:withdrawal_id>/", views.WithdrawalDetailView.as_view(), name="withdrawal-detail"),
    # Admin
    path("admin/payout-methods/pending/", views.AdminPendingPayoutMethodListView.as_view(), name="admin-method-pending"),
    path("admin/payout-methods/<uuid:method_id>/review/", views.AdminPayoutMethodReviewView.as_view(), name="admin-method-review"),
    path("admin/withdrawals/", views.AdminWithdrawalListView.as_view(), name="admin-withdrawal-list"),
    path("admin/withdrawals/<uuid:withdrawal_id>/<str:action>/", views.AdminWithdrawalActionView.as_view(), name="admin-withdrawal-action"),
    path("admin/payout-batches/", views.AdminBatchListCreateView.as_view(), name="admin-batch-list"),
    path("admin/payout-batches/<uuid:batch_id>/export/", views.AdminBatchExportView.as_view(), name="admin-batch-export"),
]
