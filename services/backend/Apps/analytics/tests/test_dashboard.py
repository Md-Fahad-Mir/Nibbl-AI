"""Brand dashboard to the Master definitions (#1, #28)."""

import datetime as dt
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.analytics.dashboard import cycle_performance
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import deals
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.testing import RECEIPT_META, go_live, receipt_meta
from Apps.offers.models import OfferView
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.reservations import services as reservation_services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


class DashboardTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="O")
        self.brand = Brand.objects.create(name="Acme", slug="acme")
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        self.product = create_product(brand=self.brand, name="Cola 12oz", category="Drinks")
        wallet_services.credit(
            wallet=wallet_services.get_or_create_brand_wallet(self.brand),
            amount=Decimal("500"), category=LedgerEntry.Category.FUNDING,
        )
        self.campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[self.product.id], name="Deal", deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=2, estimated_redemption_rate=Decimal("50"),
        )
        go_live(self.campaign)

    def shopper(self, email):
        return User.objects.create_user(email=email, password="x", full_name="S")

    def test_snapshots_and_conversion(self):
        a, b = self.shopper("a@x.com"), self.shopper("b@x.com")
        ra = reservation_services.create_reservation(user=a, campaign_id=self.campaign.id)
        reservation_services.create_reservation(user=b, campaign_id=self.campaign.id)
        receipt_services.upload_receipt(
            user=a, reservation_id=ra.id, **RECEIPT_META,
            items=[{"description": "Cola 12oz", "quantity": 1, "unit_price": "3.00"}],
        )
        for _ in range(4):
            OfferView.objects.create(campaign=self.campaign, source=OfferView.Source.FEED)
        OfferView.objects.create(campaign=self.campaign, source=OfferView.Source.PREVIEW)  # excluded

        self.client.force_authenticate(self.owner)
        data = self.client.get(reverse("v1:analytics:brand-dashboard", args=[self.brand.id])).data
        rebates = data["rebates"]
        self.assertEqual((rebates["claims"], rebates["redemptions"], rebates["redemption_rate"]), (2, 1, 50.0))
        # Total Brand Cost = actual wallet debits: $3 reward + the plan's fee (no plan → $0).
        self.assertEqual(rebates["total_brand_cost"], "3.00")
        self.assertEqual(rebates["cost_per_redemption"], "3.00")
        self.assertEqual(data["reviews"]["invitations"], 1)  # a's verified purchase
        self.assertEqual(data["reviews"]["completed"], 0)
        self.assertIsNone(data["reviews"]["cost_per_review"])  # shown as "—"
        conv = data["conversion"]
        self.assertEqual((conv["rebate_views"], conv["view_to_claim_rate"]), (4, 50.0))
        self.assertEqual((conv["new_customers"], conv["returning_customers"]), (2, 0))
        row = data["campaigns"][0]
        self.assertEqual((row["claims"], row["redemptions"], row["performance"]["status"]), (2, 1, "building_data"))

    def _cycles(self, fills):
        """Shift activation back len(fills) cycles; fills[i] = hours to fill
        cycle i (None = never filled)."""
        anchor = timezone.now() - deals.CYCLE * len(fills) - dt.timedelta(minutes=5)
        Campaign.objects.filter(pk=self.campaign.pk).update(activated_at=anchor)
        self.campaign.refresh_from_db()
        n = getattr(self, "_n", 0)
        for i, hours in enumerate(fills):
            count = self.campaign.claim_capacity if hours is not None else 1
            for k in range(count):
                n += 1
                r = Reservation.objects.create(
                    user=self.shopper(f"c{n}@x.com"), campaign=self.campaign, offer_type="premium",
                    reward_amount=Decimal("5"), expires_at=timezone.now(), status=Reservation.Status.EXPIRED,
                )
                at = anchor + deals.CYCLE * i + dt.timedelta(hours=(hours or 1) * (k + 1) / count)
                Reservation.objects.filter(pk=r.pk).update(created_at=at)
        self._n = n

    def test_cycle_status_exhausted_early(self):
        self._cycles([6] * 7)
        perf = cycle_performance(self.campaign)
        self.assertEqual((perf["status"], perf["completed_cycles"], perf["average_fill_hours"]), ("exhausted_early", 7, 6.0))
        self.assertIn("25%", perf["recommendation"])

    def test_cycle_status_on_pace_and_behind(self):
        self._cycles([20] * 7)
        self.assertEqual(cycle_performance(self.campaign)["status"], "on_pace")
        Reservation.objects.all().delete()
        self._cycles([None] * 6 + [10])
        self.assertEqual(cycle_performance(self.campaign)["status"], "behind")
