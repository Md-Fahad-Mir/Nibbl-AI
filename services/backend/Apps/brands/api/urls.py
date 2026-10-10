from django.urls import include, path

from Apps.brands.api import views

app_name = "brands"

application_patterns = [
    path(
        "",
        views.BrandApplicationListCreateView.as_view(),
        name="application-list",
    ),
    path(
        "<uuid:pk>/",
        views.BrandApplicationDetailView.as_view(),
        name="application-detail",
    ),
    path(
        "<uuid:application_id>/checkout/quote/",
        views.BrandCheckoutQuoteView.as_view(),
        name="application-checkout-quote",
    ),
    path(
        "<uuid:application_id>/checkout/",
        views.BrandCheckoutView.as_view(),
        name="application-checkout",
    ),
]

brand_patterns = [
    path("", views.MyBrandListView.as_view(), name="brand-list"),
    path("<uuid:brand_id>/", views.BrandDetailView.as_view(), name="brand-detail"),
    path(
        "<uuid:brand_id>/members/",
        views.BrandMembershipListCreateView.as_view(),
        name="member-list",
    ),
    path(
        "<uuid:brand_id>/members/<uuid:membership_id>/",
        views.BrandMembershipDeleteView.as_view(),
        name="member-delete",
    ),
    path(
        "<uuid:brand_id>/customers/",
        views.BrandCustomerListView.as_view(),
        name="customer-list",
    ),
    path(
        "<uuid:brand_id>/customers/export/",
        views.BrandCustomerExportView.as_view(),
        name="customer-export",
    ),
    path(
        "<uuid:brand_id>/customers/<str:customer_id>/<str:action>/",
        views.BrandCustomerSuspendView.as_view(),
        name="customer-action",
    ),
]

admin_patterns = [
    path(
        "brand-applications/",
        views.AdminApplicationListView.as_view(),
        name="admin-application-list",
    ),
    path(
        "brand-applications/<uuid:application_id>/approve/",
        views.ApproveApplicationView.as_view(),
        name="admin-application-approve",
    ),
    path(
        "brand-applications/<uuid:application_id>/reject/",
        views.RejectApplicationView.as_view(),
        name="admin-application-reject",
    ),
    path("brands/", views.AdminBrandListView.as_view(), name="admin-brand-list"),
    path(
        "brands/<uuid:brand_id>/suspend/",
        views.SuspendBrandView.as_view(),
        name="admin-brand-suspend",
    ),
    path(
        "brands/<uuid:brand_id>/reactivate/",
        views.ReactivateBrandView.as_view(),
        name="admin-brand-reactivate",
    ),
]

urlpatterns = [
    path("brand-applications/", include(application_patterns)),
    path("brands/", include(brand_patterns)),
    path("admin/", include(admin_patterns)),
]
