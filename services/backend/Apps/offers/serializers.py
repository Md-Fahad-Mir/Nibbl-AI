from rest_framework import serializers

from Apps.offers.models import Bookmark


class OfferSerializer(serializers.Serializer):
    """A resolved offer for a campaign (computed per requesting user)."""

    campaign_id = serializers.UUIDField()
    name = serializers.CharField()
    brand_id = serializers.UUIDField()
    brand_name = serializers.CharField()
    product_id = serializers.UUIDField()
    product_name = serializers.CharField()
    product_image = serializers.CharField(allow_blank=True)
    category = serializers.CharField(allow_blank=True)
    offer_type = serializers.CharField(allow_null=True)
    reward_amount = serializers.CharField(allow_null=True)
    restriction = serializers.CharField(allow_blank=True)
    min_purchase_units = serializers.IntegerField()
    is_bogo = serializers.BooleanField()
    in_cooldown = serializers.BooleanField()
    claimable = serializers.BooleanField()
    end_at = serializers.DateTimeField(allow_null=True)
    # Card credibility + claim state (added for Phase-1 website screens).
    rating = serializers.FloatField(allow_null=True)
    review_count = serializers.IntegerField()
    is_claimed = serializers.BooleanField()
    reservation_id = serializers.UUIDField(allow_null=True)
    # Deal model: offer type + Nibbl-suggested/brand-edited wording.
    deal_type = serializers.CharField()
    offer_headline = serializers.CharField(allow_blank=True)
    offer_description = serializers.CharField(allow_blank=True)
    required_quantity = serializers.IntegerField()
    going_fast = serializers.BooleanField()
    temporarily_unavailable = serializers.BooleanField()
    # Shopper offer page: campaign image, receipt eligibility, product slider,
    # cooldown terms.
    campaign_image = serializers.CharField(allow_blank=True)
    retailer_required = serializers.BooleanField()
    eligible_retailers = serializers.ListField(child=serializers.CharField())
    eligible_products = serializers.ListField(child=serializers.DictField())
    cooldown_days = serializers.IntegerField()
    one_time_only = serializers.BooleanField()

    def to_representation(self, campaign):
        from Apps.offers.services import resolve_offer

        return resolve_offer(campaign, self.context.get("user"))


class OfferDetailSerializer(OfferSerializer):
    """Consumer campaign-detail page: offer + description + how-it-works."""

    description = serializers.CharField(allow_blank=True)
    how_it_works = serializers.ListField(child=serializers.DictField())

    def to_representation(self, instance):
        # `instance` is the dict from services.build_offer_details (already shaped).
        return instance


class CategorySerializer(serializers.Serializer):
    category = serializers.CharField()


class SavedOfferSerializer(OfferSerializer):
    """A saved-offer card: full offer payload + the originating bookmark id."""

    bookmark_id = serializers.UUIDField()
    # Null until the "% OFF" badge product decision lands (key kept for FE).
    discount_label = serializers.CharField(allow_null=True)

    def to_representation(self, instance):
        # `instance` is the dict from selectors.saved_offers_for_user.
        return instance


class BookmarkSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model = Bookmark
        fields = [
            "id",
            "kind",
            "product",
            "brand",
            "product_name",
            "brand_name",
            "created_at",
        ]
        read_only_fields = fields


class AddBookmarkSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Bookmark.Kind.choices)
    product = serializers.UUIDField(required=False)
    brand = serializers.UUIDField(required=False)

    def validate(self, attrs):
        kind = attrs["kind"]
        if kind == Bookmark.Kind.PRODUCT and not attrs.get("product"):
            raise serializers.ValidationError({"product": "This field is required."})
        if kind == Bookmark.Kind.BRAND and not attrs.get("brand"):
            raise serializers.ValidationError({"brand": "This field is required."})
        return attrs
