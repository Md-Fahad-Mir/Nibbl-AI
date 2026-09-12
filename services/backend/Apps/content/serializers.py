from rest_framework import serializers

from Apps.content.models import FAQ, LegalDocument, NewsletterSubscription


class NewsletterSubscriptionSerializer(serializers.ModelSerializer):
    # Declared explicitly so the model's unique validator does not reject a
    # re-subscribe; the view upserts by email instead.
    email = serializers.EmailField()

    class Meta:
        model = NewsletterSubscription
        fields = ["id", "email", "source", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]


class PublicFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ["id", "question", "answer", "sort_order", "is_active"]
        read_only_fields = fields


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = [
            "id",
            "question",
            "answer",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class LegalDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalDocument
        fields = ["title", "content", "updated_at"]
        read_only_fields = ["title", "updated_at"]
