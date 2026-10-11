"""Shopper Wallet & Reward Ledger feed (Master: Wallet Activity, Reward Details)."""

from decimal import Decimal

from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.testing import go_live, receipt_meta
from Apps.payouts import services as payout_services
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.reservations import services as reservation_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

C = LedgerEntry.Category


class ShopperWalletActivityTests(APITestCase):
    def setUp(self):
        brand = Brand.objects.create(name="Acme", slug="acme")
        wallet_services.credit(wallet=wallet_services.get_or_create_brand_wallet(brand), amount=Decimal("100"),
                               category=C.FUNDING)
        chips = create_product(brand=brand, name="Sea Salt Chips", category="Chips")
        soda = create_product(brand=brand, name="Cola", category="Drinks")
        self.campaigns = []
        for product, name in ((chips, "Chips"), (soda, "Cola")):
            campaign = campaign_services.create_campaign(
                brand=brand, product_ids=[product.id], name=name, deal_type=Campaign.DealType.FREE,
                max_rebate=Decimal("5.00"), desired_redemptions=50, estimated_redemption_rate=Decimal("100"),
                cooldown_days=0,
            )
            campaign.offer_headline = f"Free {name}"
            campaign.save(update_fields=["offer_headline"])
            go_live(campaign)
            self.campaigns.append(campaign)
        self.user = User.objects.create_user(email="s@x.com", password="x", full_name="Sam Shopper")
        self.url = reverse("v1:wallets:shopper-wallet-activity")

    def upload(self, campaign, description, number):
        reservation = reservation_services.create_reservation(user=self.user, campaign_id=campaign.id)
        return receipt_services.upload_receipt(
            user=self.user, reservation_id=reservation.id, **receipt_meta(number),
            items=[{"description": description, "quantity": 1, "unit_price": "3.00"}],
        )

    def test_pending_available_and_withdrawal_statuses(self):
        self.upload(self.campaigns[0], "Sea Salt Chips", "INV-1")  # matches → approved → available
        self.upload(self.campaigns[1], "Unknown item", "INV-2")  # no match → pending approval
        wallet = wallet_services.get_or_create_customer_wallet(self.user)
        friend = User.objects.create_user(email="f@x.com", password="x", full_name="Maya Rivera")
        wallet_services.credit(wallet=wallet, amount=Decimal("5"), category=C.REFERRAL_BONUS,
                               reference_type="user", reference_id=friend.id, description="Referral bonus")
        method = payout_services.add_payout_method(user=self.user, provider="paypal", handle="s@paypal.com")
        payout_services.request_withdrawal(user=self.user, payout_method_id=method.id, amount=Decimal("2.00"))

        self.client.force_authenticate(self.user)
        data = self.client.get(self.url).data
        by_status = {}
        for item in data["items"]:
            by_status.setdefault((item["type"], item["status"]), []).append(item)

        pending = by_status[("rebate", "pending")][0]
        self.assertEqual((pending["title"], pending["amount"]), ("Free Cola", "5.00"))
        self.assertEqual([s["label"] for s in pending["timeline"]],
                         ["Receipt submitted", "Under review", "Approved & available"])
        self.assertTrue(pending["timeline"][1]["current"])
        self.assertEqual(data["summary"]["pending_approval"], "5.00")

        available = by_status[("rebate", "available")][0]
        self.assertEqual(available["title"], "Free Chips")
        self.assertTrue(available["details"]["reference"].startswith("NBL-"))
        self.assertEqual(by_status[("referral", "available")][0]["title"], "Referral — Maya R.")

        withdrawal = by_status[("withdrawal", "requested")][0]
        self.assertEqual((withdrawal["amount"], withdrawal["title"]), ("-2.00", "PayPal withdrawal"))
        wallet.refresh_from_db()
        self.assertEqual(Decimal(data["summary"]["available"]), wallet.available())  # $3 + $5 − $2 held
        self.assertEqual(data["summary"]["available"], "6.00")

        # Rejected withdrawal: shown as rejected, amount back in the balance.
        admin = User.objects.create_user(email="a@x.com", password="x", full_name="A", role=User.Role.ADMIN,
                                         is_staff=True)
        payout_services.reject_withdrawal(withdrawal=self.user.withdrawals.get(), admin=admin, reason="Mismatch")
        item = next(i for i in self.client.get(self.url).data["items"] if i["type"] == "withdrawal")
        self.assertEqual(item["status"], "rejected")
        self.assertIn("returned", item["timeline"][-1]["label"])
