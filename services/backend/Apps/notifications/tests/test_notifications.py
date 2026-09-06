import datetime as dt
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.notifications import services
from Apps.notifications.models import (
    Notification,
    NotificationTemplate,
    NotificationType,
)
from Apps.products.services import create_product
from Apps.reservations.models import Reservation
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def _user(email="c@example.com"):
    return User.objects.create_user(email=email, password="x", full_name="U")


class NotifyTests(APITestCase):
    def test_notify_renders_template_and_marks_sent(self):
        user = _user()
        n = services.notify(
            user=user,
            notification_type=NotificationType.RECEIPT_REMINDER,
            context={"brand": "Acme"},
        )
        self.assertEqual(n.status, Notification.Status.SENT)
        self.assertEqual(n.title, "Upload your receipt")
        self.assertIn("Acme", n.body)
        self.assertIsNotNone(n.sent_at)

    def test_each_type_uses_its_template(self):
        user = _user()
        n = services.notify(
            user=user,
            notification_type=NotificationType.REVIEW_REMINDER,
            context={"product": "Cola", "amount": "1.00"},
        )
        self.assertEqual(n.title, "Finish your review")
        self.assertIn("Cola", n.body)
        self.assertIn("1.00", n.body)

    def test_preference_opt_out_suppresses(self):
        user = _user()
        pref = services.get_preference(user)
        pref.receipt_reminders = False
        pref.save()
        n = services.notify(
            user=user, notification_type=NotificationType.RECEIPT_REMINDER,
            context={"brand": "Acme"},
        )
        self.assertEqual(n.status, Notification.Status.SUPPRESSED)
        self.assertIsNone(n.sent_at)

    def test_master_toggle_suppresses_all(self):
        user = _user()
        pref = services.get_preference(user)
        pref.push_enabled = False
        pref.save()
        n = services.notify(
            user=user, notification_type=NotificationType.NEW_OFFERS, context={"brand": "Acme"}
        )
        self.assertEqual(n.status, Notification.Status.SUPPRESSED)


class ReceiptReminderTests(APITestCase):
    def _stale_reservation(self):
        owner = _user("owner@example.com")
        brand = Brand.objects.create(name="Acme", slug="acme")
        BrandMembership.objects.create(brand=brand, user=owner, role=BrandMembership.Role.OWNER)
        product = create_product(brand=brand, name="Cola")
        campaign = campaign_services.create_campaign(
            brand=brand, product_ids=[product.id], name="Deal", daily_budget=Decimal("100.00")
        )
        campaign_services.set_tiers(campaign, [{"reward_amount": "5.00", "allocation_percent": "100.00"}])
        wallet = wallet_services.get_or_create_brand_wallet(brand)
        wallet_services.credit(wallet=wallet, amount=Decimal("100.00"), category=LedgerEntry.Category.FUNDING)
        campaign_services.activate_campaign(campaign)

        user = _user("buyer@example.com")
        from Apps.reservations import services as reservation_services
        reservation = reservation_services.create_reservation(user=user, campaign_id=campaign.id)
        # Backdate so it counts as stale.
        Reservation.objects.filter(id=reservation.id).update(
            created_at=timezone.now() - dt.timedelta(hours=48)
        )
        return user, reservation

    def test_stale_reservation_without_receipt_triggers_reminder(self):
        user, reservation = self._stale_reservation()
        sent = services.generate_receipt_reminders()
        self.assertEqual(sent, 1)
        self.assertTrue(
            Notification.objects.filter(
                user=user, type=NotificationType.RECEIPT_REMINDER
            ).exists()
        )

    def test_reminder_is_deduped(self):
        user, reservation = self._stale_reservation()
        services.generate_receipt_reminders()
        again = services.generate_receipt_reminders()
        self.assertEqual(again, 0)
        self.assertEqual(
            Notification.objects.filter(type=NotificationType.RECEIPT_REMINDER).count(), 1
        )

    def test_fresh_reservation_not_reminded(self):
        # Create one but don't backdate.
        owner = _user("owner@example.com")
        brand = Brand.objects.create(name="Acme", slug="acme")
        BrandMembership.objects.create(brand=brand, user=owner, role=BrandMembership.Role.OWNER)
        product = create_product(brand=brand, name="Cola")
        campaign = campaign_services.create_campaign(
            brand=brand, product_ids=[product.id], name="Deal", daily_budget=Decimal("100.00")
        )
        campaign_services.set_tiers(campaign, [{"reward_amount": "5.00", "allocation_percent": "100.00"}])
        wallet = wallet_services.get_or_create_brand_wallet(brand)
        wallet_services.credit(wallet=wallet, amount=Decimal("100.00"), category=LedgerEntry.Category.FUNDING)
        campaign_services.activate_campaign(campaign)
        from Apps.reservations import services as reservation_services
        reservation_services.create_reservation(user=_user("b@example.com"), campaign_id=campaign.id)

        self.assertEqual(services.generate_receipt_reminders(), 0)


class InactivityTests(APITestCase):
    def test_inactive_user_reminded_active_user_not(self):
        inactive = _user("old@example.com")
        User.objects.filter(id=inactive.id).update(
            last_login=timezone.now() - dt.timedelta(days=30)
        )
        active = _user("new@example.com")
        User.objects.filter(id=active.id).update(last_login=timezone.now())

        sent = services.generate_inactivity_reminders()
        self.assertEqual(sent, 1)
        self.assertTrue(
            Notification.objects.filter(user=inactive, type=NotificationType.INACTIVE).exists()
        )
        self.assertFalse(
            Notification.objects.filter(user=active, type=NotificationType.INACTIVE).exists()
        )


class ApiTests(APITestCase):
    def test_register_device_and_preferences_and_history(self):
        user = _user()
        self.client.force_authenticate(user)

        reg = self.client.post(
            reverse("v1:notifications:device-list"),
            {"token": "abc123", "platform": "ios"},
            format="json",
        )
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED)
        # Re-register same token upserts (no duplicate).
        self.client.post(
            reverse("v1:notifications:device-list"),
            {"token": "abc123", "platform": "ios"},
            format="json",
        )
        self.assertEqual(user.device_tokens.count(), 1)

        prefs = self.client.patch(
            reverse("v1:notifications:preferences"),
            {"promotional": False},
            format="json",
        )
        self.assertEqual(prefs.status_code, status.HTTP_200_OK)
        self.assertFalse(prefs.data["promotional"])

        services.notify(
            user=user, notification_type=NotificationType.NEW_OFFERS, context={"brand": "Acme"}
        )
        history = self.client.get(reverse("v1:notifications:notification-list"))
        self.assertEqual(len(history.data), 1)

        nid = history.data[0]["id"]
        self.client.post(reverse("v1:notifications:notification-read", args=[nid]))
        unread = self.client.get(reverse("v1:notifications:notification-list"), {"unread": "1"})
        self.assertEqual(len(unread.data), 0)


class TemplateSeedTests(APITestCase):
    def test_all_templates_seeded(self):
        self.assertEqual(NotificationTemplate.objects.count(), 6)
