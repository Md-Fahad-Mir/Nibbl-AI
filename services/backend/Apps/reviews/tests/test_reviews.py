import datetime as dt
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.reservations import services as reservation_services
from Apps.reviews import services
from Apps.reviews.models import (
    Review,
    ReviewModeration,
    ReviewSession,
)
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry


def _brand(plan_slug="starter", fund="1000.00"):
    owner = User.objects.create_user(
        email="owner@example.com", password="x", full_name="Owner"
    )
    brand = Brand.objects.create(
        name="Acme", slug="acme", plan=Plan.objects.get(slug=plan_slug)
    )
    BrandMembership.objects.create(
        brand=brand, user=owner, role=BrandMembership.Role.OWNER
    )
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal(fund), category=LedgerEntry.Category.FUNDING
    )
    return owner, brand, wallet


def _review_campaign(brand, product, *, daily="100.00", reward="1.00", activate=True):
    campaign = services.create_review_campaign(
        brand=brand, name="Reviews", daily_budget=Decimal(daily),
        reward_amount=Decimal(reward), product_ids=[product.id],
    )
    services.generate_ai_prompts(campaign)
    if activate:
        services.activate_review_campaign(campaign)
    return campaign


def _verified_receipt(brand, owner, product, *, email="c@example.com", desc=None):
    """Run a full rebate claim → verified receipt so review opportunities fire."""
    rebate_campaign = campaign_services.create_campaign(
        brand=brand, product_id=product.id, name="Rebate", daily_budget=Decimal("100.00"),
    )
    campaign_services.set_tiers(
        rebate_campaign, [{"reward_amount": "5.00", "allocation_percent": "100.00"}]
    )
    campaign_services.activate_campaign(rebate_campaign)
    user = User.objects.create_user(email=email, password="x", full_name="U")
    reservation = reservation_services.create_reservation(
        user=user, campaign_id=rebate_campaign.id
    )
    receipt = receipt_services.upload_receipt(
        user=user, reservation_id=reservation.id,
        items=[{"description": desc or product.name, "quantity": 1}],
    )
    return user, receipt


