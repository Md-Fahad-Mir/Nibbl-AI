"""Brand refund requests (Master Wallet: Request Refund)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.common.models import AuditLog
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry, RefundRequest

C = LedgerEntry.Category


class RefundRequestTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner")
        self.viewer = User.objects.create_user(email="v@x.com", password="x", full_name="Viewer")
        self.brand = Brand.objects.create(name="Acme", slug="acme")
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        BrandMembership.objects.create(brand=self.brand, user=self.viewer, role=BrandMembership.Role.MEMBER)
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("100"), category=C.FUNDING)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("50"), category=C.ADJUSTMENT, is_promotional=True)
        wallet_services.place_hold(wallet=self.wallet, amount=Decimal("30"), reference_type="reservation")
        self.admin = User.objects.create_user(
            email="a@x.com", password="x", full_name="A", role=User.Role.ADMIN, is_staff=True
        )
        self.url = reverse("v1:wallets:brand-refund-requests", args=[self.brand.id])

    def request(self, amount, user=None):
        self.client.force_authenticate(user or self.owner)
        return self.client.post(self.url, {"amount": amount, "reason": "Pausing for the season"}, format="json")

    def test_only_available_cash_is_refundable(self):
        self.client.force_authenticate(self.owner)
        # $100 cash − $30 reserved = $70; the $50 promo credit is never refundable.
        self.assertEqual(self.client.get(self.url).data["refundable"], "70.00")
        self.assertEqual(self.request("70.01").status_code, 400)
        self.assertEqual(self.request("0").status_code, 400)
        self.assertEqual(self.request("abc").status_code, 400)
        self.assertEqual(self.request("70", user=self.viewer).status_code, 403)  # Owner only

        created = self.request("70")
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["requests"][0]["status"], "pending")
        self.assertEqual(self.request("1").status_code, 400)  # one pending at a time
        self.assertEqual(self.wallet.ledger_entries.filter(category=C.REFUND).count(), 0)  # nothing moved yet

    def test_admin_marks_refunded_or_rejects(self):
        self.request("40")
        refund = RefundRequest.objects.get()
        self.client.force_authenticate(self.admin)
        listing = self.client.get(reverse("v1:admin_panel:refund-requests"), {"status": "pending"}).data
        self.assertEqual((listing["summary"]["pending"], listing["results"][0]["available_cash"]), (1, "70.00"))

        action = lambda a, body: self.client.post(  # noqa: E731
            reverse("v1:admin_panel:refund-request-action", args=[refund.id, a]), body, format="json"
        )
        done = action("refunded", {"reference": "re_123"})
        self.assertEqual((done.status_code, done.data["status"], done.data["stripe_reference"]), (200, "refunded", "re_123"))
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, Decimal("110.00"))  # 150 − 40
        entry = self.wallet.ledger_entries.get(category=C.REFUND)
        self.assertEqual((entry.amount, entry.is_promotional), (Decimal("40.00"), False))
        self.assertEqual(action("refunded", {}).status_code, 400)  # already decided
        self.assertTrue(AuditLog.objects.filter(target_id=str(refund.id), action="approve").exists())

        # A rejection needs a reason and moves no money.
        self.request("10")
        second = RefundRequest.objects.get(status="pending")
        reject = lambda body: self.client.post(  # noqa: E731
            reverse("v1:admin_panel:refund-request-action", args=[second.id, "reject"]), body, format="json"
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(reject({}).status_code, 400)
        self.assertEqual(reject({"note": "Funds are committed to an open campaign."}).data["status"], "rejected")
        self.assertEqual(self.wallet.ledger_entries.filter(category=C.REFUND).count(), 1)

    def test_cannot_refund_more_than_is_still_available(self):
        self.request("70")
        wallet_services.place_hold(wallet=self.wallet, amount=Decimal("20"), reference_type="reservation")
        self.client.force_authenticate(self.admin)
        refund = RefundRequest.objects.get()
        url = reverse("v1:admin_panel:refund-request-action", args=[refund.id, "refunded"])
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 400)
