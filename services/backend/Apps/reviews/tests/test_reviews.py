"""Tests for the AI-generated review + flat reward flow.

Question generation is never exercised here: the frontend calls the AI
service's /reviews/questions endpoint directly, so this backend only ever
receives finished (question, answer) pairs. The AI service's /reviews/generate
endpoint is stubbed at the HTTP boundary (``httpx.post``), same convention as
``Apps.receipts.tests.test_claim_to_reward``.
"""

from decimal import Decimal
from unittest.mock import Mock, patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.products.services import create_product
from Apps.reviews import services
from Apps.reviews.models import Review
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def _world(*, fund="10.00"):
    """A brand with one active product and a funded wallet."""
    owner = User.objects.create_user(
        email="owner@example.com", password="x", full_name="Owner"
    )
    brand = Brand.objects.create(name="Acme", slug="acme")
    BrandMembership.objects.create(
        brand=brand, user=owner, role=BrandMembership.Role.OWNER
    )
    product = create_product(brand=brand, name="Cola")
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal(fund), category=LedgerEntry.Category.FUNDING
    )
    return owner, brand, product, wallet


def _customer(email="c@example.com"):
    return User.objects.create_user(email=email, password="x", full_name="C")


def _ai_body(*, title="Great", body="A genuinely useful product.", rating=5,
             ai_generated=False, disclosure=""):
    return {
        "success": True,
        "data": {
            "title": title, "body": body, "rating": rating,
            "ai_generated": ai_generated, "disclosure": disclosure,
        },
    }


def ai_returning(body, status_code=200):
    """Patch the AI review-generation HTTP call to return `body`."""
    resp = Mock(status_code=status_code)
    resp.json.return_value = body
    return patch("httpx.post", return_value=resp)


ANSWERS = [("How was it?", "Refreshing and well priced."), ("Buy again?", "Yes.")]


# ---------------------------------------------------------------------------
# Valid review + reward
# ---------------------------------------------------------------------------
class ValidReviewTests(APITestCase):
    def test_valid_review_is_saved_and_rewards_the_user(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        cust_wallet = wallet_services.get_or_create_customer_wallet(user)
        self.assertEqual(cust_wallet.balance, Decimal("0.00"))

        with ai_returning(_ai_body()):
            review = services.generate_and_submit_review(
                user=user, product=product, answers=ANSWERS
            )

        self.assertEqual(review.title, "Great")
        self.assertEqual(review.content, "A genuinely useful product.")
        self.assertEqual(review.rating, 5)
        self.assertFalse(review.ai_generated)
        self.assertEqual(review.product_id, product.id)
        self.assertEqual(review.brand_id, brand.id)
        self.assertEqual(review.user_id, user.id)
        self.assertEqual(
            review.questions_and_answers,
            [{"question": q, "answer": a} for q, a in ANSWERS],
        )

        # $1 moved from the brand's wallet to the customer's.
        wallet.refresh_from_db()
        cust_wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("9.00"))
        self.assertEqual(cust_wallet.balance, Decimal("1.00"))

    def test_product_information_is_sent_to_the_ai_service(self):
        owner, brand, product, wallet = _world()
        product.category = "Beverages"
        product.description = "A cola soft drink."
        product.flavor = "Original"
        product.save(update_fields=["category", "description", "flavor"])
        user = _customer()

        captured = {}

        def fake_post(url, **kwargs):
            captured["json"] = kwargs.get("json")
            resp = Mock(status_code=200)
            resp.json.return_value = _ai_body()
            return resp

        with patch("httpx.post", side_effect=fake_post):
            services.generate_and_submit_review(user=user, product=product, answers=ANSWERS)

        payload = captured["json"]
        self.assertEqual(payload["product_name"], "Cola")
        self.assertEqual(payload["category"], "Beverages")
        self.assertEqual(payload["description"], "A cola soft drink.")
        self.assertEqual(payload["attributes"]["flavor"], "Original")
        self.assertEqual(payload["attributes"]["brand"], "Acme")
        self.assertEqual(
            payload["answers"],
            [{"question": q, "answer": a} for q, a in ANSWERS],
        )

    def test_rating_is_inferred_when_the_ai_service_omits_one(self):
        """If the caller didn't request a rating and the AI response has
        none either, the review still saves with a sane default rather than
        crashing."""
        owner, brand, product, wallet = _world()
        user = _customer()
        body = _ai_body()
        body["data"]["rating"] = None
        with ai_returning(body):
            review = services.generate_and_submit_review(
                user=user, product=product, answers=ANSWERS
            )
        self.assertIsNotNone(review.rating)


