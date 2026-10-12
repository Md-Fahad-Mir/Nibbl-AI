"""Master Admin pages: Brands board + Admin Mode, Shoppers, Suspensions,
reservation cancel, Admin Users / roles, revenue analytics, referral flags."""

from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import MagicLinkToken, Referral, User
from Apps.accounts.referrals import protection_flags
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandCustomerSuspension, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.models import AuditLog
from Apps.common.testing import go_live
from Apps.products.services import create_product
from Apps.reservations import services as reservation_services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class MasterAdminTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@x.com", password="x", full_name="Admin",
                                              role=User.Role.ADMIN)
        owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner", is_email_verified=True)
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=Plan.objects.get(slug="pro"))
        BrandMembership.objects.create(brand=self.brand, user=owner, role=BrandMembership.Role.OWNER)
        product = create_product(brand=self.brand, name="Granola", category="Snacks")
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("100"), category=LedgerEntry.Category.FUNDING,
                               reference_type="stripe_payment_intent")
        self.campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[product.id], name="Free granola", deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=20, estimated_redemption_rate=Decimal("100"),
            cooldown_days=30, offer_headline="Free Acme Granola",
        )
        go_live(self.campaign)
        self.shopper = User.objects.create_user(email="maya@x.com", password="x", full_name="Maya Thompson")
        self.client.force_authenticate(self.admin)

    def test_brand_board_summary_and_admin_mode(self):
        data = self.client.get(reverse("v1:admin_panel:brand-board"), {"category": "snacks"}).data
        row = data["results"][0]
        self.assertEqual((row["name"], row["category"], row["plan"], row["payment_status"]),
                         ("Acme", "Snacks", "Pro", "not_connected"))
        self.assertEqual(data["kpis"]["active"], 1)
        summary = self.client.get(reverse("v1:admin_panel:brand-summary", args=[self.brand.id])).data
        self.assertTrue(summary["verified"])
        self.assertEqual(summary["active_campaigns"], 1)

        url = self.client.post(reverse("v1:admin_panel:brand-access", args=[self.brand.id])).data["url"]
        self.assertIn(f"admin_brand={self.brand.id}", url)
        self.assertTrue(MagicLinkToken.objects.filter(user=self.admin, used_at__isnull=True).exists())
        self.assertTrue(AuditLog.objects.filter(metadata__event="admin_brand_access_started").exists())

        # Writes made in Admin Mode are logged.
        self.client.patch(reverse("v1:brands:brand-detail", args=[self.brand.id]), {"description": "x"},
                          HTTP_X_NIBBL_ADMIN_BRAND=str(self.brand.id))
        log = AuditLog.objects.get(metadata__event="admin_brand_action")
        self.assertEqual((log.actor_id, log.target_id), (str(self.admin.id), str(self.brand.id)))

    def test_shopper_detail_note_wallet_and_cancel_claim(self):
        reservation = reservation_services.create_reservation(user=self.shopper, campaign_id=self.campaign.id)
        rows = self.client.get(reverse("v1:admin_panel:shopper-list"), {"q": "maya"}).data["results"]
        self.assertEqual([r["email"] for r in rows], ["maya@x.com"])
        for i in range(3):
            User.objects.create_user(email=f"s{i}@x.com", password="x", full_name=f"S{i}")
        page = self.client.get(reverse("v1:admin_panel:shopper-list"), {"page": 2, "page_size": 3}).data
        # 5 shoppers (owner, Maya, 3 new), most recent activity first: s2, s1, s0 | Maya (claimed), owner.
        self.assertEqual((page["count"], page["page"]), (5, 2))
        self.assertEqual([r["email"] for r in page["results"]], ["maya@x.com", "o@x.com"])

        base = reverse("v1:admin_panel:shopper-detail", args=[self.shopper.id])
        self.client.post(base + "notes/", {"body": "Called about a missing reward."})
        resp = self.client.post(base + "wallet/adjust/", {"direction": "credit", "amount": "3.50", "reason": ""})
        self.assertEqual(resp.status_code, 400)  # reason required
        data = self.client.post(base + "wallet/adjust/",
                                {"direction": "credit", "amount": "3.50", "reason": "Goodwill"}).data
        self.assertEqual(data["wallet"]["available"], "3.50")
        self.assertEqual(data["notes"][0]["body"], "Called about a missing reward.")
        self.assertTrue(data["claims"][0]["can_cancel"])
        audit = AuditLog.objects.get(metadata__event="wallet_adjustment")
        self.assertEqual((audit.metadata["before"], audit.metadata["after"]), ("0.00", "3.50"))

        cancel = reverse("v1:admin_panel:reservation-cancel", args=[reservation.id])
        self.assertEqual(self.client.post(cancel, {"reason": ""}).status_code, 400)
        held = self.wallet.held_amount()
        self.client.post(cancel, {"reason": "Duplicate account"})
        reservation.refresh_from_db()
        self.assertEqual(reservation.status, Reservation.Status.CANCELLED)
        self.assertEqual(held - self.wallet.held_amount(), Decimal("5.00"))  # the claim's reserved funds returned
        self.assertTrue(AuditLog.objects.filter(metadata__event="reservation_cancelled").exists())

    def test_suspensions_board_and_remove(self):
        other = Brand.objects.create(name="Bolt", slug="bolt", plan=Plan.objects.get(slug="pro"))
        s1 = BrandCustomerSuspension.objects.create(brand=self.brand, user=self.shopper, reason="Invalid receipt")
        BrandCustomerSuspension.objects.create(brand=other, user=self.shopper, reason="Duplicate purchase")
        data = self.client.get(reverse("v1:admin_panel:suspension-board")).data
        self.assertEqual(data["summary"]["active_brand_suspensions"], 2)
        self.assertEqual(data["summary"]["repeat_suspensions"], 1)
        self.assertTrue(all(r["repeated"] for r in data["results"]))
        self.client.post(reverse("v1:admin_panel:suspension-remove", args=[s1.id]), {"reason": "Reviewed"})
        s1.refresh_from_db()
        self.assertFalse(s1.is_active)

    def test_staff_roles(self):
        resp = self.client.post(reverse("v1:admin_panel:staff-list"),
                                {"email": "sarah@x.com", "full_name": "Sarah Kim", "role": "analytics"})
        self.assertEqual(resp.status_code, 201)
        sarah = User.objects.get(email="sarah@x.com")
        self.assertTrue(sarah.is_platform_admin)
        self.assertEqual(sarah.admin_staff_role, "analytics")

        self.client.force_authenticate(sarah)
        self.assertEqual(self.client.get(reverse("v1:admin_panel:shopper-list")).status_code, 200)
        self.assertEqual(self.client.put(reverse("v1:admin_panel:settings"), {"referral_volume_limit": 3}).status_code,
                         403)  # Analytics is read-only

        self.client.force_authenticate(self.admin)
        self.client.patch(reverse("v1:admin_panel:staff-detail", args=[sarah.id]), {"role": "operations"})
        sarah.refresh_from_db()
        self.assertEqual(sarah.staff_role, "operations")
        self.client.force_authenticate(sarah)
        self.assertEqual(self.client.put(reverse("v1:admin_panel:settings"), {"referral_volume_limit": 3}).status_code,
                         403)  # only Administrators change settings
        self.assertTrue(AuditLog.objects.filter(metadata__event="admin_role_changed").exists())

    def test_revenue_analytics_net_and_export(self):
        wallet_services.debit(wallet=self.wallet, amount=Decimal("10"), category=LedgerEntry.Category.SUBSCRIPTION)
        data = self.client.get(reverse("v1:analytics:admin-revenue")).data
        net = data["net_revenue"]
        # Stripe estimate on the $100 funding: 2.9% + $0.30 = $3.20.
        self.assertEqual((net["processing_costs"], net["net"]), ("3.20", "6.80"))
        self.assertEqual(data["brands"][0]["category"], "Snacks")
        resp = self.client.get(reverse("v1:analytics:admin-revenue"), {"export": "csv"})
        self.assertIn("net_revenue_contribution", resp.content.decode())

    def test_referral_flag_rules(self):
        referrer = User.objects.create_user(email="jane.doe@gmail.com", password="x", full_name="Jane Doe")
        new = User.objects.create_user(email="janedoe+2@gmail.com", password="x", full_name="J D")
        referral = Referral.objects.create(referrer=referrer, referred=new)
        self.assertIn("The new shopper appears to be the referrer (same name, email or phone).",
                      protection_flags(referral))
