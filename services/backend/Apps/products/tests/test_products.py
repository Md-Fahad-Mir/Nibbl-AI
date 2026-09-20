from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.products.models import Tag
from Apps.products.selectors import match_product
from Apps.products.services import add_alias, create_product


def _brand_with_owner(name, slug, owner):
    brand = Brand.objects.create(name=name, slug=slug)
    BrandMembership.objects.create(
        brand=brand, user=owner, role=BrandMembership.Role.OWNER
    )
    return brand


class ProductCrudTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner"
        )
        self.brand = _brand_with_owner("Acme", "acme", self.owner)
        self.client.force_authenticate(self.owner)

    def test_create_and_list_product(self):
        resp = self.client.post(
            reverse("v1:products:product-list", args=[self.brand.id]),
            {"name": "Cola 12oz", "category": "Beverages"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        listing = self.client.get(
            reverse("v1:products:product-list", args=[self.brand.id])
        )
        self.assertEqual(len(listing.data), 1)

    def test_duplicate_name_rejected(self):
        create_product(brand=self.brand, name="Cola")
        resp = self.client.post(
            reverse("v1:products:product-list", args=[self.brand.id]),
            {"name": "Cola"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_archive_product_excludes_from_match(self):
        active_product = create_product(brand=self.brand, name="Sprite")
        product = create_product(brand=self.brand, name="Cola")
        resp = self.client.delete(
            reverse(
                "v1:products:product-detail", args=[self.brand.id, product.id]
            )
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        product.refresh_from_db()
        self.assertFalse(product.is_active)
        self.assertIsNone(match_product(brand=self.brand, text="Cola"))
        listing = self.client.get(
            reverse("v1:products:product-list", args=[self.brand.id])
        )
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [str(item["id"]) for item in listing.data], [str(active_product.id)]
        )

    def test_non_manager_cannot_create(self):
        member = User.objects.create_user(
            email="m@example.com", password="x", full_name="M"
        )
        BrandMembership.objects.create(
            brand=self.brand, user=member, role=BrandMembership.Role.MEMBER
        )
        self.client.force_authenticate(member)
        resp = self.client.post(
            reverse("v1:products:product-list", args=[self.brand.id]),
            {"name": "Sprite"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)


class TenantIsolationTests(APITestCase):
    def test_brand_cannot_see_another_brands_products(self):
        owner_a = User.objects.create_user(
            email="a@example.com", password="x", full_name="A"
        )
        owner_b = User.objects.create_user(
            email="b@example.com", password="x", full_name="B"
        )
        brand_a = _brand_with_owner("A", "a", owner_a)
        brand_b = _brand_with_owner("B", "b", owner_b)
        create_product(brand=brand_a, name="Secret A")

        # Owner B is not a member of brand A -> blocked.
        self.client.force_authenticate(owner_b)
        resp = self.client.get(
            reverse("v1:products:product-list", args=[brand_a.id])
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

        # And B's own listing doesn't leak A's products.
        own = self.client.get(
            reverse("v1:products:product-list", args=[brand_b.id])
        )
        self.assertEqual(own.data, [])


class AliasMatchingTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner"
        )
        self.brand = _brand_with_owner("Acme", "acme", self.owner)
        self.product = create_product(brand=self.brand, name="Driscoll's Strawberries")

    def test_match_by_product_name_is_punctuation_insensitive(self):
        matched = match_product(brand=self.brand, text="DRISCOLLS STRAWBERRIES")
        self.assertEqual(matched, self.product)

    def test_match_by_alias_resolves_receipt_variant(self):
        add_alias(product=self.product, alias_text="DRISC STRWBRY 16OZ")
        matched = match_product(brand=self.brand, text="drisc strwbry 16oz")
        self.assertEqual(matched, self.product)

    def test_unknown_text_returns_none(self):
        self.assertIsNone(match_product(brand=self.brand, text="Mystery Item"))

    def test_duplicate_alias_within_brand_rejected(self):
        add_alias(product=self.product, alias_text="STRWBRY")
        other = create_product(brand=self.brand, name="Strawberry Jam")
        self.client.force_authenticate(self.owner)
        resp = self.client.post(
            reverse("v1:products:alias-list", args=[self.brand.id, other.id]),
            {"alias_text": "strwbry"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class TagGeneratorTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@example.com", password="x", full_name="Owner"
        )
        self.brand = _brand_with_owner("Acme", "acme", self.owner)
        self.p1 = create_product(brand=self.brand, name="Cola")
        self.p2 = create_product(brand=self.brand, name="Sprite")
        self.client.force_authenticate(self.owner)

    def test_generate_pulls_from_library_no_upload(self):
        resp = self.client.post(
            reverse("v1:products:tag-generate", args=[self.brand.id]),
            {},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(resp.data), 2)
        self.assertEqual(Tag.objects.filter(brand=self.brand).count(), 2)

    def test_generate_is_idempotent_per_product(self):
        self.client.post(
            reverse("v1:products:tag-generate", args=[self.brand.id]), {}, format="json"
        )
        self.client.post(
            reverse("v1:products:tag-generate", args=[self.brand.id]), {}, format="json"
        )
        self.assertEqual(Tag.objects.filter(brand=self.brand).count(), 2)