# ---------------------------------------------------------------------------
# Duplicate prevention (one review per user + product)
# ---------------------------------------------------------------------------
class DuplicateReviewTests(APITestCase):
    def test_second_review_of_the_same_product_by_the_same_user_is_rejected(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        with ai_returning(_ai_body()):
            services.generate_and_submit_review(user=user, product=product, answers=ANSWERS)

        with ai_returning(_ai_body()):
            with self.assertRaises(services.DuplicateReview):
                services.generate_and_submit_review(
                    user=user, product=product, answers=ANSWERS
                )

        self.assertEqual(Review.objects.filter(user=user, product=product).count(), 1)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("9.00"))  # charged only once

    def test_different_users_can_each_review_the_same_product(self):
        owner, brand, product, wallet = _world(fund="10.00")
        a, b = _customer("a@example.com"), _customer("b@example.com")
        with ai_returning(_ai_body()):
            services.generate_and_submit_review(user=a, product=product, answers=ANSWERS)
        with ai_returning(_ai_body()):
            services.generate_and_submit_review(user=b, product=product, answers=ANSWERS)

        self.assertEqual(Review.objects.filter(product=product).count(), 2)
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("8.00"))  # $1 paid twice

    def test_same_user_can_review_two_different_products(self):
        owner, brand, product, wallet = _world()
        other = create_product(brand=brand, name="Sprite")
        user = _customer()
        with ai_returning(_ai_body()):
            services.generate_and_submit_review(user=user, product=product, answers=ANSWERS)
        with ai_returning(_ai_body()):
            services.generate_and_submit_review(user=user, product=other, answers=ANSWERS)

        self.assertEqual(Review.objects.filter(user=user).count(), 2)

    def test_concurrent_duplicate_is_blocked_by_the_database_constraint(self):
        """The UNIQUE constraint, not just the pre-check, is what makes this
        race-safe — simulate both requests passing the existence check before
        either has inserted."""
        owner, brand, product, wallet = _world()
        user = _customer()
        with ai_returning(_ai_body()):
            services.generate_and_submit_review(user=user, product=product, answers=ANSWERS)

        with patch(
            "Apps.reviews.services.Review.objects.filter"
        ) as mock_filter:
            mock_filter.return_value.exists.return_value = False  # pretend no row yet
            with ai_returning(_ai_body()):
                with self.assertRaises(services.DuplicateReview):
                    services.generate_and_submit_review(
                        user=user, product=product, answers=ANSWERS
                    )
        self.assertEqual(Review.objects.filter(user=user, product=product).count(), 1)


# ---------------------------------------------------------------------------
# Reward idempotency
# ---------------------------------------------------------------------------
class RewardIdempotencyTests(APITestCase):
    def test_issuing_the_reward_twice_for_the_same_review_pays_only_once(self):
        """Direct test of the idempotency guarantee the spec asks for: a
        retried reward-issuance call for the same review must never pay (or
        debit) a second time."""
        owner, brand, product, wallet = _world()
        user = _customer()
        with ai_returning(_ai_body()):
            review = services.generate_and_submit_review(
                user=user, product=product, answers=ANSWERS
            )
        cust_wallet = wallet_services.get_or_create_customer_wallet(user)
        wallet.refresh_from_db()
        cust_wallet.refresh_from_db()
        after_first = (wallet.balance, cust_wallet.balance)

        # Simulate a retried request re-issuing the reward for the same review.
        services._issue_review_reward(review)

        wallet.refresh_from_db()
        cust_wallet.refresh_from_db()
        self.assertEqual((wallet.balance, cust_wallet.balance), after_first)
        self.assertEqual(
            LedgerEntry.objects.filter(
                idempotency_key=f"review-reward-credit:{review.id}"
            ).count(),
            1,
        )
        self.assertEqual(
            LedgerEntry.objects.filter(
                idempotency_key=f"review-reward-debit:{review.id}"
            ).count(),
            1,
        )


# ---------------------------------------------------------------------------
# Reward funding failure
# ---------------------------------------------------------------------------
class RewardFundingTests(APITestCase):
    def test_insufficient_brand_funds_blocks_the_review_and_the_reward(self):
        """Brand-funded, no cap: if the brand wallet can't cover the flat
        reward, the whole operation rolls back -- no orphan review, no
        partial payment."""
        owner, brand, product, wallet = _world(fund="0.50")  # less than $1
        user = _customer()
        with ai_returning(_ai_body()):
            with self.assertRaises(services.RewardUnavailable):
                services.generate_and_submit_review(
                    user=user, product=product, answers=ANSWERS
                )

        self.assertFalse(Review.objects.exists())
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("0.50"))
        cust_wallet = wallet_services.get_or_create_customer_wallet(user)
        self.assertEqual(cust_wallet.balance, Decimal("0.00"))


