"""Review campaigns end to end (Master #23–27)."""

import datetime as dt
from decimal import Decimal
from unittest.mock import patch

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign
from Apps.common.testing import go_live, receipt_meta
from Apps.products.services import create_product
from Apps.receipts import services as receipt_services
from Apps.reservations import services as reservation_services
from Apps.reviews import campaigns as rc
from Apps.reviews.models import Review, ReviewCampaign, ReviewSession
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry

QUESTIONS = ["Q1?", "Q2?", "Q3?", "Q4?"]
DRAFT = {"data": {"title": "Crunchy and fresh", "body": "Loved the crunch."}, "raw": {}}


def ai_mocks():
    return (
        patch("Apps.reviews.review_writer.suggest_questions", return_value=list(QUESTIONS)),
        patch("Apps.reviews.review_writer.write_review", return_value=DRAFT),
    )


class ReviewCampaignTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="o@x.com", password="x", full_name="Owner")
        self.brand = Brand.objects.create(name="Acme", slug="acme", plan=Plan.objects.get(slug="pro"))
        BrandMembership.objects.create(brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER)
        self.chips = create_product(brand=self.brand, name="Sea Salt Chips", category="Chips")
        self.wallet = wallet_services.get_or_create_brand_wallet(self.brand)
        wallet_services.credit(wallet=self.wallet, amount=Decimal("100"), category=LedgerEntry.Category.FUNDING)
        self.rebate = campaign_services.create_campaign(
            brand=self.brand, product_ids=[self.chips.id], name="Free chips", deal_type=Campaign.DealType.FREE,
            max_rebate=Decimal("5.00"), desired_redemptions=50, estimated_redemption_rate=Decimal("100"),
            cooldown_days=0,
        )
        go_live(self.rebate)
        self.review_campaign = rc.create_campaign(
            brand=self.brand, name="Chip reviews", product_ids=[self.chips.id], daily_opportunities=10,
        )
        rc.add_prompt(self.review_campaign, text="Which flavor should we make next?")
        rc.activate(self.review_campaign)
        self.n = 0

    def verified_receipt(self, user=None, quantity=1):
        self.n += 1
        user = user or User.objects.create_user(email=f"s{self.n}@x.com", password="x", full_name="Sam Shopper")
        reservation = reservation_services.create_reservation(user=user, campaign_id=self.rebate.id)
        receipt = receipt_services.upload_receipt(
            user=user, reservation_id=reservation.id, **receipt_meta(f"INV-{self.n}"),
            items=[{"description": "Sea Salt Chips", "quantity": quantity, "unit_price": "3.00"}],
        )
        return user, receipt

    def test_verified_receipt_creates_one_opportunity_with_reserve(self):
        user, receipt = self.verified_receipt(quantity=2)  # quantity never duplicates
        session = ReviewSession.objects.get()
        self.assertEqual((session.user, session.product, session.receipt), (user, self.chips, receipt))
        fee = self.brand.plan.review_fee
        self.assertEqual(session.hold.amount, Decimal("1.00") + fee)
        self.assertEqual(session.expires_at.date(), (timezone.now() + dt.timedelta(days=30)).date())
        self.client.force_authenticate(user)
        opps = self.client.get(reverse("v1:reviews:opportunities")).data
        self.assertEqual((len(opps), opps[0]["reward_amount"]), (1, "1.00"))

    def test_product_cooldown_and_daily_cap(self):
        user, _ = self.verified_receipt()
        with patch.multiple("Apps.reviews.review_writer", suggest_questions=lambda **k: QUESTIONS,
                            write_review=lambda **k: DRAFT):
            session = ReviewSession.objects.get()
            rc.start(session)
            for _ in session.questions:
                rc.answer(session, text="ok")
            rc.submit(session, rating=5)
        self.verified_receipt(user=user)  # 90-day product cooldown
        self.assertEqual(ReviewSession.objects.count(), 1)
        ReviewCampaign.objects.filter(pk=self.review_campaign.pk).update(daily_opportunities=1)
        self.verified_receipt()  # another shopper, but today's cap is used
        self.assertEqual(ReviewSession.objects.count(), 1)

    def test_conversation_publish_and_pay(self):
        user, _ = self.verified_receipt()
        session = ReviewSession.objects.get()
        self.client.force_authenticate(user)
        q_patch, w_patch = ai_mocks()
        with q_patch, w_patch:
            opened = self.client.get(reverse("v1:reviews:session-detail", args=[session.id])).data
            self.assertEqual(opened["prompts"][2], "Which flavor should we make next?")  # rotated brand question
            self.assertEqual(opened["prompts"][-1], rc.RECOMMEND_QUESTION)
            self.assertEqual(len(opened["prompts"]), 6)
            url = reverse("v1:reviews:session-answer", args=[session.id])
            for i in range(5):
                step = self.client.post(url, {"text": f"answer {i}"}, format="json").data
                self.assertFalse(step["done"])
            done = self.client.post(url, {"text": "Yes, I'd buy again"}, format="json").data
            self.assertEqual((done["done"], done["title"], done["review"]), (True, "Crunchy and fresh", "Loved the crunch."))
            again = self.client.post(reverse("v1:reviews:session-regenerate", args=[session.id])).data
            self.assertEqual(again["title"], "Crunchy and fresh")

        before = wallet_services.get_or_create_customer_wallet(user).available()
        resp = self.client.post(reverse("v1:reviews:session-submit", args=[session.id]),
                                {"rating": 5, "content": "Edited: loved it", "would_recommend": True}, format="json")
        self.assertEqual(resp.status_code, 201)
        review = Review.objects.get()
        self.assertEqual((review.status, review.content, review.would_recommend), ("published", "Edited: loved it", True))
        self.assertEqual(wallet_services.get_or_create_customer_wallet(user).available() - before, Decimal("1.00"))
        self.assertTrue(LedgerEntry.objects.filter(category=LedgerEntry.Category.REVIEW_FEE).exists())
        session.refresh_from_db()
        self.assertEqual((session.status, session.hold.status), ("completed", Hold.Status.CAPTURED))
        # Public display: name is first name + last initial; disclosure attached.
        public = self.client.get(reverse("v1:reviews:product-reviews", args=[self.chips.id])).data["results"][0]
        self.assertEqual((public["display_name"], public["verified_purchase"]), ("Sam S.", True))
        self.assertIn("$1 reward", public["disclosure"])
        summary = self.client.get(reverse("v1:reviews:product-review-summary", args=[self.chips.id])).data
        self.assertEqual((summary["review_count"], summary["star_distribution"]["5"], summary["recommendation_rate"]), (1, 1, 100.0))
        self.assertIsNone(summary["ai_summary"])  # pending the AI service endpoint

    def _low_review(self):
        user, _ = self.verified_receipt()
        session = ReviewSession.objects.get(user=user)
        with patch.multiple("Apps.reviews.review_writer", suggest_questions=lambda **k: QUESTIONS,
                            write_review=lambda **k: DRAFT):
            rc.start(session)
            for _ in session.questions:
                rc.answer(session, text="meh")
            return user, rc.submit(session, rating=2)

    def test_low_rating_held_then_published_or_flagged(self):
        user, review = self._low_review()
        self.assertEqual(review.status, "held")
        self.client.force_authenticate(user)
        self.assertEqual(self.client.get(reverse("v1:reviews:product-review-summary", args=[self.chips.id])).data["review_count"], 0)

        # Brand responds; after 7 days it publishes with the response.
        self.client.force_authenticate(self.owner)
        url = reverse("v1:reviews:brand-review-action", args=[self.brand.id, review.id, "respond"])
        self.assertEqual(self.client.post(url, {"text": "Sorry! We'll make it right."}, format="json").status_code, 200)
        listing = self.client.get(reverse("v1:reviews:brand-review-list", args=[self.brand.id])).data
        self.assertEqual(listing["summary"]["low_rating_awaiting_action"], 1)
        self.assertEqual(listing["reviews"][0]["customer_email"], user.email)
        self.assertEqual(rc.release_held(now=timezone.now() + dt.timedelta(days=8)), 1)
        review.refresh_from_db()
        self.assertEqual((review.status, review.brand_response), ("published", "Sorry! We'll make it right."))

    def test_flag_goes_to_nibbl(self):
        _user, review = self._low_review()
        self.client.force_authenticate(self.owner)
        url = reverse("v1:reviews:brand-review-action", args=[self.brand.id, review.id, "flag"])
        self.assertEqual(self.client.post(url, {"reason": "bogus"}, format="json").status_code, 400)
        self.client.post(url, {"reason": "Wrong product (does not match receipt)", "note": "Wrong item"}, format="json")
        self.assertEqual(rc.release_held(now=timezone.now() + dt.timedelta(days=8)), 0)  # flagged waits for Nibbl
        admin = User.objects.create_user(email="a@x.com", password="x", full_name="A", role=User.Role.ADMIN, is_staff=True)
        self.client.force_authenticate(admin)
        self.assertEqual(len(self.client.get(reverse("v1:reviews:admin-flagged")).data), 1)
        self.client.post(reverse("v1:reviews:admin-flag-decision", args=[review.id, "remove"]), {}, format="json")
        review.refresh_from_db()
        self.assertEqual(review.status, "removed")

    def test_expired_opportunity_releases_reserve(self):
        self.verified_receipt()
        session = ReviewSession.objects.get()
        self.assertEqual(rc.expire_sessions(now=timezone.now() + dt.timedelta(days=31)), 1)
        session.refresh_from_db()
        self.assertEqual((session.status, session.hold.status), ("expired", Hold.Status.RELEASED))

    def test_export_has_disclosure_and_helpful_once(self):
        user, review = self._low_review()
        rc.release_held(now=timezone.now() + dt.timedelta(days=8))
        self.client.force_authenticate(self.owner)
        csv_body = self.client.get(reverse("v1:reviews:brand-review-export", args=[self.brand.id])).content.decode()
        self.assertIn("Verified purchase", csv_body)
        self.client.force_authenticate(user)
        url = reverse("v1:reviews:review-helpful", args=[review.id])
        self.client.post(url)
        self.assertEqual(self.client.post(url).data["helpful_count"], 1)

    def test_review_management_filters_kpis_and_plan_identity(self):
        from Apps.offers.models import ShopperLocation
        from Apps.receipts.models import Receipt

        user, review = self._low_review()
        Receipt.objects.filter(user=user).update(merchant="Target")
        ShopperLocation.objects.create(user=user, zip="60601", state="IL", lat=41.88, lng=-87.62)
        self.client.force_authenticate(self.owner)
        url = reverse("v1:reviews:brand-review-list", args=[self.brand.id])

        data = self.client.get(url).data
        cost = Decimal("1.00") + self.brand.plan.review_fee
        summary = data["summary"]
        self.assertEqual((Decimal(summary["review_spend"]), Decimal(summary["cost_per_review"])), (cost, cost))
        self.assertEqual((summary["status_counts"]["all"], summary["status_counts"]["held"]), (1, 1))
        self.assertEqual(data["filter_options"], {"retailers": ["Target"], "regions": ["IL"]})
        row = data["reviews"][0]
        self.assertEqual((row["retailer"], row["region"], row["reviewer_display"]), ("Target", "IL", "Sam S."))
        self.assertEqual(len(row["verification"]), 6)
        self.assertEqual(row["shopper_name"], "Sam Shopper")  # Pro: full identity

        for params, expected in (({"retailer": "Walmart"}, 0), ({"retailer": "target"}, 1),
                                 ({"region": "IL"}, 1), ({"q": "chips"}, 1), ({"q": "nothing"}, 0)):
            self.assertEqual(len(self.client.get(url, params).data["reviews"]), expected, params)

        # Starter: first name + last initial; email only for 1–3★ service recovery.
        self.brand.plan = Plan.objects.get(slug="starter")
        self.brand.save()
        row = self.client.get(url).data["reviews"][0]
        self.assertEqual((row["shopper_name"], row["customer_email"]), ("Sam S.", user.email))
        Review.objects.filter(id=review.id).update(rating=5)
        self.assertEqual(self.client.get(url).data["reviews"][0]["customer_email"], "")

        doc = self.client.get(reverse("v1:reviews:brand-review-export", args=[self.brand.id]), {"type": "text"})
        body = doc.content.decode()
        self.assertTrue(doc["Content-Disposition"].endswith('.txt"'))
        self.assertIn("Verified purchase", body)
        self.assertIn("Sam S.", body)
        self.assertNotIn(user.email, body)

    def test_dashboard_lists_review_campaign_results(self):
        self._low_review()
        self.client.force_authenticate(self.owner)
        data = self.client.get(reverse("v1:analytics:brand-dashboard", args=[self.brand.id]), {"days": 7}).data
        row = next(c for c in data["campaigns"] if c["type"] == "review")
        self.assertEqual((row["id"], row["invitations"], row["completed"]), (str(self.review_campaign.id), 1, 1))
        self.assertEqual(data["period"]["days"], 7)

    def test_flag_reasons_follow_master(self):
        _user, review = self._low_review()
        self.client.force_authenticate(self.owner)
        url = reverse("v1:reviews:brand-review-action", args=[self.brand.id, review.id, "flag"])
        too_long = {"reason": "Other policy violation", "note": "x" * 501}
        self.assertEqual(self.client.post(url, too_long, format="json").status_code, 400)
        ok = self.client.post(url, {"reason": "Personal information (PII)", "note": "Phone number"}, format="json")
        self.assertEqual((ok.status_code, ok.data["flag_reason"]), (200, "Personal information (PII)"))

    def test_campaign_api_and_suggestions(self):
        self.client.force_authenticate(self.owner)
        url = reverse("v1:reviews:campaign-list", args=[self.brand.id])
        created = self.client.post(url, {"name": "New", "product_ids": [str(self.chips.id)],
                                         "daily_opportunities": 5, "product_cooldown_days": 45}, format="json")
        self.assertEqual(created.status_code, 400)  # cooldown must be 0/30/60/90
        created = self.client.post(url, {"name": "New", "product_ids": [str(self.chips.id)]}, format="json").data
        self.assertEqual((created["reward_amount"], created["product_cooldown_days"], created["status"]), ("1.00", 90, "draft"))
        with patch("Apps.reviews.review_writer.suggest_questions", return_value=["What flavor next?"]):
            sugg = self.client.post(reverse("v1:reviews:campaign-suggest-prompts", args=[self.brand.id, created["id"]]),
                                    {"count": 1}, format="json").data
        self.assertEqual(sugg["suggestions"], ["What flavor next?"])
        act = self.client.post(reverse("v1:reviews:campaign-action", args=[self.brand.id, created["id"], "activate"]))
        self.assertEqual(act.data["status"], "active")

    def test_campaign_image_upload(self):
        import io

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buffer = io.BytesIO()
        Image.new("RGB", (4, 4), "red").save(buffer, "PNG")
        self.client.force_authenticate(self.owner)
        url = reverse("v1:reviews:campaign-image", args=[self.brand.id, self.review_campaign.id])
        resp = self.client.put(url, {"image": SimpleUploadedFile("c.png", buffer.getvalue(), content_type="image/png")},
                               format="multipart")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["image_url"])
