from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.content.models import FAQ, LegalDocument, NewsletterSubscription


def _admin():
    return User.objects.create_user(
        email="admin@example.com", password="x", full_name="Admin",
        role=User.Role.ADMIN, is_staff=True,
    )


class NewsletterTests(APITestCase):
    def test_public_subscribe(self):
        resp = self.client.post(
            reverse("v1:content:newsletter-subscribe"),
            {"email": "a@example.com", "source": "homepage_footer"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["email"], "a@example.com")
        self.assertEqual(resp.data["source"], "homepage_footer")
        self.assertEqual(resp.data["status"], "subscribed")
        self.assertEqual(NewsletterSubscription.objects.count(), 1)

    def test_resubscribe_is_idempotent(self):
        url = reverse("v1:content:newsletter-subscribe")
        self.client.post(url, {"email": "a@example.com"}, format="json")
        resp = self.client.post(
            url, {"email": "a@example.com", "source": "x"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(NewsletterSubscription.objects.count(), 1)


class FAQTests(APITestCase):
    def test_public_list_shows_only_active_ordered(self):
        FAQ.objects.create(question="Q2", answer="A2", sort_order=2, is_active=True)
        FAQ.objects.create(question="Q1", answer="A1", sort_order=1, is_active=True)
        FAQ.objects.create(question="Hidden", answer="H", sort_order=3, is_active=False)
        resp = self.client.get(reverse("v1:content:faq-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual([f["question"] for f in resp.data], ["Q1", "Q2"])

    def test_admin_crud(self):
        self.client.force_authenticate(_admin())
        resp = self.client.post(
            reverse("v1:content:admin-faq-list"),
            {"question": "Q", "answer": "A", "sort_order": 1},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        faq_id = resp.data["id"]

        resp = self.client.patch(
            reverse("v1:content:admin-faq-detail", args=[faq_id]),
            {"answer": "A2", "is_active": False}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["answer"], "A2")

        resp = self.client.delete(
            reverse("v1:content:admin-faq-detail", args=[faq_id])
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(FAQ.objects.count(), 0)

    def test_admin_requires_platform_admin(self):
        consumer = User.objects.create_user(
            email="c@example.com", password="x", full_name="C"
        )
        self.client.force_authenticate(consumer)
        resp = self.client.get(reverse("v1:content:admin-faq-list"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class LegalTests(APITestCase):
    def test_public_get_autocreates_default(self):
        resp = self.client.get(reverse("v1:content:legal-terms"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["title"], "Terms & Conditions")
        self.assertEqual(set(resp.data), {"title", "content", "updated_at"})

    def test_admin_patch_updates_content(self):
        self.client.force_authenticate(_admin())
        resp = self.client.patch(
            reverse("v1:content:admin-legal-privacy"),
            {"content": "<p>New policy</p>"}, format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["content"], "<p>New policy</p>")
        self.assertEqual(
            LegalDocument.objects.get(slug="privacy-policy").content,
            "<p>New policy</p>",
        )
