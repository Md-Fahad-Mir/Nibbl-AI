"""Concurrent-claim safety. Row locking only exists on Postgres, so this is
skipped on SQLite and runs on the developer's / CI Postgres."""

import threading
from decimal import Decimal
from unittest import skipUnless

from django.db import connection
from django.test import TransactionTestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.products.services import create_product
from Apps.reservations import services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


@skipUnless(connection.vendor == "postgresql", "Row locking requires PostgreSQL.")
class ConcurrentClaimTests(TransactionTestCase):
    def test_concurrent_claims_respect_daily_budget(self):
        owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner"
        )
        brand = Brand.objects.create(name="Acme", slug="acme")
        BrandMembership.objects.create(
            brand=brand, user=owner, role=BrandMembership.Role.OWNER
        )
        product = create_product(brand=brand, name="Cola")
        # daily budget == one reward: only one claim may succeed.
        campaign = campaign_services.create_campaign(
            brand=brand, product_ids=[product.id], name="Deal",
            daily_budget=Decimal("5.00"),
        )
        campaign_services.set_tiers(
            campaign, [{"reward_amount": "5.00", "allocation_percent": "100.00"}]
        )
        wallet = wallet_services.get_or_create_brand_wallet(brand)
        wallet_services.credit(
            wallet=wallet, amount=Decimal("1000.00"),
            category=LedgerEntry.Category.FUNDING,
        )
        campaign_services.activate_campaign(campaign)

        users = [
            User.objects.create_user(email=f"u{i}@example.com", password="x", full_name="U")
            for i in range(2)
        ]
        results = []

        def claim(user):
            try:
                services.create_reservation(user=user, campaign_id=campaign.id)
                results.append("ok")
            except services.ReservationError:
                results.append("rejected")
            finally:
                connection.close()

        threads = [threading.Thread(target=claim, args=(u,)) for u in users]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(results.count("ok"), 1)
        self.assertEqual(results.count("rejected"), 1)
        self.assertEqual(
            Reservation.objects.filter(status=Reservation.Status.ACTIVE).count(), 1
        )
