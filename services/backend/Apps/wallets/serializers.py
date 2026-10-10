from decimal import Decimal

from rest_framework import serializers

from Apps.wallets.models import LedgerEntry, Wallet


class WalletSerializer(serializers.ModelSerializer):
    held = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()
    promotional = serializers.SerializerMethodField()
    reward_available = serializers.SerializerMethodField()
    # Reserved funds split (Master: show rebate and review reservations
    # separately); together they make up ``held``.
    reserved_rebates = serializers.SerializerMethodField()
    reserved_reviews = serializers.SerializerMethodField()

    class Meta:
        model = Wallet
        fields = [
            "id",
            "kind",
            "currency",
            "balance",
            "held",
            "available",
            "promotional",
            "reward_available",
            "reserved_rebates",
            "reserved_reviews",
            "updated_at",
        ]
        read_only_fields = fields

    def get_held(self, obj) -> Decimal:
        return obj.held_amount()

    def get_available(self, obj) -> Decimal:
        return obj.available()

    def get_promotional(self, obj) -> Decimal:
        return obj.promo_balance()

    def _reserved(self, obj, kind) -> Decimal:
        from django.db.models import Sum

        from Apps.wallets.models import Hold

        total = obj.holds.filter(
            status=Hold.Status.ACTIVE, reservation__kind=kind
        ).aggregate(s=Sum("amount"))["s"]
        return total or Decimal("0.00")

    def get_reserved_rebates(self, obj) -> Decimal:
        from Apps.reservations.models import Reservation

        return self._reserved(obj, Reservation.Kind.REBATE)

    def get_reserved_reviews(self, obj) -> Decimal:
        from django.db.models import Sum

        from Apps.reservations.models import Reservation
        from Apps.wallets.models import Hold

        # Review opportunities reserve $1 + fee (Apps.reviews.campaigns).
        sessions = obj.holds.filter(status=Hold.Status.ACTIVE, reference_type="review_session").aggregate(
            s=Sum("amount"))["s"] or Decimal("0.00")
        return self._reserved(obj, Reservation.Kind.REVIEW) + sessions

    def get_reward_available(self, obj) -> Decimal:
        return obj.reward_available()


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
