from django.urls import path

from Apps.products.api import views

app_name = "products"

urlpatterns = [
    path(
        "brands/<uuid:brand_id>/products/",
        views.ProductListCreateView.as_view(),
        name="product-list",
    ),
    path(
        "brands/<uuid:brand_id>/products/match/",
        views.ProductMatchView.as_view(),
        name="product-match",
    ),
    path(
        "brands/<uuid:brand_id>/products/<uuid:product_id>/",
        views.ProductDetailView.as_view(),
        name="product-detail",
    ),
    path(
        "brands/<uuid:brand_id>/products/<uuid:product_id>/aliases/",
        views.AliasListCreateView.as_view(),
        name="alias-list",
    ),
    path(
        "brands/<uuid:brand_id>/products/<uuid:product_id>/aliases/<uuid:alias_id>/",
        views.AliasDeleteView.as_view(),
        name="alias-delete",
    ),
    path(
        "brands/<uuid:brand_id>/product-categories/",
        views.ProductCategoryListView.as_view(),
        name="product-categories",
    ),
    path(
        "brands/<uuid:brand_id>/category-requests/",
        views.CategoryRequestCreateView.as_view(),
        name="category-request",
    ),
    path(
        "brands/<uuid:brand_id>/tags/",
        views.TagListView.as_view(),
        name="tag-list",
    ),
    path(
        "brands/<uuid:brand_id>/tags/generate/",
        views.GenerateTagsView.as_view(),
        name="tag-generate",
    ),
]
