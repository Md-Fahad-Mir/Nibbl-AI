import tempfile
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandApplication, BrandMembership


class PlanCatalogTests(APITestCase):
    def test_plans_are_seeded_and_listable(self):
        # Seed migration should have created the three tiers.
        self.assertEqual(Plan.objects.count(), 3)
        resp = self.client.get(reverse("v1:billing:plan-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        slugs = {p["slug"] for p in resp.data["results"]}
        self.assertEqual(slugs, {"starter", "pro", "scale"})


class ApplicationFlowTests(APITestCase):
    def setUp(self):
        self.applicant = User.objects.create_user(
            email="founder@example.com", password="x", full_name="Founder"
        )
        self.admin = User.objects.create_user(
            email="admin@example.com", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_staff=True,
        )

    def _submit(self):
        self.client.force_authenticate(self.applicant)
        return self.client.post(
            reverse("v1:brands:application-list"),
            {"brand_name": "Acme Foods", "contact_email": "ops@acme.com"},
            format="json",
        )

    def test_submit_application(self):
        resp = self._submit()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BrandApplication.objects.count(), 1)

    def test_cannot_submit_two_pending_applications(self):
        self._submit()
        resp = self._submit()
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_approval_creates_brand_owner_membership_and_promotes_user(self):
        self._submit()
        application = BrandApplication.objects.get()

        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            reverse("v1:brands:admin-application-approve", args=[application.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        brand = Brand.objects.get()
        self.assertEqual(brand.name, "Acme Foods")
        self.assertEqual(brand.plan.slug, "starter")  # default plan
        membership = BrandMembership.objects.get(brand=brand, user=self.applicant)
        self.assertEqual(membership.role, BrandMembership.Role.OWNER)

        self.applicant.refresh_from_db()
        self.assertEqual(self.applicant.role, User.Role.BRAND)

        application.refresh_from_db()
        self.assertEqual(application.status, BrandApplication.Status.APPROVED)

    def test_double_approval_is_rejected(self):
        self._submit()
        application = BrandApplication.objects.get()
        self.client.force_authenticate(self.admin)
        url = reverse("v1:brands:admin-application-approve", args=[application.id])
        self.client.post(url)
        resp = self.client.post(url)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reject_application(self):
        self._submit()
        application = BrandApplication.objects.get()
        self.client.force_authenticate(self.admin)
        resp = self.client.post(
            reverse("v1:brands:admin-application-reject", args=[application.id]),
            {"reason": "Incomplete details"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        application.refresh_from_db()
        self.assertEqual(application.status, BrandApplication.Status.REJECTED)
        self.assertEqual(application.decision_reason, "Incomplete details")

    def test_non_admin_cannot_approve(self):
        self._submit()
        application = BrandApplication.objects.get()
        other = User.objects.create_user(
            email="rando@example.com", password="x", full_name="Rando"
        )
        self.client.force_authenticate(other)
        resp = self.client.post(
            reverse("v1:brands:admin-application-approve", args=[application.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class BrandAccessTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner"
        )
        self.outsider = User.objects.create_user(
            email="out@example.com", password="x", full_name="Outsider"
        )
        starter = Plan.objects.get(slug="starter")
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=starter)
        BrandMembership.objects.create(
            brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER
        )

    def test_member_can_view_brand(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.get(
            reverse("v1:brands:brand-detail", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["name"], "Acme")

    def test_non_member_is_blocked(self):
        self.client.force_authenticate(self.outsider)
        resp = self.client.get(
            reverse("v1:brands:brand-detail", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(MEDIA_ROOT=tempfile.mkdtemp())
    def test_manager_can_update_brand_with_logo_upload(self):
        buf = BytesIO()
        Image.new("RGB", (1, 1)).save(buf, format="PNG")
        logo = SimpleUploadedFile("logo.png", buf.getvalue(), content_type="image/png")

        self.client.force_authenticate(self.owner)
        resp = self.client.patch(
            reverse("v1:brands:brand-detail", args=[self.brand.id]),
            {
                "legal_name": "Acme Legal",
                "description": "Snacks brand",
                "website": "https://acme.example.com",
                "contact_email": "support@acme.example.com",
                "logo": logo,
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["legal_name"], "Acme Legal")
        # logo -> relative media path; logo_url -> absolute URL of the same file.
        self.assertTrue(resp.data["logo"].startswith("/"))
        self.assertIn("brand_logos/", resp.data["logo"])
        self.assertTrue(resp.data["logo_url"].startswith("http"))
        self.assertIn("brand_logos/", resp.data["logo_url"])

    def test_brand_without_logo_keeps_stored_logo_url(self):
        # A brand that never uploads a logo keeps its existing logo_url value,
        # so the shipped response is unchanged for existing brands.
        self.brand.logo_url = "https://cdn.example.com/existing.png"
        self.brand.save(update_fields=["logo_url"])
        self.client.force_authenticate(self.owner)
        resp = self.client.get(
            reverse("v1:brands:brand-detail", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp.data["logo"])
        self.assertEqual(resp.data["logo_url"], "https://cdn.example.com/existing.png")

    def test_my_brands_only_lists_own(self):
        self.client.force_authenticate(self.outsider)
        resp = self.client.get(reverse("v1:brands:brand-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 0)

    def test_owner_can_add_and_remove_member(self):
        teammate = User.objects.create_user(
            email="team@example.com", password="x", full_name="Team"
        )
        self.client.force_authenticate(self.owner)
        resp = self.client.post(
            reverse("v1:brands:member-list", args=[self.brand.id]),
            {"email": "team@example.com", "role": "member"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        membership = BrandMembership.objects.get(brand=self.brand, user=teammate)

        resp = self.client.delete(
            reverse("v1:brands:member-delete", args=[self.brand.id, membership.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_suspended_brand_blocks_writes_for_members(self):
        admin = User.objects.create_user(
            email="admin@example.com", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_staff=True,
        )
        self.client.force_authenticate(admin)
        resp = self.client.post(
            reverse("v1:brands:admin-brand-suspend", args=[self.brand.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Member can still read, but cannot modify a suspended brand.
        self.client.force_authenticate(self.owner)
        read = self.client.get(reverse("v1:brands:brand-detail", args=[self.brand.id]))
        self.assertEqual(read.status_code, status.HTTP_200_OK)

        write = self.client.patch(
            reverse("v1:brands:brand-detail", args=[self.brand.id]),
            {"description": "new"},
            format="json",
        )
        self.assertEqual(write.status_code, status.HTTP_403_FORBIDDEN)
