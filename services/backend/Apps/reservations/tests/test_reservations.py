from datetime import timedelta
from decimal import Decimal

from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.offers import services as offer_services
from Apps.offers.models import CooldownRecord
from Apps.products.services import create_product
from Apps.reservations import services
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry


def _campaign(*, daily="100.00", premium="5.00", fallback=None, fallback_on=False,
              fund="1000.00", slug="acme"):
    owner = User.objects.create_user(
        email=f"{slug}@example.com", password="x", full_name="Owner"
    )
    brand = Brand.objects.create(name=slug.title(), slug=slug)
    BrandMembership.objects.create(
        brand=brand, user=owner, role=BrandMembership.Role.OWNER
    )
    product = create_product(brand=brand, name=f"{slug} Cola")
    campaign = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Deal", daily_budget=Decimal(daily),
    )
    campaign_services.set_tiers(
        campaign, [{"reward_amount": premium, "allocation_percent": "100.00"}]
    )
    if fallback is not None:
        campaign_services.set_fallback(
            campaign, reward_amount=Decimal(fallback), is_enabled=fallback_on
        )
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal(fund), category=LedgerEntry.Category.FUNDING
    )
    campaign_services.activate_campaign(campaign)
    return brand, campaign, wallet


def _user(email):
    return User.objects.create_user(email=email, password="x", full_name="U")


