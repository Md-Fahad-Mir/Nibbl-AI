from django.contrib import admin

from Apps.wallets.models import Hold, LedgerEntry, RefundRequest, Wallet


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "brand", "user", "currency", "balance", "updated_at")
    list_filter = ("kind", "currency")
    search_fields = ("brand__name", "user__email")
    readonly_fields = ("balance", "created_at", "updated_at")


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = (
        "created_at",
        "wallet",
        "entry_type",
        "amount",
        "category",
        "balance_after",
    )
    list_filter = ("entry_type", "category")
    search_fields = ("wallet__id", "reference_id", "idempotency_key")
    # Ledger is append-only.
    readonly_fields = [f.name for f in LedgerEntry._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Hold)
class HoldAdmin(admin.ModelAdmin):
    list_display = ("created_at", "wallet", "amount", "status", "expires_at")
    list_filter = ("status",)
    search_fields = ("wallet__id", "reference_id", "idempotency_key")
    readonly_fields = ("created_at", "updated_at", "captured_at", "released_at")


@admin.register(RefundRequest)
class RefundRequestAdmin(admin.ModelAdmin):
    list_display = ("brand", "amount", "status", "created_at", "decided_at")
    list_filter = ("status",)
    readonly_fields = [f.name for f in RefundRequest._meta.fields]
