"""Retailer directory, Retailer Availability, Featured Retailers and
Retailer-Required receipt eligibility (Master #10)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import approvals
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign, CampaignReview, Retailer
from Apps.common.testing import RECEIPT_META, go_live
from Apps.offers import services as offer_services
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.receipts.models import Receipt
from Apps.reservations import services as reservation_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class RetailerTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="O")
        self.brand = Brand.objects.create(name="Acme", slug="acme")
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        self.product = create_product(brand=self.brand, name="Cola 12oz", category="Drinks")
        wallet_services.credit(
            wallet=wallet_services.get_or_create_brand_wallet(self.brand),
            amount=Decimal("500"), category=LedgerEntry.Category.FUNDING,
        )
        self.walmart = Retailer.objects.get(name="Walmart")  # seeded directory
        self.target = Retailer.objects.get(name="Target")
        self.kroger = Retailer.objects.get(name="Kroger")
        self.client.force_authenticate(self.owner)

    def create(self, **extra):
        body = {"name": "Deal", "product": [str(self.product.id)], "deal_type": "free",
                "max_rebate": "5.00", "desired_redemptions": 10, "estimated_redemption_rate": "50", **extra}
        return self.client.post(reverse("v1:campaigns:campaign-list", args=[self.brand.id]), body, format="json")

    def test_directory_search_and_add_missing(self):
        resp = self.client.get(reverse("v1:campaigns:retailer-list"), {"search": "wal"})
        self.assertIn("Walmart", [r["name"] for r in resp.data])
        add = reverse("v1:campaigns:brand-retailer-create", args=[self.brand.id])
        created = self.client.post(add, {"name": "  Corner   Market "}, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual((created.data["name"], created.data["is_verified"]), ("Corner Market", False))
        again = self.client.post(add, {"name": "walmart"}, format="json")
        self.assertEqual((again.status_code, again.data["name"]), (200, "Walmart"))
        # The brand sees its own unverified retailer; other users don't.
        mine = self.client.get(reverse("v1:campaigns:retailer-list"), {"search": "corner"})
        self.assertEqual(len(mine.data), 1)
        stranger = User.objects.create_user(email="z@x.com", password="x", full_name="Z")
        self.client.force_authenticate(stranger)
        self.assertEqual(len(self.client.get(reverse("v1:campaigns:retailer-list"), {"search": "corner"}).data), 0)

    def test_availability_featured_and_where_to_buy(self):
        resp = self.create(retailers=[str(self.walmart.id), str(self.target.id), str(self.kroger.id)],
                           featured_retailers=[str(self.target.id)])
        self.assertEqual(resp.status_code, 201)
        self.assertEqual([r["name"] for r in resp.data["retailers"]], ["Kroger", "Target", "Walmart"])
        self.assertEqual(resp.data["featured_retailers"], [{"id": str(self.target.id), "name": "Target"}])
        self.assertFalse(resp.data["retailer_required"])
        self.assertEqual(resp.data["allowed_merchants"], "")  # Any Retailer
        offer = offer_services.resolve_offer(Campaign.objects.get(pk=resp.data["id"]))
        self.assertEqual(offer["where_to_buy"], ["Kroger", "Target", "Walmart"])
        self.assertEqual(offer["featured_retailers"], ["Target"])
        self.assertFalse(offer["retailer_required"])

    def test_featured_rules(self):
        bad = self.create(retailers=[str(self.walmart.id)], featured_retailers=[str(self.target.id)])
        self.assertEqual(bad.status_code, 400)
        four = Retailer.objects.all()[:4]
        too_many = self.create(retailers=[str(r.id) for r in four], featured_retailers=[str(r.id) for r in four])
        self.assertEqual(too_many.status_code, 400)

    def test_retailer_required_restricts_receipts(self):
        resp = self.create(retailers=[str(self.walmart.id), str(self.target.id)], retailer_required=True)
        campaign = Campaign.objects.get(pk=resp.data["id"])
        self.assertEqual(campaign.allowed_merchants, "Target, Walmart")
        offer = offer_services.resolve_offer(campaign)
        self.assertEqual((offer["retailer_required"], offer["eligible_retailers"]), (True, ["Target", "Walmart"]))
        go_live(campaign)
        shopper = User.objects.create_user(email="s@x.com", password="x", full_name="S")
        reservation = reservation_services.create_reservation(user=shopper, campaign_id=campaign.id)
        with self.assertRaises(receipt_services.ReceiptError):
            receipt_services.upload_receipt(
                user=shopper, reservation_id=reservation.id, **RECEIPT_META, merchant="Kroger #12",
                items=[{"description": "Cola 12oz", "quantity": 1, "unit_price": "2.00"}],
            )
        receipt = receipt_services.upload_receipt(
            user=shopper, reservation_id=reservation.id, **RECEIPT_META, merchant="WALMART SUPERCENTER",
            items=[{"description": "Cola 12oz", "quantity": 1, "unit_price": "2.00"}],
        )
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)

    def test_retailer_required_needs_retailers_to_submit(self):
        resp = self.create(retailer_required=True)
        submit = self.client.post(reverse("v1:campaigns:campaign-submit", args=[self.brand.id, resp.data["id"]]))
        self.assertEqual(submit.status_code, 400)
        self.assertIn("retailers", submit.data["detail"])

    def test_retailer_changes_on_a_live_campaign_are_a_revision(self):
        resp = self.create(retailers=[str(self.walmart.id)])
        campaign = Campaign.objects.get(pk=resp.data["id"])
        Campaign.objects.filter(pk=campaign.pk).update(review_status=Campaign.ReviewStatus.APPROVED)
        campaign.refresh_from_db()
        campaign_services.update_campaign(
            campaign, retailers=[self.walmart.id, self.target.id], featured_retailers=[self.target.id],
            retailer_required=True,
        )
        self.assertEqual(list(campaign.retailers.values_list("name", flat=True)), ["Walmart"])  # unchanged
        revision = CampaignReview.objects.get(kind=CampaignReview.Kind.REVISION)
        self.assertEqual(set(revision.changes), {"retailers", "featured_retailers", "retailer_required"})
        admin = User.objects.create_user(email="a@x.com", password="x", full_name="A", role=User.Role.ADMIN, is_staff=True)
        approvals.approve(revision, admin=admin)
        campaign.refresh_from_db()
        self.assertEqual(campaign.allowed_merchants, "Target, Walmart")
        self.assertEqual(list(campaign.featured_retailers.values_list("name", flat=True)), ["Target"])
