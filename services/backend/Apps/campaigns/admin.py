from django.contrib import admin

from Apps.campaigns.models import (
    Campaign,
    CampaignURL,
    FallbackOffer,
    QRCode,
    Restriction,
    RewardTier,
)


class RewardTierInline(admin.TabularInline):
    model = RewardTier
    extra = 0


class RestrictionInline(admin.StackedInline):
    model = Restriction
    extra = 0
    readonly_fields = ("restriction_type", "min_units", "description")
    can_delete = False


class FallbackOfferInline(admin.StackedInline):
    model = FallbackOffer
    extra = 0


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ("name", "brand", "get_products", "status", "daily_budget", "auto_paused", "created_at")
    list_filter = ("status", "is_bogo")
    search_fields = ("name", "brand__name", "products__name")
    autocomplete_fields = ("brand", "products")
    inlines = [RewardTierInline, RestrictionInline, FallbackOfferInline]

    def get_products(self, obj):
        return ", ".join([p.name for p in obj.products.all()])
    get_products.short_description = "Products"


@admin.register(CampaignURL)
class CampaignURLAdmin(admin.ModelAdmin):
    list_display = ("campaign", "token")
    readonly_fields = ("token",)


@admin.register(QRCode)
class QRCodeAdmin(admin.ModelAdmin):
    list_display = ("campaign", "token")
    readonly_fields = ("token",)