# ---------------------------------------------------------------------------
# AI service failures
# ---------------------------------------------------------------------------
class AIServiceFailureTests(APITestCase):
    def test_unreachable_ai_service_saves_nothing_and_pays_nothing(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        with patch("httpx.post", side_effect=OSError("connection refused")):
            with self.assertRaises(services.ReviewGenerationUnavailable):
                services.generate_and_submit_review(
                    user=user, product=product, answers=ANSWERS
                )
        self.assertFalse(Review.objects.exists())
        wallet.refresh_from_db()
        self.assertEqual(wallet.balance, Decimal("10.00"))

    def test_ai_service_error_response_saves_nothing(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        with ai_returning({"success": False, "errors": [{"message": "boom"}]}, status_code=500):
            with self.assertRaises(services.ReviewGenerationUnavailable):
                services.generate_and_submit_review(
                    user=user, product=product, answers=ANSWERS
                )
        self.assertFalse(Review.objects.exists())

    def test_no_answers_is_rejected_before_any_ai_call(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        with patch("httpx.post") as mock_post:
            with self.assertRaises(services.ReviewError):
                services.generate_and_submit_review(user=user, product=product, answers=[])
        mock_post.assert_not_called()

    def test_not_configured_raises_unavailable(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        with self.settings(REVIEW_AI_API_URL=""):
            with self.assertRaises(services.ReviewGenerationUnavailable):
                services.generate_and_submit_review(
                    user=user, product=product, answers=ANSWERS
                )
        self.assertFalse(Review.objects.exists())


# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------
class ReviewApiTests(APITestCase):
    def test_generate_endpoint_creates_and_rewards(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        self.client.force_authenticate(user)

        with ai_returning(_ai_body()):
            resp = self.client.post(
                reverse("v1:reviews:review-list"),
                {
                    "product": str(product.id),
                    "answers": [{"question": q, "answer": a} for q, a in ANSWERS],
                },
                format="json",
            )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["content"], "A genuinely useful product.")
        self.assertEqual(resp.data["rating"], 5)

        cust_wallet = wallet_services.get_or_create_customer_wallet(user)
        self.assertEqual(cust_wallet.balance, Decimal("1.00"))

    def test_generate_endpoint_requires_at_least_one_answer(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:reviews:review-list"),
            {"product": str(product.id), "answers": []},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_via_api_returns_409(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        self.client.force_authenticate(user)
        payload = {
            "product": str(product.id),
            "answers": [{"question": q, "answer": a} for q, a in ANSWERS],
        }
        with ai_returning(_ai_body()):
            self.client.post(reverse("v1:reviews:review-list"), payload, format="json")
        with ai_returning(_ai_body()):
            resp = self.client.post(reverse("v1:reviews:review-list"), payload, format="json")
        self.assertEqual(resp.status_code, status.HTTP_409_CONFLICT)

    def test_unknown_product_returns_404(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        self.client.force_authenticate(user)
        resp = self.client.post(
            reverse("v1:reviews:review-list"),
            {
                "product": "00000000-0000-0000-0000-000000000000",
                "answers": [{"question": "Q", "answer": "A"}],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_my_reviews_lists_only_the_caller_s_own(self):
        owner, brand, product, wallet = _world(fund="10.00")
        a, b = _customer("a@example.com"), _customer("b@example.com")
        with ai_returning(_ai_body()):
            services.generate_and_submit_review(user=a, product=product, answers=ANSWERS)

        self.client.force_authenticate(b)
        resp = self.client.get(reverse("v1:reviews:review-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 0)

        self.client.force_authenticate(a)
        resp = self.client.get(reverse("v1:reviews:review-list"))
        self.assertEqual(len(resp.data), 1)

    def test_product_reviews_and_summary_are_public_to_authenticated_users(self):
        owner, brand, product, wallet = _world()
        user = _customer()
        with ai_returning(_ai_body()):
            services.generate_and_submit_review(user=user, product=product, answers=ANSWERS)

        self.client.force_authenticate(user)
        reviews = self.client.get(
            reverse("v1:reviews:product-reviews", args=[product.id])
        )
        self.assertEqual(reviews.status_code, status.HTTP_200_OK)
        self.assertEqual(reviews.data["count"], 1)

        summary = self.client.get(
            reverse("v1:reviews:product-review-summary", args=[product.id])
        )
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["review_count"], 1)
        self.assertEqual(summary.data["rating"], 5.0)

    def test_public_review_serializer_never_exposes_email(self):
        from Apps.reviews.serializers import PublicReviewSerializer

        fields = set(PublicReviewSerializer().fields)
        self.assertNotIn("email", fields)
        self.assertNotIn("user_email", fields)
