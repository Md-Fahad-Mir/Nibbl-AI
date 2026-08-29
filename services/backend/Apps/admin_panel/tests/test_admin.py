from decimal import Decimal

from django.contrib.auth import authenticate
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.common.models import AuditLog
from Apps.products.services import create_product
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def _admin():
    return User.objects.create_user(
        email="admin@example.com", password="pw12345!", full_name="Admin",
        role=User.Role.ADMIN, is_staff=True,
    )


def _brand(slug="acme", plan="starter"):
    owner = User.objects.create_user(email=f"{slug}@example.com", password="x", full_name="O")
    brand = Brand.objects.create(name=slug.title(), slug=slug, plan=Plan.objects.get(slug=plan))
    BrandMembership.objects.create(brand=brand, user=owner, role=BrandMembership.Role.OWNER)
    return owner, brand


class AdminGatingTests(APITestCase):
    def test_non_admin_blocked_on_admin_endpoints(self):
        owner, brand = _brand()
        self.client.force_authenticate(owner)
        for name, args in [
            ("v1:admin_panel:campaigns", []),
            ("v1:admin_panel:user-list", []),
            ("v1:admin_panel:audit-logs", []),
            ("v1:admin_panel:transactions", []),
            ("v1:admin_panel:user-wallet-credit", [owner.id]),
        ]:
            method = self.client.post if name == "v1:admin_panel:user-wallet-credit" else self.client.get
            resp = method(reverse(name, args=args), {}, format="json")
            self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, name)

    def test_admin_can_list_campaigns_across_brands(self):
        owner_a, brand_a = _brand("acme")
        owner_b, brand_b = _brand("globex")
        for brand in (brand_a, brand_b):
            product = create_product(brand=brand, name="P")
            campaign_services.create_campaign(
                brand=brand, product_ids=[product.id], name="C", daily_budget=Decimal("10.00")
            )
        self.client.force_authenticate(_admin())
        resp = self.client.get(reverse("v1:admin_panel:campaigns"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 2)  # cross-brand visibility


class PromoCreditTests(APITestCase):
    def test_promo_credit_funds_wallet_and_audits(self):
        owner, brand = _brand()
        admin = _admin()
        self.client.force_authenticate(admin)
        resp = self.client.post(
            reverse("v1:admin_panel:promo-credit", args=[brand.id]),
            {"amount": "50.00", "note": "Welcome bonus"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        wallet = wallet_services.get_or_create_brand_wallet(brand)
        self.assertEqual(wallet.balance, Decimal("50.00"))
        self.assertTrue(
            AuditLog.objects.filter(
                target_type="brand", target_id=str(brand.id),
                metadata__event="promo_credit",
            ).exists()
        )


class PlanChangeTests(APITestCase):
    def test_change_plan(self):
        owner, brand = _brand(plan="starter")
        self.client.force_authenticate(_admin())
        resp = self.client.post(
            reverse("v1:admin_panel:change-plan", args=[brand.id]),
            {"plan": "pro"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        brand.refresh_from_db()
        self.assertEqual(brand.plan.slug, "pro")


class UserWalletCreditTests(APITestCase):
    def test_admin_can_credit_user_wallet_and_audits(self):
        target = User.objects.create_user(email="u@example.com", password="pw12345!", full_name="User")
        admin = _admin()
        self.client.force_authenticate(admin)

        resp = self.client.post(
            reverse("v1:admin_panel:user-wallet-credit", args=[target.id]),
            {"amount": "75.00", "note": "Manual credit"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        wallet = wallet_services.get_or_create_customer_wallet(target)
        self.assertEqual(wallet.balance, Decimal("75.00"))
        self.assertTrue(
            LedgerEntry.objects.filter(
                wallet=wallet,
                category=LedgerEntry.Category.ADJUSTMENT,
                amount=Decimal("75.00"),
            ).exists()
        )
        self.assertTrue(
            AuditLog.objects.filter(
                target_type="user", target_id=str(target.id), metadata__event="user_wallet_credit"
            ).exists()
        )


class SuspendUserTests(APITestCase):
    def test_suspend_blocks_login_and_audits(self):
        target = User.objects.create_user(email="bad@example.com", password="pw12345!", full_name="Bad")
        self.client.force_authenticate(_admin())
        resp = self.client.post(
            reverse("v1:admin_panel:user-suspend", args=[target.id]),
            {"reason": "Fraud"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertFalse(target.is_active)
        # Login is blocked for suspended users.
        self.assertIsNone(authenticate(username="bad@example.com", password="pw12345!"))
        self.assertTrue(
            AuditLog.objects.filter(
                target_type="user", target_id=str(target.id),
                metadata__event="user_suspended",
            ).exists()
        )

    def test_reactivate(self):
        target = User.objects.create_user(email="bad@example.com", password="x", full_name="Bad")
        admin = _admin()
        self.client.force_authenticate(admin)
        self.client.post(reverse("v1:admin_panel:user-suspend", args=[target.id]), {}, format="json")
        resp = self.client.post(reverse("v1:admin_panel:user-reactivate", args=[target.id]))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        target.refresh_from_db()
        self.assertTrue(target.is_active)


class AuditLogAccessTests(APITestCase):
    def test_audit_logs_listed(self):
        owner, brand = _brand()
        admin = _admin()
        self.client.force_authenticate(admin)
        self.client.post(
            reverse("v1:admin_panel:promo-credit", args=[brand.id]),
            {"amount": "10.00"}, format="json",
        )
        resp = self.client.get(reverse("v1:admin_panel:audit-logs"), {"target_type": "brand"})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(resp.data), 1)


class BroadcastTests(APITestCase):
    def test_broadcast_sends_to_active_users(self):
        User.objects.create_user(email="u1@example.com", password="x", full_name="U1")
        User.objects.create_user(email="u2@example.com", password="x", full_name="U2")
        admin = _admin()
        self.client.force_authenticate(admin)
        resp = self.client.post(
            reverse("v1:admin_panel:announcements"),
            {"title": "News", "message": "Hello"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(resp.data["recipients"], 3)  # u1, u2, admin
