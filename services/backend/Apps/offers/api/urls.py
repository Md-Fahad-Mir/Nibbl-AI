from django.urls import path

from Apps.offers.api import views

app_name = "offers"

urlpatterns = [
    path("offers/", views.OfferFeedView.as_view(), name="feed"),
    path("me/location/", views.DiscoveryLocationView.as_view(), name="discovery-location"),
    path("offers/categories/", views.OfferCategoriesView.as_view(), name="categories"),
    path("offers/saved/", views.SavedOffersView.as_view(), name="saved"),
    path(
        "offers/by-url/<str:token>/",
        views.OfferByURLView.as_view(),
        name="by-url",
    ),
    path(
        "offers/by-qr/<str:token>/",
        views.OfferByQRView.as_view(),
        name="by-qr",
    ),
    path(
        "offers/<uuid:campaign_id>/",
        views.OfferDetailView.as_view(),
        name="detail",
    ),
    path(
        "offers/<uuid:campaign_id>/details/",
        views.OfferDetailsContentView.as_view(),
        name="details",
    ),
    path(
        "offers/<uuid:campaign_id>/save/",
        views.OfferSaveView.as_view(),
        name="save",
    ),
    path("bookmarks/", views.BookmarkListCreateView.as_view(), name="bookmark-list"),
    path(
        "bookmarks/<uuid:bookmark_id>/",
        views.BookmarkDeleteView.as_view(),
        name="bookmark-delete",
    ),
]
