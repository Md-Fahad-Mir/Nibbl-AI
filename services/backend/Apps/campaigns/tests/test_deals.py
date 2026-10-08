"""Deal model end to end: builder inputs, 25-hour Claim Capacity, rule
snapshots, reserve-max / pay-actual, cooldown at redemption, and the
conversion of old tier campaigns."""

import datetime as dt
import importlib
from decimal import Decimal

from django.apps import apps
from django.db.models import F
from django.test import TestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand
from Apps.campaigns import deals
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.testing import RECEIPT_META
from Apps.offers.models import CooldownRecord
from Apps.products.services import create_product
from Apps.rebates.models import Redemption
from Apps.receipts import services as receipt_services
from Apps.receipts.models import Receipt
from Apps.reservations import services as reservation_services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry
from Apps.common.testing import go_live


def _deal_campaign(**deal):
    brand = Brand.objects.create(name="Acme", slug="acme")
    product = create_product(brand=brand, name="Cola 12oz")
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal("1000.00"), category=LedgerEntry.Category.FUNDING
    )
    deal.setdefault("deal_type", Campaign.DealType.FREE)
    deal.setdefault("max_rebate", Decimal("5.00"))
    deal.setdefault("desired_redemptions", 10)
    deal.setdefault("estimated_redemption_rate", Decimal("30"))
    campaign = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Deal", **deal
    )
    go_live(campaign)
    return campaign, wallet


def _user(email):
    return User.objects.create_user(email=email, password="x", full_name="U")


def _upload(user, reservation, prices):
    items = [{"description": "Cola 12oz", "quantity": 1, "unit_price": p} for p in prices]
    return receipt_services.upload_receipt(
        user=user, reservation_id=reservation.id, **RECEIPT_META, items=items
    )


class BuilderTests(TestCase):
    def test_capacity_and_suggested_wording(self):
        campaign, _ = _deal_campaign()
        # 10 desired ÷ 30% = 33.3 → 34 claims per 25-hour cycle.
        self.assertEqual(campaign.claim_capacity, 34)
        self.assertEqual(campaign.offer_headline, "Free Cola 12oz up to $5")
        self.assertIsNotNone(campaign.activated_at)

    def test_buy_x_get_y_requires_fixed_reward(self):
        with self.assertRaises(campaign_services.CampaignError):
            _deal_campaign(deal_type=Campaign.DealType.BUY_X_GET_Y, max_rebate=None)


class CapacityTests(TestCase):
    def test_capacity_blocks_then_resets_after_25_hours(self):
        campaign, _ = _deal_campaign(desired_redemptions=2, estimated_redemption_rate=Decimal("100"))
        reservation_services.create_reservation(user=_user("a@x.com"), campaign_id=campaign.id)
        reservation_services.create_reservation(user=_user("b@x.com"), campaign_id=campaign.id)
        with self.assertRaisesMessage(reservation_services.ReservationError, "temporarily unavailable"):
            reservation_services.create_reservation(user=_user("c@x.com"), campaign_id=campaign.id)

        # 25 hours later (shift the anchor and the claims back one cycle):
        # a new cycle starts and the capacity is available again.
        Campaign.objects.filter(id=campaign.id).update(
            activated_at=campaign.activated_at - deals.CYCLE
        )
        Reservation.objects.update(created_at=F("created_at") - deals.CYCLE)
        reservation_services.create_reservation(user=_user("d@x.com"), campaign_id=campaign.id)


class RedemptionTests(TestCase):
    def test_reserves_max_pays_actual_and_returns_the_rest(self):
        campaign, wallet = _deal_campaign(
            deal_type=Campaign.DealType.BOGO_HALF, max_rebate=Decimal("5.00")
        )
        user = _user("a@x.com")
        reservation = reservation_services.create_reservation(user=user, campaign_id=campaign.id)
        self.assertEqual(reservation.reward_amount, Decimal("5.00"))
        self.assertEqual(wallet.held_amount(), Decimal("5.00"))

        receipt = _upload(user, reservation, ["6.00", "4.00"])
        self.assertEqual(receipt.status, Receipt.Status.VERIFIED)
        redemption = Redemption.objects.get()
        # 50% of the lower-priced unit ($4) = $2, under the $5 cap.
        self.assertEqual(redemption.reward_amount, Decimal("2.00"))
        wallet.refresh_from_db()
        self.assertEqual(wallet.held_amount(), Decimal("0.00"))
        self.assertEqual(
            wallet.balance, Decimal("1000.00") - Decimal("2.00") - redemption.fee_amount
        )
        # Cooldown begins at the approved redemption.
        self.assertTrue(CooldownRecord.objects.filter(user=user, campaign=campaign).exists())

    def test_unclear_price_goes_to_review_not_auto_paid(self):
        campaign, _ = _deal_campaign()
        user = _user("a@x.com")
        reservation = reservation_services.create_reservation(user=user, campaign_id=campaign.id)
        receipt = receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id, **RECEIPT_META,
            items=[{"description": "Cola 12oz", "quantity": 1}],
        )
        self.assertEqual(receipt.status, Receipt.Status.PENDING)
        self.assertFalse(Redemption.objects.exists())

    def test_claim_keeps_its_terms_after_the_campaign_changes(self):
        campaign, _ = _deal_campaign(max_rebate=Decimal("5.00"))
        user = _user("a@x.com")
        reservation = reservation_services.create_reservation(user=user, campaign_id=campaign.id)
        # An approved revision lowers the cap after the claim was made.
        campaign_services.apply_update(campaign, max_rebate=Decimal("1.00"))

        _upload(user, reservation, ["4.00"])
        # Snapshot cap $5 applies, not the edited $1.
        self.assertEqual(Redemption.objects.get().reward_amount, Decimal("4.00"))

    def test_zero_day_cooldown_records_nothing(self):
        campaign, _ = _deal_campaign(cooldown_days=0)
        user = _user("a@x.com")
        reservation = reservation_services.create_reservation(user=user, campaign_id=campaign.id)
        _upload(user, reservation, ["4.00"])
        self.assertTrue(Redemption.objects.exists())
        self.assertFalse(CooldownRecord.objects.exists())


class ConversionMigrationTests(TestCase):
    def test_tier_campaign_is_converted(self):
        brand = Brand.objects.create(name="Acme", slug="acme")
        product = create_product(brand=brand, name="Cola 12oz")
        campaign = Campaign.objects.create(
            brand=brand, name="Old", daily_budget=Decimal("100.00"), status=Campaign.Status.ACTIVE
        )
        campaign.products.set([product])
        campaign.tiers.create(reward_amount=Decimal("3.00"), allocation_percent=Decimal("60"))
        campaign.tiers.create(reward_amount=Decimal("8.00"), allocation_percent=Decimal("40"))

        migration = importlib.import_module(
            "Apps.campaigns.migrations.0005_convert_campaigns_to_deal_model"
        )
        migration.forwards(apps, None)

        campaign.refresh_from_db()
        self.assertEqual(campaign.deal_type, Campaign.DealType.FREE)
        self.assertEqual(campaign.max_rebate, Decimal("8.00"))
        self.assertEqual(campaign.desired_redemptions, 12)  # 100 // 8
        self.assertEqual(campaign.claim_capacity, 12)
        self.assertEqual(campaign.offer_headline, "Free Cola 12oz up to $8")
        self.assertIsNotNone(campaign.activated_at)
        self.assertLess(campaign.activated_at - campaign.updated_at, dt.timedelta(minutes=1))
