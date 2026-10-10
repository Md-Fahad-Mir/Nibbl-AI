"""Brand team notification preferences (Master: Settings §3)."""

from django.core import mail
from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.notifications.brand import notify_brand
from Apps.notifications.models import Notification


class BrandNotificationPreferenceTests(APITestCase):
    def setUp(self):
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=Plan.objects.get(slug="pro"))
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner")
        self.viewer = User.objects.create_user(email="v@x.com", password="x", full_name="Viewer")
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        BrandMembership.objects.create(brand=self.brand, user=self.viewer, role=BrandMembership.Role.MEMBER)
        self.url = reverse("v1:brands:brand-notification-preferences", args=[self.brand.id])

    def test_defaults_and_each_member_own_choices(self):
        self.client.force_authenticate(self.viewer)
        rows = self.client.get(self.url).data
        self.assertTrue(all(r["email"] and not r["sms"] for r in rows))
        self.client.put(self.url, {"preferences": [
            {"type": "campaign_review", "email": False, "sms": True},
        ]}, format="json")
        mine = {r["type"]: r for r in self.client.get(self.url).data}
        self.assertEqual((mine["campaign_review"]["email"], mine["campaign_review"]["sms"]), (False, True))
        self.client.force_authenticate(self.owner)
        owners = {r["type"]: r for r in self.client.get(self.url).data}
        self.assertTrue(owners["campaign_review"]["email"])  # unaffected

    def test_delivery_follows_preferences(self):
        self.client.force_authenticate(self.viewer)
        self.client.put(self.url, {"preferences": [{"type": "campaign_review", "email": False, "sms": False}]},
                        format="json")
        with self.captureOnCommitCallbacks(execute=True):
            notify_brand(self.brand, "campaign_review", message="Your campaign was approved.")
        self.assertEqual(Notification.objects.filter(type="campaign_review").count(), 2)  # in-app for both
        self.assertEqual([m.to for m in mail.outbox], [["o@x.com"]])  # viewer turned email off
        self.assertIn("Your campaign was approved.", mail.outbox[0].body)