class ClaimTests(APITestCase):
    def test_claim_creates_reservation_hold_and_cooldown(self):
        brand, campaign, wallet = _campaign(premium="5.00")
        user = _user("c@example.com")
        self.client.force_authenticate(user)

        resp = self.client.post(
            reverse("v1:reservations:reservation-list"),
            {"campaign": str(campaign.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        reservation = Reservation.objects.get()
        self.assertEqual(reservation.status, Reservation.Status.ACTIVE)
        self.assertEqual(reservation.offer_type, Reservation.OfferType.PREMIUM)
        self.assertEqual(reservation.reward_amount, Decimal("5.00"))

        # Wallet hold placed (escrow), balance unchanged, available reduced.
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("1000.00"))
        self.assertEqual(wallet.held_amount(), Decimal("5.00"))
        self.assertEqual(Hold.objects.filter(status=Hold.Status.ACTIVE).count(), 1)

        # Cooldown starts at the approved redemption, not at the claim.
        self.assertFalse(
            CooldownRecord.objects.filter(user=user, campaign=campaign).exists()
        )

    def test_one_active_reservation_per_user_per_campaign(self):
        brand, campaign, _ = _campaign(daily="100.00", premium="5.00")
        user = _user("c@example.com")
        self.client.force_authenticate(user)
        url = reverse("v1:reservations:reservation-list")
        first = self.client.post(url, {"campaign": str(campaign.id)}, format="json")
        second = self.client.post(url, {"campaign": str(campaign.id)}, format="json")
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_brand_wallet_must_have_funds(self):
        brand, campaign, wallet = _campaign(premium="5.00", fund="1000.00")
        # Drain the wallet so no funds remain to escrow.
        wallet_services.debit(
            wallet=wallet, amount=Decimal("1000.00"),
            category=LedgerEntry.Category.ADJUSTMENT,
        )
        user = _user("c@example.com")
        with self.assertRaises(services.ReservationError):
            services.create_reservation(user=user, campaign_id=campaign.id)


@override_settings(ACTIVE_CLAIM_SLOTS=2)
class ActiveClaimSlotTests(APITestCase):
    def test_slot_cap_blocks_and_endpoint_reports_usage(self):
        _, c1, _ = _campaign(slug="slota")
        _, c2, _ = _campaign(slug="slotb")
        _, c3, _ = _campaign(slug="slotc")
        user = _user("slots@example.com")
        self.client.force_authenticate(user)

        services.create_reservation(user=user, campaign_id=c1.id)
        services.create_reservation(user=user, campaign_id=c2.id)

        # Third concurrent claim exceeds the 2-slot limit.
        with self.assertRaises(services.ReservationError):
            services.create_reservation(user=user, campaign_id=c3.id)

        resp = self.client.get(reverse("v1:reservations:claim-slots"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["used"], 2)
        self.assertEqual(resp.data["limit"], 2)
        self.assertEqual(resp.data["available"], 0)


class DailyBudgetTests(APITestCase):
    def test_expired_reservation_does_not_restore_budget(self):
        # daily budget == one reward, so only one premium claim fits per day.
        brand, campaign, wallet = _campaign(daily="5.00", premium="5.00")
        u1, u2 = _user("u1@example.com"), _user("u2@example.com")

        r1 = services.create_reservation(user=u1, campaign_id=campaign.id)

        # Force-expire it.
        r1.expires_at = timezone.now() - timedelta(seconds=1)
        r1.save(update_fields=["expires_at"])
        services.expire_due_reservations()
        r1.refresh_from_db()
        self.assertEqual(r1.status, Reservation.Status.EXPIRED)

        # Hold released -> wallet money returned to available.
        wallet.refresh_from_db()
        self.assertEqual(wallet.held_amount(), Decimal("0.00"))
        self.assertEqual(wallet.available(), Decimal("1000.00"))

        # But the day's budget is NOT restored: a new claim is rejected.
        with self.assertRaises(services.ReservationError):
            services.create_reservation(user=u2, campaign_id=campaign.id)

    def test_daily_budget_caps_number_of_claims(self):
        # daily 10 / reward 5 -> exactly 2 claims fit.
        brand, campaign, _ = _campaign(daily="10.00", premium="5.00")
        services.create_reservation(user=_user("a@example.com"), campaign_id=campaign.id)
        services.create_reservation(user=_user("b@example.com"), campaign_id=campaign.id)
        with self.assertRaises(services.ReservationError):
            services.create_reservation(
                user=_user("c@example.com"), campaign_id=campaign.id
            )


class FallbackClaimTests(APITestCase):
    def test_cooldown_user_cannot_claim_even_with_fallback(self):
        # The deal model retires the fallback offer: in cooldown = no claim.
        brand, campaign, _ = _campaign(
            daily="100.00", premium="5.00", fallback="1.00", fallback_on=True
        )
        user = _user("c@example.com")
        offer_services.enter_cooldown(user, campaign)
        with self.assertRaises(services.ReservationError):
            services.create_reservation(user=user, campaign_id=campaign.id)

    def test_cooldown_user_without_fallback_cannot_claim(self):
        brand, campaign, _ = _campaign(premium="5.00")
        user = _user("c@example.com")
        offer_services.enter_cooldown(user, campaign)
        with self.assertRaises(services.ReservationError):
            services.create_reservation(user=user, campaign_id=campaign.id)


class GlobalCapTests(APITestCase):
    @override_settings(RESERVATION_GLOBAL_CAP=1)
    def test_global_cap_enforced(self):
        _, c1, _ = _campaign(slug="acme", premium="5.00")
        _, c2, _ = _campaign(slug="globex", premium="5.00")
        services.create_reservation(user=_user("a@example.com"), campaign_id=c1.id)
        with self.assertRaises(services.ReservationError):
            services.create_reservation(user=_user("b@example.com"), campaign_id=c2.id)


class ExpiryTests(APITestCase):
    def test_expiry_window_is_seven_days(self):
        brand, campaign, _ = _campaign()
        reservation = services.create_reservation(
            user=_user("c@example.com"), campaign_id=campaign.id
        )
        delta_days = round(
            (reservation.expires_at - reservation.created_at).total_seconds() / 86400
        )
        self.assertEqual(delta_days, 7)

    def test_only_due_reservations_expire(self):
        brand, campaign, _ = _campaign(daily="100.00")
        fresh = services.create_reservation(
            user=_user("c@example.com"), campaign_id=campaign.id
        )
        expired = services.expire_due_reservations()
        self.assertEqual(expired, 0)
        fresh.refresh_from_db()
        self.assertEqual(fresh.status, Reservation.Status.ACTIVE)


class ReservationApiTests(APITestCase):
    def test_user_can_list_and_view_own_reservations(self):
        brand, campaign, _ = _campaign()
        user = _user("c@example.com")
        reservation = services.create_reservation(user=user, campaign_id=campaign.id)
        self.client.force_authenticate(user)

        listing = self.client.get(reverse("v1:reservations:reservation-list"))
        # Paginated envelope: {count, next, previous, results}
        self.assertEqual(listing.data["count"], 1)
        self.assertEqual(len(listing.data["results"]), 1)

        detail = self.client.get(
            reverse("v1:reservations:reservation-detail", args=[reservation.id])
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)

    def test_cannot_view_another_users_reservation(self):
        brand, campaign, _ = _campaign()
        owner = _user("owner2@example.com")
        reservation = services.create_reservation(user=owner, campaign_id=campaign.id)
        other = _user("other@example.com")
        self.client.force_authenticate(other)
        resp = self.client.get(
            reverse("v1:reservations:reservation-detail", args=[reservation.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class ConsentCaptureTests(APITestCase):
    def _claim(self, user, campaign, **consents):
        self.client.force_authenticate(user)
        return self.client.post(
            reverse("v1:reservations:reservation-list"),
            {"campaign": str(campaign.id), **consents},
            format="json",
        )

    def test_two_consents_are_stored_separately(self):
        from Apps.accounts.models import MarketingConsent

        brand, campaign, _ = _campaign(slug="consenta")
        user = _user("consent@example.com")
        resp = self._claim(user, campaign, consent_nibbl=True, consent_brand=False)
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        reservation = Reservation.objects.get(user=user)
        self.assertTrue(reservation.consent_nibbl_marketing)
        self.assertFalse(reservation.consent_brand_marketing)
        self.assertTrue(
            MarketingConsent.objects.filter(user=user, brand__isnull=True, opted_in=True).exists()
        )
        self.assertFalse(MarketingConsent.objects.filter(user=user, brand=brand).exists())

    def test_brand_consent_is_scoped_to_that_brand(self):
        from Apps.accounts.models import MarketingConsent

        brand, campaign, _ = _campaign(slug="consentb")
        user = _user("consent2@example.com")
        self._claim(user, campaign, consent_brand=True)
        consent = MarketingConsent.objects.get(user=user, brand=brand)
        self.assertTrue(consent.opted_in)
        self.assertIsNotNone(consent.consented_at)
        self.assertFalse(MarketingConsent.objects.filter(user=user, brand__isnull=True).exists())

    def test_consents_default_to_not_given(self):
        from Apps.accounts.models import MarketingConsent

        _, campaign, _ = _campaign(slug="consentc")
        user = _user("consent3@example.com")
        resp = self._claim(user, campaign)  # old clients send no consent fields
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(MarketingConsent.objects.filter(user=user).exists())

    def test_failed_claim_does_not_record_consent(self):
        from Apps.accounts.models import MarketingConsent

        _, campaign, wallet = _campaign(slug="consentd", premium="5.00", fund="1000.00")
        # Drain the wallet so the escrow hold fails after the consent is recorded.
        wallet_services.debit(
            wallet=wallet, amount=Decimal("1000.00"),
            category=LedgerEntry.Category.ADJUSTMENT,
        )
        user = _user("consent4@example.com")
        with self.assertRaises(services.ReservationError):
            services.create_reservation(
                user=user, campaign_id=campaign.id, consent_nibbl=True, consent_brand=True
            )
        self.assertFalse(MarketingConsent.objects.filter(user=user).exists())
