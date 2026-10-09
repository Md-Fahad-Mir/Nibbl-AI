from django.urls import path

from Apps.receipts.api import views

app_name = "receipts"

_queue = "brands/<uuid:brand_id>/review-queue"

urlpatterns = [
    # Consumer
    path("receipts/", views.ReceiptListCreateView.as_view(), name="receipt-list"),
    path(
        "receipts/<uuid:receipt_id>/",
        views.ReceiptDetailView.as_view(),
        name="receipt-detail",
    ),
    # Brand review queue
    path(f"{_queue}/", views.ReviewQueueView.as_view(), name="review-queue"),
    path(
        f"{_queue}/<uuid:item_id>/approve/",
        views.ReviewItemApproveView.as_view(),
        name="review-approve",
    ),
    path(
        f"{_queue}/<uuid:item_id>/preview/",
        views.ReviewItemPreviewView.as_view(),
        name="review-preview",
    ),
    path(
        f"{_queue}/<uuid:item_id>/decline/",
        views.ReviewItemDeclineView.as_view(),
        name="review-decline",
    ),
    path(
        f"{_queue}/<uuid:item_id>/add-alias/",
        views.ReviewItemAddAliasView.as_view(),
        name="review-add-alias",
    ),
    path(
        "brands/<uuid:brand_id>/flag-user/",
        views.FlagUserView.as_view(),
        name="flag-user",
    ),
]
