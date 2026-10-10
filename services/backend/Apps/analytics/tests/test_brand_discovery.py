"""Receipt Brand Discovery (Master #48)."""

import datetime as dt
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.analytics.discovery import brand_token
from Apps.billing.models import Plan
from Apps.brands.models import Brand
from Apps.campaigns.models import Campaign
from Apps.products.services import create_product
from Apps.receipts.models import Receipt, ReceiptLineItem
from Apps.reservations.models import Reservation


class BrandDiscoveryTests(APITestCase):
    def setUp(self):
        self.partner = Brand.objects.create(name="Acme Snacks", slug="acme", plan=Plan.objects.get(slug="pro"))
        self.product = create_product(brand=self.partner, name="Acme Chips", category="Chips")
        self.admin = User.objects.create_user(email="a@x.com", password="x", full_name="A",
                                              role=User.Role.ADMIN, is_staff=True)
        self.shoppers = [User.objects.create_user(email=f"s{i}@x.com", password="x", full_name="S") for i in range(2)]
        self.n = 0
        # Shopper 0 buys Kettle twice (repeat), shopper 1 once; Acme (partner) and GV lines too.
        self.receipt(self.shoppers[0], ["KETTLE SEA SALT 5OZ", "ACME CHIPS"])
        self.receipt(self.shoppers[0], ["KETTLE JALAPENO 8OZ", "GV MILK 1GAL"])
        self.receipt(self.shoppers[1], ["KETTLE SEA SALT 5OZ"], merchant="Target")
        self.receipt(self.shoppers[1], ["SOMETHING NEW"], status=Receipt.Status.PENDING)  # not verified
        self.client.force_authenticate(self.admin)
        self.url = reverse("v1:analytics:brand-discovery")

    def receipt(self, user, lines, merchant="Walmart", status=Receipt.Status.VERIFIED):
        self.n += 1
        campaign = Campaign.objects.create(brand=self.partner, name=f"C{self.n}", status=Campaign.Status.ACTIVE)
        campaign.products.add(self.product)
        reservation = Reservation.objects.create(
            user=user, campaign=campaign, offer_type=Reservation.OfferType.PREMIUM,
            reward_amount=Decimal("5.00"), expires_at=timezone.now() + dt.timedelta(days=7),
        )
        receipt = Receipt.objects.create(user=user, brand=self.partner, campaign=campaign,
                                         reservation=reservation, merchant=merchant, status=status)
        for text in lines:
            ReceiptLineItem.objects.create(receipt=receipt, description=text)

    def test_token(self):
        self.assertEqual((brand_token("Kettle Sea Salt 5oz"), brand_token("12 OZ")), ("KETTLE", "OZ"))

    def test_leads_without_identities(self):
        data = self.client.get(self.url).data
        names = [lead["brand"] for lead in data["leads"]]
        self.assertNotIn("Acme", names)  # existing partner excluded
        self.assertNotIn("Something", names)  # pending receipt excluded
        kettle = data["leads"][0]
        self.assertEqual((kettle["brand"], kettle["unique_shoppers"], kettle["receipt_volume"],
                          kettle["repeat_purchasers"]), ("Kettle", 2, 3, 1))
        self.assertEqual(set(kettle["retailers"]), {"Walmart", "Target"})
        self.assertNotIn("s0@x.com", str(data))
        self.assertEqual(data["summary"]["participating_retailers"], 2)

    def test_rules_merge_and_ignore_and_export(self):
        self.client.put(reverse("v1:analytics:brand-discovery-insight", args=["GV"]),
                        {"ignored": True}, format="json")
        self.client.put(reverse("v1:analytics:brand-discovery-insight", args=["KETTLE"]),
                        {"display_name": "Kettle Brand"}, format="json")
        names = [lead["brand"] for lead in self.client.get(self.url).data["leads"]]
        self.assertEqual(names, ["Kettle Brand"])
        insight = self.client.get(reverse("v1:analytics:brand-discovery-insight", args=["Kettle Brand"])).data
        self.assertIn("3 verified receipts", insight["outreach_message"])
        csv_body = self.client.get(self.url, {"export": "csv"}).content.decode()
        self.assertIn("Kettle Brand", csv_body)
        self.assertEqual(self.client.get(self.url, {"retailer": "target"}).data["summary"]["verified_receipts"], 1)
