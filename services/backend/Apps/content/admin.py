from django.contrib import admin

from Apps.content.models import FAQ, LegalDocument, NewsletterSubscription


@admin.register(NewsletterSubscription)
class NewsletterSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("email", "source", "status", "created_at")
    list_filter = ("status", "source")
    search_fields = ("email",)


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ("question", "sort_order", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("question", "answer")


@admin.register(LegalDocument)
class LegalDocumentAdmin(admin.ModelAdmin):
    list_display = ("slug", "title", "updated_at")
