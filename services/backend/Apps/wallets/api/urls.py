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
