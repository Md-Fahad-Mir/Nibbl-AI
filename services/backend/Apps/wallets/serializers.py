from decimal import Decimal

from rest_framework import serializers

from Apps.wallets.models import LedgerEntry, Wallet


class WalletSerializer(serializers.ModelSerializer):
    held = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = [
            "id",
            "kind",
            "currency",
            "balance",
            "held",
            "available",
            "updated_at",
        ]
        read_only_fields = fields

    def get_held(self, obj) -> Decimal:
        return obj.held_amount()

    def get_available(self, obj) -> Decimal:
        return obj.available()


class LedgerEntrySerializer(serializers.ModelSerializer):
    signed_amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = LedgerEntry
        fields = [
            "id",
            "entry_type",
            "amount",
            "signed_amount",
            "category",
            "balance_after",
            "reference_type",
            "reference_id",
            "description",
            "created_at",
        ]
        read_only_fields = fields


class StatementItemSerializer(serializers.Serializer):
    """A normalized wallet statement row (completed ledger or pending withdrawal)."""

    id = serializers.CharField()
    kind = serializers.CharField()  # "ledger" | "withdrawal"
    description = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    status = serializers.CharField()  # "completed" | "pending" | ...
    created_at = serializers.DateTimeField()


class ActivitySerializer(serializers.ModelSerializer):
    """Normalized customer activity item (money trail) for the Rewards Hub."""

    title = serializers.CharField(source="description", read_only=True)
    amount = serializers.DecimalField(
        source="signed_amount", max_digits=14, decimal_places=2, read_only=True
    )

    class Meta:
        model = LedgerEntry
        fields = [
            "id",
            "entry_type",
            "category",
            "amount",
            "title",
            "reference_type",
            "reference_id",
            "created_at",
        ]
        read_only_fields = fields
