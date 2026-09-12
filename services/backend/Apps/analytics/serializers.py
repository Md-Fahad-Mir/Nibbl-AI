from rest_framework import serializers

from Apps.analytics.models import PlatformStat


class BrandRebatesSummarySerializer(serializers.Serializer):
    performance_change_percent = serializers.FloatField()
    performance_change_label = serializers.CharField()
    budget_savings = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_cashback = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_cashback_change_percent = serializers.FloatField()
    redemption_rate = serializers.FloatField()
    redemption_rate_change_percent = serializers.FloatField()
    avg_claim_time_minutes = serializers.IntegerField()
    avg_claim_time_change_percent = serializers.FloatField()
    active_users = serializers.IntegerField()
    active_users_change_percent = serializers.FloatField()


class SpendSerializer(serializers.Serializer):
    rebate_reward = serializers.DecimalField(max_digits=14, decimal_places=2)
    rebate_fee = serializers.DecimalField(max_digits=14, decimal_places=2)
    review_reward = serializers.DecimalField(max_digits=14, decimal_places=2)
    review_fee = serializers.DecimalField(max_digits=14, decimal_places=2)
    subscription = serializers.DecimalField(max_digits=14, decimal_places=2)
    total = serializers.DecimalField(max_digits=14, decimal_places=2)


class BrandOverviewSerializer(serializers.Serializer):
    reservations = serializers.IntegerField()
    active_reservations = serializers.IntegerField()
    approvals = serializers.IntegerField()
    rejected_receipts = serializers.IntegerField()
    redemptions = serializers.IntegerField()
    reviews = serializers.IntegerField()
    published_reviews = serializers.IntegerField()
    average_rating = serializers.DecimalField(
        max_digits=3, decimal_places=2, allow_null=True
    )
    spend = SpendSerializer()


class CampaignMetricSerializer(serializers.Serializer):
    campaign_id = serializers.UUIDField()
    name = serializers.CharField()
    status = serializers.CharField()
    reservations = serializers.IntegerField()
    active_reservations = serializers.IntegerField()
    approvals = serializers.IntegerField()
    rejected_receipts = serializers.IntegerField()
    redemptions = serializers.IntegerField()
    reward_spend = serializers.DecimalField(max_digits=14, decimal_places=2)
    fee_spend = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_spend = serializers.DecimalField(max_digits=14, decimal_places=2)


class ProductMetricSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    name = serializers.CharField()
    redemptions = serializers.IntegerField()
    reviews_count = serializers.IntegerField()
    average_rating = serializers.DecimalField(
        max_digits=3, decimal_places=2, allow_null=True
    )
    reward_spend = serializers.DecimalField(max_digits=14, decimal_places=2)


class PlatformOverviewSerializer(serializers.Serializer):
    brands_total = serializers.IntegerField()
    active_brands = serializers.IntegerField()
    users_total = serializers.IntegerField()
    active_users = serializers.IntegerField()
    new_users = serializers.IntegerField()
    reservations_total = serializers.IntegerField()
    redemptions_total = serializers.IntegerField()
    reviews_total = serializers.IntegerField()
    total_reward_paid = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_fees = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_payouts = serializers.DecimalField(max_digits=14, decimal_places=2)


class PlatformStatSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformStat
        fields = "__all__"
        read_only_fields = [f.name for f in PlatformStat._meta.fields]