class AiPromptTests(APITestCase):
    def test_generate_prompts_creates_prompts(self):
        owner, brand, _ = _brand()
        product = create_product(brand=brand, name="Cola")
        campaign = services.create_review_campaign(
            brand=brand, name="R", daily_budget=Decimal("50.00"), product_ids=[product.id]
        )
        prompts = services.generate_ai_prompts(campaign, count=4)
        self.assertEqual(len(prompts), 4)
        self.assertIn("Cola", prompts[0].text)

    def test_custom_prompts_are_kept_when_regenerating(self):
        owner, brand, _ = _brand()
        product = create_product(brand=brand, name="Cola")
        campaign = services.create_review_campaign(
            brand=brand, name="R", daily_budget=Decimal("50.00"), product_ids=[product.id]
        )
        services.add_custom_prompt(campaign, text="Brand custom question?")
        services.generate_ai_prompts(campaign, count=3)
        texts = [p.text for p in campaign.prompts.all()]
        self.assertIn("Brand custom question?", texts)

    def test_generate_prompts_calls_claude_when_configured(self):
        from unittest.mock import patch, MagicMock
        from Apps.reviews.ai import generate_prompts

        with patch("anthropic.Anthropic") as mock_anthropic:
            mock_client = MagicMock()
            mock_anthropic.return_value = mock_client
            mock_message = MagicMock()
            mock_message.content = [MagicMock(type="text", text="Claude prompt 1\nClaude prompt 2")]
            mock_client.messages.create.return_value = mock_message

            with self.settings(ANTHROPIC_API_KEY="test-key", ANTHROPIC_MODEL="claude-test"):
                prompts = generate_prompts(product_name="Cola", count=2)
                self.assertEqual(prompts, ["Claude prompt 1", "Claude prompt 2"])
                mock_anthropic.assert_called_once_with(api_key="test-key")

    def test_generate_prompts_calls_openai_when_configured(self):
        from unittest.mock import patch, MagicMock
        from Apps.reviews.ai import generate_prompts

        with patch("openai.OpenAI") as mock_openai:
            mock_client = MagicMock()
            mock_openai.return_value = mock_client
            mock_completion = MagicMock()
            mock_completion.choices = [MagicMock(message=MagicMock(content="OpenAI prompt 1\nOpenAI prompt 2"))]
            mock_client.chat.completions.create.return_value = mock_completion

            with self.settings(OPENAI_API_KEY="test-openai-key", OPENAI_MODEL="gpt-test"):
                prompts = generate_prompts(product_name="Cola", count=2)
                self.assertEqual(prompts, ["OpenAI prompt 1", "OpenAI prompt 2"])
                mock_openai.assert_called_once_with(api_key="test-openai-key")

    def test_generate_prompts_calls_gemini_when_configured(self):
        from unittest.mock import patch, MagicMock
        from Apps.reviews.ai import generate_prompts

        with patch("google.genai.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value = mock_client
            mock_response = MagicMock()
            mock_response.text = "Gemini prompt 1\nGemini prompt 2"
            mock_client.models.generate_content.return_value = mock_response

            with self.settings(GOOGLE_STUDIO_API_KEY="test-gemini-key", GOOGLE_MODEL="gemini-test"):
                prompts = generate_prompts(product_name="Cola", count=2)
                self.assertEqual(prompts, ["Gemini prompt 1", "Gemini prompt 2"])
                mock_client_class.assert_called_once_with(api_key="test-gemini-key")
                mock_client.models.generate_content.assert_called_once_with(
                    model="gemini-test",
                    contents=(
                        "System Instruction: You generate short, friendly, open-ended prompts for a chat-based "
                        "product review. Return exactly one prompt per line, no numbering.\n\n"
                        "Product: Cola\n"
                        "Context: n/a\n"
                        "Generate 2 prompts."
                    )
                )



class OpportunityGenerationTests(APITestCase):
    def test_verified_receipt_generates_review_opportunity_and_reserves_budget(self):
        owner, brand, wallet = _brand(plan_slug="starter")  # review_fee 0.30
        product = create_product(brand=brand, name="Cola")
        _review_campaign(brand, product, reward="1.00")

        user, receipt = _verified_receipt(brand, owner, product)

        session = ReviewSession.objects.get(user=user, product=product)
        self.assertEqual(session.status, ReviewSession.Status.ACTIVE)
        self.assertEqual(session.reward_amount, Decimal("1.00"))
        self.assertEqual(session.fee_amount, Decimal("0.30"))  # starter review fee
        # Hold reserves reward + fee (budget includes fee).
        self.assertEqual(session.hold.amount, Decimal("1.30"))

    def test_90_day_cooldown_silently_filters(self):
        owner, brand, wallet = _brand()
        product = create_product(brand=brand, name="Cola")
        campaign = _review_campaign(brand, product)
        # Pre-existing recent review for this user+product.
        user = User.objects.create_user(email="c@example.com", password="x", full_name="U")
        # Create a published review dated now (within cooldown).
        from Apps.reviews.models import Review as R
        session = ReviewSession.objects.create(
            review_campaign=campaign, product=product, user=user,
            receipt=_verified_receipt(brand, owner, product, email="seed@example.com")[1],
            reward_amount=Decimal("1.00"), fee_amount=Decimal("0.30"),
            expires_at=timezone.now() + dt.timedelta(days=7),
        )
        R.objects.create(
            review_campaign=campaign, product=product, user=user, session=session,
            rating=5, status=R.Status.PUBLISHED, published_at=timezone.now(),
        )
        # Now a fresh receipt for the same user+product should yield no opportunity.
        before = ReviewSession.objects.filter(user=user).count()
        # Build a new receipt for `user` by reusing the rebate flow manually:
        rebate = campaign_services.create_campaign(
            brand=brand, product_id=product.id, name="Rb2", daily_budget=Decimal("100.00")
        )
        campaign_services.set_tiers(rebate, [{"reward_amount": "5.00", "allocation_percent": "100.00"}])
        campaign_services.activate_campaign(rebate)
        reservation = reservation_services.create_reservation(user=user, campaign_id=rebate.id)
        receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id,
            items=[{"description": "Cola", "quantity": 1}],
        )
        after = ReviewSession.objects.filter(user=user).count()
        self.assertEqual(after, before)  # filtered out, no error

    def test_max_five_opportunities_per_receipt(self):
        owner, brand, wallet = _brand(plan_slug="scale")  # lower fee, plenty budget
        products = [create_product(brand=brand, name=f"P{i}") for i in range(6)]
        campaign = services.create_review_campaign(
            brand=brand, name="R", daily_budget=Decimal("1000.00"),
            reward_amount=Decimal("1.00"),
            product_ids=[p.id for p in products],
        )
        services.generate_ai_prompts(campaign)
        services.activate_review_campaign(campaign)

        # A rebate receipt listing all 6 products.
        rebate = campaign_services.create_campaign(
            brand=brand, product_id=products[0].id, name="Rb", daily_budget=Decimal("100.00")
        )
        campaign_services.set_tiers(rebate, [{"reward_amount": "5.00", "allocation_percent": "100.00"}])
        campaign_services.activate_campaign(rebate)
        user = User.objects.create_user(email="c@example.com", password="x", full_name="U")
        reservation = reservation_services.create_reservation(user=user, campaign_id=rebate.id)
        receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id,
            items=[{"description": p.name, "quantity": 1} for p in products],
        )
        self.assertEqual(ReviewSession.objects.filter(user=user).count(), 5)

    def test_budget_including_fee_limits_opportunities(self):
        owner, brand, wallet = _brand(plan_slug="starter")  # fee 0.30
        # daily budget exactly one reservation (1.00 + 0.30).
        p1 = create_product(brand=brand, name="P1")
        p2 = create_product(brand=brand, name="P2")
        campaign = services.create_review_campaign(
            brand=brand, name="R", daily_budget=Decimal("1.30"),
            reward_amount=Decimal("1.00"), product_ids=[p1.id, p2.id],
        )
        services.generate_ai_prompts(campaign)
        services.activate_review_campaign(campaign)

        rebate = campaign_services.create_campaign(
            brand=brand, product_id=p1.id, name="Rb", daily_budget=Decimal("100.00")
        )
        campaign_services.set_tiers(rebate, [{"reward_amount": "5.00", "allocation_percent": "100.00"}])
        campaign_services.activate_campaign(rebate)
        user = User.objects.create_user(email="c@example.com", password="x", full_name="U")
        reservation = reservation_services.create_reservation(user=user, campaign_id=rebate.id)
        receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id,
            items=[{"description": "P1", "quantity": 1}, {"description": "P2", "quantity": 1}],
        )
        # Only one fits in the daily budget (incl. fee); the other silently skipped.
        self.assertEqual(ReviewSession.objects.filter(user=user).count(), 1)


