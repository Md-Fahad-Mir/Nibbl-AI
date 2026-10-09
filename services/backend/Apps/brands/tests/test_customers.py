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
from Apps.common.testing import go_live


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
    go_live(campaign)

    customer = User.objects.create_user(email="shopper@example.com", password="x", full_name="Shopper")
    reservation = reservation_services.create_reservation(
        user=customer, campaign_id=campaign.id, consent_brand=True
    )
    receipt_services.upload_receipt(
        user=customer, reservation_id=reservation.id, **RECEIPT_META,
        items=[{"description": "Cola", "quantity": 1, "unit_price": "10.00"}],
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


class CustomerCsvExportTests(APITestCase):
    def test_pro_export_includes_pii_columns(self):
        owner, brand, customer = _brand_with_customer("pro")
        self.client.force_authenticate(owner)
        resp = self.client.get(reverse("v1:brands:customer-export", args=[brand.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp["Content-Type"], "text/csv")
        self.assertIn("attachment", resp["Content-Disposition"])
        body = resp.content.decode()
        self.assertIn("full_name,email", body)
        self.assertIn("shopper@example.com", body)

    def test_starter_export_masks_pii(self):
        owner, brand, customer = _brand_with_customer("starter")
        self.client.force_authenticate(owner)
        resp = self.client.get(reverse("v1:brands:customer-export", args=[brand.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        body = resp.content.decode()
        self.assertNotIn("email", body.splitlines()[0])  # no PII header
        self.assertNotIn("shopper@example.com", body)
        self.assertIn("cust_", body)

    def test_non_member_cannot_export(self):
        owner, brand, customer = _brand_with_customer("pro")
        outsider = User.objects.create_user(email="out2@example.com", password="x", full_name="X")
        self.client.force_authenticate(outsider)
        resp = self.client.get(reverse("v1:brands:customer-export", args=[brand.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class PerBrandSuspensionTests(APITestCase):
    def _url(self, brand, customer_id, action):
        return reverse("v1:brands:customer-action", args=[brand.id, customer_id, action])

    def test_directory_exposes_user_id_and_suspension_state(self):
        owner, brand, customer = _brand_with_customer("pro")
        self.client.force_authenticate(owner)
        row = self.client.get(
            reverse("v1:brands:customer-list", args=[brand.id])
        ).data["customers"][0]
        self.assertEqual(row["user_id"], str(customer.id))
        self.assertFalse(row["is_suspended"])

    def test_suspend_blocks_claims_on_this_brand_only(self):
        from Apps.reservations.services import ReservationError

        owner, brand, customer = _brand_with_customer("pro")
        self.client.force_authenticate(owner)
        resp = self.client.post(self._url(brand, customer.id, "suspend"), {"reason": "abuse"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        row = self.client.get(
            reverse("v1:brands:customer-list", args=[brand.id])
        ).data["customers"][0]
        self.assertTrue(row["is_suspended"])
        # Still active globally — this is per-brand only.
        customer.refresh_from_db()
        self.assertTrue(customer.is_active)

        campaign = brand.campaigns.first()
        with self.assertRaises(ReservationError):
            reservation_services.create_reservation(user=customer, campaign_id=campaign.id)

        resp = self.client.post(self._url(brand, customer.id, "reactivate"), format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        row = self.client.get(
            reverse("v1:brands:customer-list", args=[brand.id])
        ).data["customers"][0]
        self.assertFalse(row["is_suspended"])

    def test_anonymized_plan_suspends_by_ref(self):
        owner, brand, customer = _brand_with_customer("starter")
        self.client.force_authenticate(owner)
        row = self.client.get(
            reverse("v1:brands:customer-list", args=[brand.id])
        ).data["customers"][0]
        self.assertTrue(row["user_id"].startswith("cust_"))  # no real id leaked
        resp = self.client.post(self._url(brand, row["user_id"], "suspend"), format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_unknown_customer_is_404(self):
        owner, brand, _ = _brand_with_customer("pro")
        stranger = User.objects.create_user(email="x@example.com", password="x", full_name="X")
        self.client.force_authenticate(owner)
        resp = self.client.post(self._url(brand, stranger.id, "suspend"), format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_repeated_suspensions_raise_fraud_flag(self):
        from django.test import override_settings

        from Apps.brands import customers as customer_services
        from Apps.receipts.models import FraudFlag

        owner, brand, customer = _brand_with_customer("pro")
        with override_settings(REPEATED_SUSPENSION_ALERT=2):
            customer_services.suspend_customer(brand=brand, user=customer)
            self.assertFalse(FraudFlag.objects.filter(user=customer).exists())
            customer_services.reactivate_customer(brand=brand, user=customer)
            customer_services.suspend_customer(brand=brand, user=customer)
        self.assertTrue(
            FraudFlag.objects.filter(
                user=customer, detail__startswith="Repeated suspensions"
            ).exists()
        )


class ConsentTests(APITestCase):
    """Master #29: consent status in the directory; opted-out customers keep
    their history but leave downloads; summary + filters."""

    def test_opt_out_flow(self):
        owner, brand, customer = _brand_with_customer("pro")
        self.client.force_authenticate(owner)
        data = self.client.get(reverse("v1:brands:customer-list", args=[brand.id])).data
        row = data["customers"][0]
        self.assertEqual((row["consent_status"], row["consent_source"]), ("opted_in", "claim"))
        self.assertIsNotNone(row["consent_date"])
        self.assertEqual(data["summary"]["opted_in_customers"], 1)

        # The shopper withdraws consent for this brand.
        self.client.force_authenticate(customer)
        consents = self.client.get(reverse("v1:accounts:users:consents")).data
        self.assertEqual([(c["brand_name"], c["opted_in"]) for c in consents], [(brand.name, True)])
        resp = self.client.post(reverse("v1:accounts:users:consent-withdraw"), {"brand": str(brand.id)}, format="json")
        self.assertEqual(resp.status_code, 200)

        self.client.force_authenticate(owner)
        row = self.client.get(reverse("v1:brands:customer-list", args=[brand.id])).data["customers"][0]
        self.assertEqual(row["consent_status"], "opted_out")  # history kept, badge changes
        self.assertIsNotNone(row["consent_withdrawn_at"])
        self.assertEqual(row["redemptions"], 1)
        export = self.client.get(reverse("v1:brands:customer-export", args=[brand.id])).content.decode()
        self.assertNotIn("shopper@example.com", export)

    def test_filters_and_search(self):
        owner, brand, customer = _brand_with_customer("pro")
        self.client.force_authenticate(owner)
        url = reverse("v1:brands:customer-list", args=[brand.id])
        self.assertEqual(self.client.get(url, {"status": "completed_rebate"}).data["count"], 1)
        self.assertEqual(self.client.get(url, {"status": "open_claim"}).data["count"], 0)
        self.assertEqual(self.client.get(url, {"search": "shopper@"}).data["count"], 1)
        self.assertEqual(self.client.get(url, {"search": "nobody"}).data["count"], 0)

    def test_withdraw_without_consent_is_404(self):
        _owner, brand, customer = _brand_with_customer("pro")
        self.client.force_authenticate(customer)
        resp = self.client.post(reverse("v1:accounts:users:consent-withdraw"), {"brand": None}, format="json")
        self.assertEqual(resp.status_code, 404)
