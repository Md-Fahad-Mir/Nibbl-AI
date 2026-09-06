"""Cross-app tenant-isolation sweep.

Confirms that a member of one brand cannot reach another brand's resources
across every brand-scoped endpoint family. This is the consolidated guarantee
that the per-app `require_membership` checks hold platform-wide.
"""

from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.products.services import create_product


def _brand(slug):
    owner = User.objects.create_user(email=f"{slug}@example.com", password="x", full_name="O")
    brand = Brand.objects.create(name=slug.title(), slug=slug)
    BrandMembership.objects.create(brand=brand, user=owner, role=BrandMembership.Role.OWNER)
    return owner, brand


class TenantIsolationSweepTests(APITestCase):
    def setUp(self):
        self.owner_a, self.brand_a = _brand("acme")
        self.owner_b, self.brand_b = _brand("globex")
        self.product_a = create_product(brand=self.brand_a, name="A-Product")

    def _brand_scoped_get_endpoints(self):
        bid = self.brand_a.id
        return [
            reverse("v1:brands:brand-detail", args=[bid]),
            reverse("v1:brands:member-list", args=[bid]),
            reverse("v1:brands:customer-list", args=[bid]),
            reverse("v1:products:product-list", args=[bid]),
            reverse("v1:products:tag-list", args=[bid]),
            reverse("v1:campaigns:campaign-list", args=[bid]),
            reverse("v1:receipts:review-queue", args=[bid]),
            reverse("v1:rebates:brand-redemption-list", args=[bid]),
            reverse("v1:analytics:brand-overview", args=[bid]),
            reverse("v1:analytics:brand-campaigns", args=[bid]),
            reverse("v1:analytics:brand-products", args=[bid]),
        ]

    def test_outsider_is_forbidden_everywhere(self):
        # Owner B is not a member of brand A.
        self.client.force_authenticate(self.owner_b)
        for url in self._brand_scoped_get_endpoints():
            resp = self.client.get(url)
            self.assertEqual(
                resp.status_code, status.HTTP_403_FORBIDDEN,
                msg=f"{url} should be forbidden for a non-member (got {resp.status_code})",
            )

    def test_member_is_allowed_on_own_brand(self):
        self.client.force_authenticate(self.owner_a)
        for url in self._brand_scoped_get_endpoints():
            resp = self.client.get(url)
            self.assertEqual(
                resp.status_code, status.HTTP_200_OK,
                msg=f"{url} should be allowed for a member (got {resp.status_code})",
            )

    def test_wallet_isolation(self):
        self.client.force_authenticate(self.owner_b)
        resp = self.client.get(reverse("v1:wallets:brand-wallet", args=[self.brand_a.id]))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_brand_b_product_listing_excludes_brand_a(self):
        create_product(brand=self.brand_b, name="B-Product")
        self.client.force_authenticate(self.owner_b)
        resp = self.client.get(reverse("v1:products:product-list", args=[self.brand_b.id]))
        names = [p["name"] for p in resp.data]
        self.assertEqual(names, ["B-Product"])
        self.assertNotIn("A-Product", names)
