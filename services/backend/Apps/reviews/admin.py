from django.contrib import admin

from Apps.reviews.models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("id", "product", "user", "brand", "rating", "ai_generated", "created_at")
    list_filter = ("rating", "ai_generated")
    search_fields = ("product__name", "user__email", "brand__name")
    readonly_fields = (
        "ai_generated", "disclosure", "questions_and_answers", "ai_raw_response",
        "created_at", "updated_at",
    )
