from decimal import Decimal

from rest_framework import serializers

from Apps.payouts.models import PayoutBatch, PayoutMethod, WithdrawalRequest


class PayoutMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayoutMethod
        fields = [
            "id", "provider", "handle", "is_default",
            "review_status", "review_note", "created_at",
        ]
        read_only_fields = fields


class AdminPayoutMethodSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = PayoutMethod
        fields = [
            "id", "provider", "handle", "is_default",
            "review_status", "review_note",
            "user_email", "user_name", "created_at",
        ]
        read_only_fields = fields


class ReviewPayoutMethodSerializer(serializers.Serializer):
    approve = serializers.BooleanField()
    note = serializers.CharField(required=False, allow_blank=True)


class AddPayoutMethodSerializer(serializers.Serializer):
    provider = serializers.ChoiceField(choices=PayoutMethod.Provider.choices)
    handle = serializers.CharField(max_length=255)
    is_default = serializers.BooleanField(default=False)


class WithdrawalSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = WithdrawalRequest
        fields = [
            "id",
            "user_email",
            "payout_method",
            "provider",
            "handle",
            "amount",
            "status",
            "needs_review",
            "admin_note",
            "batch",
            "reviewed_at",
            "paid_at",
            "created_at",
        ]
        read_only_fields = fields


class RequestWithdrawalSerializer(serializers.Serializer):
    payout_method = serializers.UUIDField()
    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01")
    )
    # SMS code from /withdrawals/send-code/. Enforced only when Twilio is
    # configured, so existing clients keep working until verification is on.
    code = serializers.CharField(required=False, allow_blank=True, default="")


class SendWithdrawalCodeSerializer(serializers.Serializer):
    payout_method = serializers.UUIDField()
    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01")
    )


class WithdrawalCodeSentSerializer(serializers.Serializer):
    phone = serializers.CharField()


class ReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class NoteSerializer(serializers.Serializer):
    note = serializers.CharField()


class CreateBatchSerializer(serializers.Serializer):
    withdrawal_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )


class PayoutBatchSerializer(serializers.ModelSerializer):
    count = serializers.IntegerField(source="withdrawals.count", read_only=True)

    class Meta:
        model = PayoutBatch
        fields = ["id", "status", "total_amount", "count", "exported_at", "created_at"]
        read_only_fields = fields
