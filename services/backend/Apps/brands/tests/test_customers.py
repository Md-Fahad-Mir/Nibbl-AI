from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.reservations import services as reservation_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry
from Apps.common.testing import RECEIPT_META


def _brand_with_customer(plan_slug):
    owner = User.objects.create_user(email=f"owner-{plan_slug}@example.com", password="x", full_name="O")
    brand = Brand.objects.create(name="Acme", slug=f"acme-{plan_slug}", plan=Plan.objects.get(slug=plan_slug))
    BrandMembership.objects.create(brand=brand, user=owner, role=BrandMembership.Role.OWNER)
    product = create_product(brand=brand, name="Cola")
    campaign = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Deal", daily_budget=Decimal("100.00")
    )
    campaign_services.set_tiers(campaign, [{"reward_amount": "5.00", "allocation_percent": "100.00"}])
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(wallet=wallet, amount=Decimal("100.00"), category=LedgerEntry.Category.FUNDING)
    campaign_services.activate_campaign(campaign)

    customer = User.objects.create_user(email="shopper@example.com", password="x", full_name="Shopper")
    reservation = reservation_services.create_reservation(user=customer, campaign_id=campaign.id)
    receipt_services.upload_receipt(
        user=customer, reservation_id=reservation.id, **RECEIPT_META,
        items=[{"description": "Cola", "quantity": 1}],
    )
    return owner, brand, customer


class CustomersPlanGatingTests(APITestCase):
    def test_starter_plan_anonymizes_customers(self):
        owner, brand, customer = _brand_with_customer("starter")
        self.client.force_authenticate(owner)
        resp = self.client.get(reverse("v1:brands:customer-list", args=[brand.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["data_access_level"], "anonymized")
        self.assertEqual(resp.data["count"], 1)
        row = resp.data["customers"][0]
        self.assertIsNone(row["email"])  # PII masked
        self.assertIsNone(row["full_name"])
        self.assertTrue(row["customer_ref"].startswith("cust_"))
        self.assertEqual(row["redemptions"], 1)

    def test_pro_plan_shows_full_customer_data(self):
        owner, brand, customer = _brand_with_customer("pro")
        self.client.force_authenticate(owner)
        resp = self.client.get(reverse("v1:brands:customer-list", args=[brand.id]))
        self.assertEqual(resp.data["data_access_level"], "full")
        row = resp.data["customers"][0]
        self.assertEqual(row["email"], "shopper@example.com")
        self.assertEqual(row["full_name"], "Shopper")

    def test_non_member_cannot_view_customers(self):
        owner, brand, customer = _brand_with_customer("pro")
        outsider = User.objects.create_user(email="out@example.com", password="x", full_name="X")
        self.client.force_authenticate(outsider)
        resp = self.client.get(reverse("v1:brands:customer-list", args=[brand.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
