from django.contrib import admin

from Apps.receipts.models import (
    FraudFlag,
    ManualReviewItem,
    OCRResult,
    Receipt,
    ReceiptLineItem,
)


class ReceiptLineItemInline(admin.TabularInline):
    model = ReceiptLineItem
    extra = 0
    readonly_fields = ("normalized",)


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "brand", "campaign", "status", "matched_units", "created_at")
    list_filter = ("status", "matched")
    search_fields = ("user__email", "brand__name", "full_fingerprint")
    readonly_fields = ("full_fingerprint", "matched_product", "reviewed_by", "reviewed_at", "created_at", "updated_at")
    inlines = [ReceiptLineItemInline]


@admin.register(OCRResult)
class OCRResultAdmin(admin.ModelAdmin):
    list_display = ("receipt", "provider", "confidence", "created_at")


@admin.register(FraudFlag)
class FraudFlagAdmin(admin.ModelAdmin):
    list_display = ("user", "brand", "reason", "resolved", "created_at")
    list_filter = ("reason", "resolved")
    search_fields = ("user__email", "brand__name")


@admin.register(ManualReviewItem)
class ManualReviewItemAdmin(admin.ModelAdmin):
    list_display = ("receipt", "brand", "status", "resolved_by", "resolved_at")
    list_filter = ("status",)
    search_fields = ("brand__name",)
