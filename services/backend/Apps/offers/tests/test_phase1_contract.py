"""Contract tests for the Phase-1 (Website) API fixes & new endpoints."""

from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand
from Apps.campaigns import services as campaign_services
from Apps.offers.models import Bookmark
from Apps.products.services import create_product
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def _active_campaign(category="Beverages"):
    brand = Brand.objects.create(name="Acme", slug="acme")
    product = create_product(brand=brand, name="Acme Cola", category=category)
    campaign = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Acme Deal",
        daily_budget=Decimal("100.00"),
    )
    campaign_services.set_tiers(
        campaign, [{"reward_amount": "5.00", "allocation_percent": "100.00"}]
    )
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal("100.00"),
        category=LedgerEntry.Category.FUNDING,
    )
    campaign_services.activate_campaign(campaign)
    return brand, product, campaign


class OfferPayloadContractTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C", is_email_verified=True
        )
        self.brand, self.product, self.campaign = _active_campaign()
        self.client.force_authenticate(self.user)

    def test_feed_item_has_rating_and_claim_fields(self):
        resp = self.client.get(reverse("v1:offers:feed"))
        item = resp.data["results"][0]
        for key in ("rating", "review_count", "is_claimed", "reservation_id"):
            self.assertIn(key, item)
        self.assertEqual(item["review_count"], 0)
        self.assertIsNone(item["rating"])
        self.assertFalse(item["is_claimed"])
        self.assertIsNone(item["reservation_id"])

    def test_offer_detail_reflects_claim_state_after_reservation(self):
        claim = self.client.post(
            reverse("v1:reservations:reservation-list"),
            {"campaign": str(self.campaign.id)}, format="json",
        )
        self.assertEqual(claim.status_code, status.HTTP_201_CREATED)
        resp = self.client.get(
            reverse("v1:offers:detail", args=[self.campaign.id])
        )
        self.assertTrue(resp.data["is_claimed"])
        self.assertEqual(resp.data["reservation_id"], str(claim.data["id"]))

    def test_offer_details_content_endpoint(self):
        resp = self.client.get(
            reverse("v1:offers:details", args=[self.campaign.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("description", resp.data)
        self.assertEqual(len(resp.data["how_it_works"]), 3)

    def test_categories_endpoint(self):
        resp = self.client.get(reverse("v1:offers:categories"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("Beverages", [c["category"] for c in resp.data])

    def test_save_offer_creates_product_bookmark(self):
        resp = self.client.post(reverse("v1:offers:save", args=[self.campaign.id]))
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Bookmark.objects.filter(
                user=self.user, product=self.product, kind=Bookmark.Kind.PRODUCT
            ).exists()
        )

    def test_bookmarks_list_is_paginated(self):
        resp = self.client.get(reverse("v1:offers:bookmark-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(set(resp.data), {"count", "next", "previous", "results"})

    def test_saved_offers_returns_enriched_cards(self):
        # Save the offer, then it should appear as a full card with bookmark_id.
        save = self.client.post(reverse("v1:offers:save", args=[self.campaign.id]))
        bookmark_id = save.data["id"]

        resp = self.client.get(reverse("v1:offers:saved"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(set(resp.data), {"count", "next", "previous", "results"})
        self.assertEqual(resp.data["count"], 1)

        card = resp.data["results"][0]
        self.assertEqual(str(card["bookmark_id"]), str(bookmark_id))
        self.assertEqual(str(card["campaign_id"]), str(self.campaign.id))
        # Reuses offer serialization — card-rendering fields present.
        for key in ("product_image", "brand_name", "rating", "review_count",
                    "claimable", "is_claimed", "reservation_id", "end_at",
                    "discount_label"):
            self.assertIn(key, card)

    def test_saved_offers_excludes_inactive_campaign(self):
        self.client.post(reverse("v1:offers:save", args=[self.campaign.id]))
        self.campaign.status = self.campaign.Status.PAUSED
        self.campaign.save(update_fields=["status"])
        resp = self.client.get(reverse("v1:offers:saved"))
        self.assertEqual(resp.data["count"], 0)


class PublicReviewContractTests(APITestCase):
    def test_product_reviews_endpoint_is_paginated(self):
        user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C", is_email_verified=True
        )
        _, product, _ = _active_campaign()
        self.client.force_authenticate(user)
        resp = self.client.get(
            reverse("v1:reviews:product-reviews", args=[product.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(set(resp.data), {"count", "next", "previous", "results"})

    def test_public_review_serializer_never_exposes_email(self):
        from Apps.reviews.serializers import PublicReviewSerializer

        fields = set(PublicReviewSerializer().fields)
        self.assertNotIn("user_email", fields)
        self.assertNotIn("email", fields)
        self.assertIn("author_name", fields)


class MiscContractTests(APITestCase):
    def test_unread_count_endpoint(self):
        user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C", is_email_verified=True
        )
        self.client.force_authenticate(user)
        resp = self.client.get(reverse("v1:notifications:notification-unread-count"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["unread_count"], 0)

    def test_public_config_is_unauthenticated(self):
        resp = self.client.get(reverse("v1:common:config"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["claim_window_days"], 7)

    def test_activity_feed_is_paginated(self):
        user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C", is_email_verified=True
        )
        self.client.force_authenticate(user)
        resp = self.client.get(reverse("v1:wallets:customer-activity"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(set(resp.data), {"count", "next", "previous", "results"})

    def test_profile_update_accepts_avatar_url(self):
        user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C", is_email_verified=True
        )
        self.client.force_authenticate(user)
        resp = self.client.patch(
            reverse("v1:accounts:users:me"),
            {"avatar_url": "https://cdn.example.com/a.png"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["avatar_url"], "https://cdn.example.com/a.png")
