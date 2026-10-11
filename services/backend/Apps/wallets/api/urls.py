from django.urls import path

from Apps.wallets.api import views

app_name = "wallets"

urlpatterns = [
    # Brand escrow wallet
    path(
        "brands/<uuid:brand_id>/wallet/",
        views.BrandWalletView.as_view(),
        name="brand-wallet",
    ),
    path(
        "brands/<uuid:brand_id>/wallet/transactions/",
        views.BrandWalletTransactionsView.as_view(),
        name="brand-wallet-transactions",
    ),
    path(
        "brands/<uuid:brand_id>/wallet/transactions/export/",
        views.BrandWalletLedgerExportView.as_view(),
        name="brand-wallet-ledger-export",
    ),
    path(
        "brands/<uuid:brand_id>/wallet/funding/",
        views.BrandFundingView.as_view(),
        name="brand-wallet-funding",
    ),
    path(
        "brands/<uuid:brand_id>/wallet/statements/",
        views.BrandWeeklyStatementsView.as_view(),
        name="brand-weekly-statements",
    ),
    path(
        "brands/<uuid:brand_id>/wallet/statements/<str:week_start>/export/",
        views.BrandWeeklyStatementExportView.as_view(),
        name="brand-weekly-statement-export",
    ),
    path(
        "brands/<uuid:brand_id>/wallet/refunds/",
        views.BrandRefundRequestView.as_view(),
        name="brand-refund-requests",
    ),
    # Customer wallet
    path("wallet/", views.CustomerWalletView.as_view(), name="customer-wallet"),
    path(
        "wallet/transactions/",
        views.CustomerWalletTransactionsView.as_view(),
        name="customer-wallet-transactions",
    ),
    path("activity/", views.CustomerActivityView.as_view(), name="customer-activity"),
    path(
        "wallet/statement/",
        views.CustomerStatementView.as_view(),
        name="customer-statement",
    ),
]
