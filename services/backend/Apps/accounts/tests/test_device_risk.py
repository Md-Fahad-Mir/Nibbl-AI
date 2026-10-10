"""Device / network fraud checks (Master #51)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts import risk
from Apps.accounts.models import DeviceRecord, User
from Apps.common.models import get_platform_settings
from Apps.payouts import services as payouts
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

PASSWORD = "Str0ng!Passw0rd"


class DeviceRiskTests(APITestCase):
    def make_user(self, n):
        return User.objects.create_user(email=f"u{n}@x.com", password=PASSWORD, full_name=f"U{n}",
                                        is_email_verified=True)

    def login(self, user, device="device-aaaaaaaa", ip="10.0.0.1"):
        resp = self.client.post(reverse("v1:accounts:auth:login"), {"email": user.email, "password": PASSWORD},
                                format="json", HTTP_X_DEVICE_ID=device, REMOTE_ADDR=ip)
        self.assertEqual(resp.status_code, 200)

    def test_login_records_hashed_device_ip_and_browser(self):
        user = self.make_user(1)
        self.client.post(reverse("v1:accounts:auth:login"), {"email": user.email, "password": PASSWORD},
                         format="json", HTTP_X_DEVICE_ID="device-aaaaaaaa", HTTP_USER_AGENT="Firefox/1",
                         REMOTE_ADDR="10.0.0.9")
        record = DeviceRecord.objects.get()
        self.assertEqual((record.event, record.ip_address, record.user_agent), ("login", "10.0.0.9", "Firefox/1"))
        self.assertEqual(len(record.device_id), 64)
        self.assertNotIn("device-aaaaaaaa", record.device_id)

    def test_shared_device_flags_and_routes_withdrawal_to_review(self):
        users = [self.make_user(i) for i in range(3)]
        for user in users:  # 3 accounts on one device; limit is 2
            self.login(user, ip=f"10.0.1.{users.index(user)}")
        reasons = risk.risk_reasons(users[0])
        self.assertTrue(reasons and "Device shared by 3 accounts" in reasons[0])

        wallet_services.credit(wallet=wallet_services.get_or_create_customer_wallet(users[0]),
                               amount=Decimal("5"), category=LedgerEntry.Category.REBATE_REWARD)
        method = payouts.add_payout_method(user=users[0], provider="paypal", handle="u0@pay.com")
        withdrawal = payouts.request_withdrawal(user=users[0], payout_method_id=method.id, amount=Decimal("2"))
        self.assertTrue(withdrawal.needs_review)
        self.assertIn("Device shared", withdrawal.admin_note)

    def test_network_rule_and_admin_switch(self):
        users = [self.make_user(i) for i in range(6)]
        for i, user in enumerate(users):  # 6 accounts, one network, different devices; limit 5
            self.login(user, device=f"device-{i:08d}", ip="10.0.2.1")
        self.assertIn("6 accounts on one network", risk.risk_reasons(users[0])[0])
        cfg = get_platform_settings()
        cfg.device_checks_enabled = False
        cfg.save()
        self.assertEqual(risk.risk_reasons(users[0]), [])

    def test_admin_linked_accounts(self):
        a, b = self.make_user(1), self.make_user(2)
        self.login(a)
        self.login(b, ip="10.9.9.9")
        admin = User.objects.create_user(email="admin@x.com", password="x", full_name="A",
                                         role=User.Role.ADMIN, is_staff=True)
        self.client.force_authenticate(admin)
        data = self.client.get(reverse("v1:admin_panel:user-linked-accounts", args=[a.id])).data
        self.assertEqual([(x["email"], x["shared"]) for x in data["linked_accounts"]], [("u2@x.com", ["device"])])
