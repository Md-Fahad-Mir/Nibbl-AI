from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing import services
from Apps.billing.models import Plan, PromoCode, PromoCodeRedemption
from Apps.brands.models import Brand, BrandMembership
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def _brand(slug="acme"):
    return Brand.objects.create(name="Acme", slug=slug, plan=Plan.objects.get(slug="pro"))


# ---------------------------------------------------------------------------
# Promo-money rules (the Master's "credits never fund shopper rewards")
# ---------------------------------------------------------------------------
class PromoMoneyRulesTests(APITestCase):
    def setUp(self):
        self.brand = _brand()
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)

    def _redeem(self, amount="100.00"):
        code = services.create_promo_code(code="welcome", amount=Decimal(amount))
        return services.redeem_promo_code(brand=self.brand, code="WELCOME")

    def test_redeem_adds_promotional_credit_only(self):
        self._redeem("100.00")
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("100.00"))
        self.assertEqual(self.wallet.promo_balance(), Decimal("100.00"))
        # Promo must not count as money available to fund rewards.
        self.assertEqual(self.wallet.reward_available(), Decimal("0.00"))

    def test_promo_cannot_be_held_for_a_reward(self):
        self._redeem("100.00")
        with self.assertRaises(wallet_services.InsufficientFunds):
            wallet_services.place_hold(wallet=self.wallet, amount=Decimal("10.00"))

    def test_promo_cannot_fund_a_real_only_debit(self):
        self._redeem("100.00")
        with self.assertRaises(wallet_services.InsufficientFunds):
            wallet_services.debit(
                wallet=self.wallet, amount=Decimal("10.00"),
                category=LedgerEntry.Category.REVIEW_REWARD, real_only=True,
            )

    def test_charge_eligible_spends_promo_first_then_real(self):
        # $50 real + $30 promo, charge a $60 fee.
        wallet_services.credit(
            wallet=self.wallet, amount=Decimal("50.00"),
            category=LedgerEntry.Category.FUNDING,
        )
        services.create_promo_code(code="p30", amount=Decimal("30.00"))
        services.redeem_promo_code(brand=self.brand, code="P30")

        entries = wallet_services.charge_eligible(
            wallet=self.wallet, amount=Decimal("60.00"),
            category=LedgerEntry.Category.REBATE_FEE,
        )
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("20.00"))      # 80 - 60
        self.assertEqual(self.wallet.promo_balance(), Decimal("0.00"))  # 30 promo used
        self.assertEqual(self.wallet.reward_available(), Decimal("20.00"))
        self.assertEqual(len(entries), 2)
        self.assertEqual(
            sorted(e.amount for e in entries), [Decimal("30.00"), Decimal("30.00")]
        )

    def test_charge_eligible_uses_real_when_no_promo(self):
        wallet_services.credit(
            wallet=self.wallet, amount=Decimal("40.00"),
            category=LedgerEntry.Category.FUNDING,
        )
        entries = wallet_services.charge_eligible(
            wallet=self.wallet, amount=Decimal("25.00"),
            category=LedgerEntry.Category.SUBSCRIPTION,
        )
        self.assertEqual(len(entries), 1)
        self.assertFalse(entries[0].is_promotional)

    def test_charge_eligible_insufficient_real_funds(self):
        # Only promo present; a fee larger than promo needs real funds it lacks.
        self._redeem("20.00")
        with self.assertRaises(wallet_services.InsufficientFunds):
            wallet_services.charge_eligible(
                wallet=self.wallet, amount=Decimal("50.00"),
                category=LedgerEntry.Category.REBATE_FEE,
            )


# ---------------------------------------------------------------------------
# Redemption validation
# ---------------------------------------------------------------------------
class PromoRedemptionValidationTests(APITestCase):
    def setUp(self):
        self.brand = _brand()

    def test_invalid_code_rejected(self):
        with self.assertRaises(services.BillingError):
            services.redeem_promo_code(brand=self.brand, code="NOPE")

    def test_inactive_code_rejected(self):
        services.create_promo_code(code="off", amount=Decimal("5.00"))
        PromoCode.objects.filter(code="OFF").update(is_active=False)
        with self.assertRaises(services.BillingError):
            services.redeem_promo_code(brand=self.brand, code="OFF")

    def test_expired_code_rejected(self):
        services.create_promo_code(
            code="old", amount=Decimal("5.00"),
            valid_until=timezone.now() - timedelta(days=1),
        )
        with self.assertRaises(services.BillingError):
            services.redeem_promo_code(brand=self.brand, code="OLD")

    def test_not_yet_valid_code_rejected(self):
        services.create_promo_code(
            code="soon", amount=Decimal("5.00"),
            valid_from=timezone.now() + timedelta(days=1),
        )
        with self.assertRaises(services.BillingError):
            services.redeem_promo_code(brand=self.brand, code="SOON")

    def test_once_per_brand_blocks_second_redeem(self):
        services.create_promo_code(code="one", amount=Decimal("5.00"))
        services.redeem_promo_code(brand=self.brand, code="ONE")
        with self.assertRaises(services.BillingError):
            services.redeem_promo_code(brand=self.brand, code="ONE")

    def test_max_redemptions_enforced(self):
        services.create_promo_code(
            code="cap", amount=Decimal("5.00"), max_redemptions=1, once_per_brand=False
        )
        services.redeem_promo_code(brand=self.brand, code="CAP")
        other = _brand(slug="acme2")
        with self.assertRaises(services.BillingError):
            services.redeem_promo_code(brand=other, code="CAP")

    def test_duplicate_code_creation_rejected(self):
        services.create_promo_code(code="dup", amount=Decimal("5.00"))
        with self.assertRaises(services.BillingError):
            services.create_promo_code(code="DUP", amount=Decimal("5.00"))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
class PromoCodeEndpointTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@example.com", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_staff=True,
        )
        self.owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner",
        )
        self.brand = _brand()
        BrandMembership.objects.create(
            brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER
        )
        self.admin_url = reverse("v1:admin_panel:promo-codes")
        self.redeem_url = reverse("v1:billing:redeem-promo", kwargs={"brand_id": self.brand.id})

    def test_admin_creates_and_lists_promo_code(self):
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            self.admin_url, {"code": "save10", "amount": "10.00"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["code"], "SAVE10")

        listing = self.client.get(self.admin_url)
        self.assertEqual(len(listing.data), 1)

    def test_non_admin_cannot_create(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.post(
            self.admin_url, {"code": "x", "amount": "10.00"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_brand_redeems_code(self):
        services.create_promo_code(code="welcome", amount=Decimal("25.00"))
        self.client.force_authenticate(self.owner)
        resp = self.client.post(self.redeem_url, {"code": "welcome"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["amount"], "25.00")
        self.assertEqual(resp.data["promotional_balance"], "25.00")
        self.assertTrue(
            PromoCodeRedemption.objects.filter(brand=self.brand).exists()
        )

    def test_redeem_invalid_code_returns_400(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.post(self.redeem_url, {"code": "nope"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