class SubmitAndModerationTests(APITestCase):
    def _session(self, reward="1.00", plan="starter"):
        owner, brand, wallet = _brand(plan_slug=plan)
        product = create_product(brand=brand, name="Cola")
        _review_campaign(brand, product, reward=reward)
        user, receipt = _verified_receipt(brand, owner, product)
        session = ReviewSession.objects.get(user=user, product=product)
        return user, brand, wallet, session

    def test_high_rating_auto_publishes_and_pays_reward(self):
        user, brand, wallet, session = self._session()
        cust = wallet_services.get_or_create_customer_wallet(user)
        before = cust.balance  # already includes the $5 rebate reward
        review = services.submit_review(session, rating=5, content="Great!")
        self.assertEqual(review.status, Review.Status.PUBLISHED)
        self.assertIsNotNone(review.published_at)
        # Reward paid regardless of rating (+$1 on top of the rebate).
        cust.refresh_from_db()
        self.assertEqual(cust.balance - before, Decimal("1.00"))
        session.refresh_from_db()
        self.assertEqual(session.status, ReviewSession.Status.COMPLETED)
        self.assertEqual(session.hold.status, Hold.Status.CAPTURED)

    def test_low_rating_is_held_but_reward_still_issued(self):
        user, brand, wallet, session = self._session()
        cust = wallet_services.get_or_create_customer_wallet(user)
        before = cust.balance
        review = services.submit_review(session, rating=1, content="Bad")
        self.assertEqual(review.status, Review.Status.HELD)
        self.assertIsNone(review.published_at)
        # Reward still paid even for a 1★ review.
        cust.refresh_from_db()
        self.assertEqual(cust.balance - before, Decimal("1.00"))
        mod = ReviewModeration.objects.get(review=review)
        self.assertIsNotNone(mod.held_until)

    def test_held_review_released_after_window(self):
        user, brand, wallet, session = self._session()
        review = services.submit_review(session, rating=2, content="Meh")
        # Force the hold window into the past.
        mod = review.moderation
        mod.held_until = timezone.now() - dt.timedelta(seconds=1)
        mod.save(update_fields=["held_until"])

        released = services.release_held_reviews()
        self.assertEqual(released, 1)
        review.refresh_from_db()
        self.assertEqual(review.status, Review.Status.PUBLISHED)

    def test_brand_can_remove_review(self):
        user, brand, wallet, session = self._session()
        review = services.submit_review(session, rating=5, content="Great")
        owner = brand.memberships.first().user
        self.client.force_authenticate(owner)
        resp = self.client.post(
            reverse("v1:reviews:brand-review-remove", args=[brand.id, review.id]),
            {"reason": "Inappropriate"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        review.refresh_from_db()
        self.assertEqual(review.status, Review.Status.REMOVED)

    def test_brand_fee_debited_on_submit(self):
        user, brand, wallet, session = self._session(plan="starter")  # fee 0.30
        wallet.refresh_from_db()
        before = wallet.balance
        services.submit_review(session, rating=5)
        wallet.refresh_from_db()
        # brand pays reward (1.00) + fee (0.30) = 1.30
        self.assertEqual(before - wallet.balance, Decimal("1.30"))


class ConsumerApiTests(APITestCase):
    def test_opportunities_and_submit_flow(self):
        owner, brand, wallet = _brand()
        product = create_product(brand=brand, name="Cola")
        _review_campaign(brand, product)
        user, receipt = _verified_receipt(brand, owner, product)

        self.client.force_authenticate(user)
        opps = self.client.get(reverse("v1:reviews:opportunities"))
        self.assertEqual(opps.status_code, status.HTTP_200_OK)
        self.assertEqual(len(opps.data), 1)
        session_id = opps.data[0]["id"]

        submit = self.client.post(
            reverse("v1:reviews:session-submit", args=[session_id]),
            {"rating": 4, "content": "Nice"},
            format="json",
        )
        self.assertEqual(submit.status_code, status.HTTP_201_CREATED)
        self.assertEqual(submit.data["status"], "published")

        history = self.client.get(reverse("v1:reviews:my-reviews"))
        self.assertEqual(len(history.data), 1)


class ReviewCampaignApiTests(APITestCase):
    def test_create_requires_products_and_prompts_to_activate(self):
        owner, brand, wallet = _brand()
        product = create_product(brand=brand, name="Cola")
        self.client.force_authenticate(owner)
        created = self.client.post(
            reverse("v1:reviews:campaign-list", args=[brand.id]),
            {"name": "R", "daily_budget": "50.00", "product_ids": [str(product.id)]},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        cid = created.data["id"]
        # No prompts yet -> activate fails.
        fail = self.client.post(
            reverse("v1:reviews:campaign-activate", args=[brand.id, cid])
        )
        self.assertEqual(fail.status_code, status.HTTP_400_BAD_REQUEST)
        # Generate prompts, then activate succeeds.
        self.client.post(reverse("v1:reviews:campaign-generate-prompts", args=[brand.id, cid]), {}, format="json")
        ok = self.client.post(reverse("v1:reviews:campaign-activate", args=[brand.id, cid]))
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertEqual(ok.data["status"], "active")
