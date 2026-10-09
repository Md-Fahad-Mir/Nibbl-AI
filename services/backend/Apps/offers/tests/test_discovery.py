"""Discovery: location, geography gate, campaign-level hiding, ranking (Master #13–16, #50)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign, Retailer
from Apps.common.models import get_platform_settings
from Apps.common.testing import RECEIPT_META, go_live
from Apps.offers import services as offer_services
from Apps.offers.models import OfferView
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.reservations import services as reservation_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

SF, SF_NEARBY, NYC = "94103", "94105", "10001"


class DiscoveryTests(APITestCase):
    def setUp(self):
        self.shopper = User.objects.create_user(email="s@x.com", password="x", full_name="S")
        self.client.force_authenticate(self.shopper)
        self.n = 0

    def campaign(self, brand_name="Acme", **geo):
        self.n += 1
        brand = Brand.objects.filter(name=brand_name).first() or Brand.objects.create(
            name=brand_name, slug=brand_name.lower()
        )
        wallet_services.credit(
            wallet=wallet_services.get_or_create_brand_wallet(brand), amount=Decimal("100"),
            category=LedgerEntry.Category.FUNDING,
        )
        product = create_product(brand=brand, name=f"Cola {self.n}", category="Drinks")
        campaign = campaign_services.create_campaign(
            brand=brand, product_ids=[product.id], name=f"Deal {self.n}", deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=10, estimated_redemption_rate=Decimal("100"), **geo,
        )
        go_live(campaign)
        return campaign

    def feed(self, **params):
        resp = self.client.get(reverse("v1:offers:feed"), params)
        return resp, [r["campaign_id"] for r in resp.data["results"]]

    def test_location_endpoint(self):
        url = reverse("v1:offers:discovery-location")
        self.assertIsNone(self.client.get(url).data["location"])
        self.assertEqual(self.client.put(url, {"zip": "00000"}, format="json").status_code, 400)
        saved = self.client.put(url, {"zip": SF}, format="json").data["location"]
        self.assertEqual(saved, {"zip": SF, "state": "CA"})
        device = self.client.put(url, {"lat": 40.7506, "lng": -73.9972}, format="json").data["location"]
        self.assertEqual(device["state"], "NY")  # nearest ZIP to Midtown Manhattan

    def test_no_location_returns_legacy_list_with_hint(self):
        ca_only = self.campaign(geography="states", geography_states=["CA"])
        resp, ids = self.feed()
        self.assertEqual(resp["X-Discovery-Location"], "required")
        self.assertIn(str(ca_only.id), ids)  # unchanged legacy behaviour

    def test_geography_gate(self):
        everywhere = self.campaign()
        california = self.campaign(geography="states", geography_states=["ca"])
        near_sf = self.campaign(geography="zip_radius", geography_areas=[{"zip": SF, "radius_miles": 5}])
        resp, sf_ids = self.feed(zip=SF_NEARBY)
        self.assertEqual(resp["X-Discovery-Location"], SF_NEARBY)
        self.assertEqual(set(sf_ids), {str(everywhere.id), str(california.id), str(near_sf.id)})
        _, ny_ids = self.feed(zip=NYC)
        self.assertEqual(ny_ids, [str(everywhere.id)])
        # Saved location is used when no params are sent.
        self.client.put(reverse("v1:offers:discovery-location"), {"zip": NYC}, format="json")
        self.assertEqual(self.feed()[1], [str(everywhere.id)])

    def test_direct_entry_bypasses_geography_only(self):
        california = self.campaign(geography="states", geography_states=["CA"])
        self.client.force_authenticate(None)
        token = california.campaign_url.token
        resp = self.client.get(reverse("v1:offers:by-url", args=[token]))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["claimable"])

    def test_claim_hides_only_that_campaign(self):
        a = self.campaign("Acme")
        b = self.campaign("Acme")  # same brand
        reservation_services.create_reservation(user=self.shopper, campaign_id=a.id)
        _, ids = self.feed(zip=SF)
        self.assertEqual(ids, [str(b.id)])

    def test_ranking_store_match_and_brand_interest(self):
        plain = self.campaign("Plain")
        walmart = Retailer.objects.get(name="Walmart")
        store = self.campaign("Store", retailers=[walmart.id])
        interest = self.campaign("Fancy")
        # Shopper has a verified Walmart receipt (from another campaign)...
        other = self.campaign("Other")
        reservation = reservation_services.create_reservation(user=self.shopper, campaign_id=other.id)
        receipt_services.upload_receipt(
            user=self.shopper, reservation_id=reservation.id, **RECEIPT_META, merchant="WALMART #12",
            items=[{"description": other.products.first().name, "quantity": 1, "unit_price": "2.00"}],
        )
        # ...and viewed the "Fancy" brand recently.
        OfferView.objects.create(user=self.shopper, campaign=interest, source=OfferView.Source.DETAIL)
        cfg = get_platform_settings()
        cfg.store_match_multiplier, cfg.brand_interest_multiplier = Decimal("2.00"), Decimal("1.50")
        cfg.save()
        _, ids = self.feed(zip=SF)
        self.assertEqual(ids[:3], [str(store.id), str(interest.id), str(plain.id)])

    def test_geography_validation(self):
        for geo, message in (
            ({"geography": "states", "geography_states": []}, "state"),
            ({"geography": "states", "geography_states": ["ZZ"]}, "Unknown state"),
            ({"geography": "zip_radius", "geography_areas": [{"zip": SF, "radius_miles": 7}]}, "Radius"),
            ({"geography": "zip_radius", "geography_areas": [{"zip": "00000", "radius_miles": 5}]}, "ZIP"),
        ):
            with self.assertRaisesMessage(campaign_services.CampaignError, message):
                self.campaign(**geo)

    def test_going_fast_threshold_is_configurable(self):
        campaign = self.campaign()  # capacity 10
        for i in range(7):
            reservation_services.create_reservation(
                user=User.objects.create_user(email=f"g{i}@x.com", password="x", full_name="G"), campaign_id=campaign.id
            )
        self.assertFalse(offer_services.resolve_offer(campaign)["going_fast"])  # 3 left > 20%
        cfg = get_platform_settings()
        cfg.going_fast_percent = 30
        cfg.save()
        self.assertTrue(offer_services.resolve_offer(campaign)["going_fast"])
