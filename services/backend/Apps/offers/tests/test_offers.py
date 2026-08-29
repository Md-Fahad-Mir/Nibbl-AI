from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.offers import services as offer_services
from Apps.offers.models import Bookmark, CooldownRecord, OfferView
from Apps.products.services import create_product
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def _active_campaign(brand_name="Acme", slug="acme", category="Beverages",
                     premium="5.00", fallback=None, fallback_enabled=False):
    brand = Brand.objects.create(name=brand_name, slug=slug)
    product = create_product(brand=brand, name=f"{slug} Cola", category=category)
    campaign = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name=f"{brand_name} Deal",
        daily_budget=Decimal("100.00"),
    )
    campaign_services.set_tiers(
        campaign, [{"reward_amount": premium, "allocation_percent": "100.00"}]
    )
    if fallback is not None:
        campaign_services.set_fallback(
            campaign, reward_amount=Decimal(fallback), is_enabled=fallback_enabled
        )
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal("100.00"),
        category=LedgerEntry.Category.FUNDING,
    )
    campaign_services.activate_campaign(campaign)
    return brand, product, campaign


class FeedTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C"
        )
        self.client.force_authenticate(self.user)

    def test_feed_lists_only_active_offers(self):
        _active_campaign("Acme", "acme")
        # A draft campaign should not appear.
        brand2 = Brand.objects.create(name="Drafty", slug="drafty")
        p2 = create_product(brand=brand2, name="Tea")
        campaign_services.create_campaign(
            brand=brand2, product_ids=[p2.id], name="Draft Deal",
            daily_budget=Decimal("10.00"),
        )
        resp = self.client.get(reverse("v1:offers:feed"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["offer_type"], "premium")
        self.assertEqual(resp.data["results"][0]["reward_amount"], "5.00")

    def test_feed_excludes_suspended_brand(self):
        brand, _, _ = _active_campaign()
        brand.status = Brand.Status.SUSPENDED
        brand.save(update_fields=["status"])
        resp = self.client.get(reverse("v1:offers:feed"))
        self.assertEqual(resp.data["count"], 0)

    def test_category_filter(self):
        _active_campaign("Food Co", "foodco", category="Food")
        _active_campaign("Bev Co", "bevco", category="Beverages")
        resp = self.client.get(reverse("v1:offers:feed"), {"category": "food"})
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["category"], "Food")

    def test_search_filter(self):
        _active_campaign("Acme", "acme")
        _active_campaign("Globex", "globex")
        resp = self.client.get(reverse("v1:offers:feed"), {"search": "globex"})
        self.assertEqual(resp.data["count"], 1)

    def test_feed_requires_auth(self):
        self.client.force_authenticate(None)
        resp = self.client.get(reverse("v1:offers:feed"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class CooldownResolutionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C"
        )

    def test_cooldown_hides_premium_and_shows_fallback_when_enabled(self):
        _, _, campaign = _active_campaign(
            premium="5.00", fallback="1.00", fallback_enabled=True
        )
        offer_services.enter_cooldown(self.user, campaign)
        offer = offer_services.resolve_offer(campaign, self.user)
        self.assertTrue(offer["in_cooldown"])
        self.assertEqual(offer["offer_type"], "fallback")
        self.assertEqual(offer["reward_amount"], "1.00")
        self.assertTrue(offer["claimable"])

    def test_cooldown_without_fallback_is_not_claimable(self):
        _, _, campaign = _active_campaign(premium="5.00")
        offer_services.enter_cooldown(self.user, campaign)
        offer = offer_services.resolve_offer(campaign, self.user)
        self.assertTrue(offer["in_cooldown"])
        self.assertIsNone(offer["offer_type"])
        self.assertFalse(offer["claimable"])

    def test_no_cooldown_shows_premium(self):
        _, _, campaign = _active_campaign(
            premium="5.00", fallback="1.00", fallback_enabled=True
        )
        offer = offer_services.resolve_offer(campaign, self.user)
        self.assertFalse(offer["in_cooldown"])
        self.assertEqual(offer["offer_type"], "premium")
        self.assertEqual(offer["reward_amount"], "5.00")

    def test_enter_cooldown_uses_campaign_window(self):
        _, _, campaign = _active_campaign()
        record = offer_services.enter_cooldown(self.user, campaign)
        delta = (record.expires_at - record.started_at).days
        self.assertEqual(delta, campaign.cooldown_days)
        self.assertTrue(record.is_active)


class EntryPointTests(APITestCase):
    def test_by_url_resolves_best_offer_anonymously(self):
        _, _, campaign = _active_campaign(premium="5.00")
        token = campaign.campaign_url.token
        resp = self.client.get(reverse("v1:offers:by-url", args=[token]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["offer_type"], "premium")
        self.assertEqual(
            OfferView.objects.filter(source=OfferView.Source.URL).count(), 1
        )

    def test_by_qr_resolves_best_offer(self):
        _, _, campaign = _active_campaign(premium="5.00")
        token = campaign.qr_code.token
        resp = self.client.get(reverse("v1:offers:by-qr", args=[token]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["offer_type"], "premium")

    def test_detail_records_view(self):
        user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C"
        )
        _, _, campaign = _active_campaign()
        self.client.force_authenticate(user)
        resp = self.client.get(reverse("v1:offers:detail", args=[campaign.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(
            OfferView.objects.filter(source=OfferView.Source.DETAIL).count(), 1
        )


class BookmarkTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="c@example.com", password="x", full_name="C"
        )
        self.brand, self.product, _ = _active_campaign()
        self.client.force_authenticate(self.user)

    def test_bookmark_product_and_brand(self):
        r1 = self.client.post(
            reverse("v1:offers:bookmark-list"),
            {"kind": "product", "product": str(self.product.id)},
            format="json",
        )
        r2 = self.client.post(
            reverse("v1:offers:bookmark-list"),
            {"kind": "brand", "brand": str(self.brand.id)},
            format="json",
        )
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)
        listing = self.client.get(reverse("v1:offers:bookmark-list"))
        # Paginated envelope: {count, next, previous, results}
        self.assertEqual(listing.data["count"], 2)
        self.assertEqual(len(listing.data["results"]), 2)

    def test_bookmark_is_deduplicated(self):
        for _ in range(2):
            self.client.post(
                reverse("v1:offers:bookmark-list"),
                {"kind": "product", "product": str(self.product.id)},
                format="json",
            )
        self.assertEqual(
            Bookmark.objects.filter(user=self.user, product=self.product).count(), 1
        )

    def test_bookmark_requires_matching_target(self):
        resp = self.client.post(
            reverse("v1:offers:bookmark-list"),
            {"kind": "product"},  # missing product id
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_remove_bookmark(self):
        bookmark = offer_services.add_bookmark(
            user=self.user, kind="product", product_id=self.product.id
        )
        resp = self.client.delete(
            reverse("v1:offers:bookmark-delete", args=[bookmark.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Bookmark.objects.filter(id=bookmark.id).exists())
