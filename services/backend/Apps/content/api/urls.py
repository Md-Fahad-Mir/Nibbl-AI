from django.urls import path

from Apps.content.api import views

app_name = "content"

urlpatterns = [
    # ─── Public ────────────────────────────────────────────────────────
    path(
        "newsletter/subscriptions/",
        views.NewsletterSubscribeView.as_view(),
        name="newsletter-subscribe",
    ),
    path("faqs/", views.PublicFAQListView.as_view(), name="faq-list"),
    path(
        "content/terms/",
        views.PublicLegalView.as_view(slug="terms"),
        name="legal-terms",
    ),
    path(
        "content/privacy-policy/",
        views.PublicLegalView.as_view(slug="privacy-policy"),
        name="legal-privacy",
    ),
    # ─── Admin (platform-admin only) ───────────────────────────────────
    path(
        "admin/faqs/",
        views.AdminFAQListCreateView.as_view(),
        name="admin-faq-list",
    ),
    path(
        "admin/faqs/<uuid:faq_id>/",
        views.AdminFAQDetailView.as_view(),
        name="admin-faq-detail",
    ),
    path(
        "admin/content/terms/",
        views.AdminLegalView.as_view(slug="terms"),
        name="admin-legal-terms",
    ),
    path(
        "admin/content/privacy-policy/",
        views.AdminLegalView.as_view(slug="privacy-policy"),
        name="admin-legal-privacy",
    ),
]
