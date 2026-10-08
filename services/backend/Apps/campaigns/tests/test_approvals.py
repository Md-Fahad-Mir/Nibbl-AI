"""Nibbl campaign approval workflow: submit → review → approve / reject /
request changes; revisions of approved campaigns keep the live version."""

import importlib
import tempfile
from decimal import Decimal

from django.apps import apps
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import approvals
from Apps.campaigns import services as campaign_services
from Apps.campaigns.models import Campaign, CampaignReview
from Apps.common.models import AuditLog
from Apps.notifications.models import Notification, NotificationType
from Apps.products.services import create_product
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry

RS = Campaign.ReviewStatus


class _ApprovalBase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin@nibbl.ai", password="x", full_name="Admin",
            role=User.Role.ADMIN, is_staff=True,
        )
        self.owner = User.objects.create_user(email="owner@x.com", password="x", full_name="O")
        self.brand = Brand.objects.create(name="Acme", slug="acme")
        BrandMembership.objects.create(
            brand=self.brand, user=self.owner, role=BrandMembership.Role.OWNER
        )
        self.product = create_product(brand=self.brand, name="Cola 12oz")
        self.campaign = campaign_services.create_campaign(
            brand=self.brand, product_ids=[self.product.id], name="Deal",
            deal_type=Campaign.DealType.FREE, max_rebate=Decimal("5.00"),
            desired_redemptions=10, estimated_redemption_rate=Decimal("50"),
        )

    # -- helpers --------------------------------------------------------------
    def _fund(self, amount="1000.00"):
        wallet_services.credit(
            wallet=wallet_services.get_or_create_brand_wallet(self.brand),
            amount=Decimal(amount), category=LedgerEntry.Category.FUNDING,
        )

    def _brand_url(self, name):
        return reverse(f"v1:campaigns:{name}", args=[self.brand.id, self.campaign.id])

    def _submit(self):
        self.client.force_authenticate(self.owner)
        return self.client.post(self._brand_url("campaign-submit"))

    def _decide(self, review, action, comment=""):
        self.client.force_authenticate(self.admin)
        return self.client.post(
            reverse("v1:admin_panel:campaign-approval-decision", args=[review.id, action]),
            {"comment": comment}, format="json",
        )

    def _live(self):
        self._fund()
        self._submit()
        approvals.approve(CampaignReview.objects.get(), admin=self.admin)
        self.campaign.refresh_from_db()



class ApprovalWorkflowTests(_ApprovalBase):
    # -- new campaigns ----------------------------------------------------------
    def test_draft_cannot_go_live_without_approval(self):
        self._fund()
        self.client.force_authenticate(self.owner)
        resp = self.client.post(self._brand_url("campaign-activate"))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("approve", resp.data["detail"])

    def test_submit_approve_goes_live_with_audit_and_notification(self):
        self._fund()
        resp = self._submit()
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["review_status"], RS.PENDING_REVIEW)

        # Locked while Nibbl reviews it.
        resp = self.client.patch(self._brand_url("campaign-detail"), {"name": "X"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.admin)
        queue = self.client.get(reverse("v1:admin_panel:campaign-approvals") + "?kind=new")
        self.assertEqual(len(queue.data), 1)
        self.assertEqual(queue.data[0]["brand_name"], "Acme")

        review = CampaignReview.objects.get()
        resp = self._decide(review, "approve")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["detail"], "Approved and now live.")

        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.review_status, RS.APPROVED)
        self.assertEqual(self.campaign.status, Campaign.Status.ACTIVE)
        self.assertTrue(AuditLog.objects.filter(
            action=AuditLog.Action.APPROVE, target_id=str(self.campaign.id)
        ).exists())
        self.assertTrue(Notification.objects.filter(
            user=self.owner, type=NotificationType.CAMPAIGN_REVIEW
        ).exists())

    def test_approved_but_unfunded_stays_draft(self):
        self._submit()
        note = approvals.approve(CampaignReview.objects.get(), admin=self.admin)
        self.assertIn("Not live yet", note)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.review_status, RS.APPROVED)
        self.assertEqual(self.campaign.status, Campaign.Status.DRAFT)

    def test_changes_requested_then_edit_and_resubmit(self):
        self._submit()
        review = CampaignReview.objects.get()
        # A comment is required.
        self.assertEqual(self._decide(review, "request-changes").status_code, 400)
        resp = self._decide(review, "request-changes", "Lower the max rebate.")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.review_status, RS.CHANGES_REQUESTED)

        self.client.force_authenticate(self.owner)
        history = self.client.get(self._brand_url("campaign-reviews")).data
        self.assertEqual(history[0]["comment"], "Lower the max rebate.")
        detail = self.client.get(self._brand_url("campaign-detail")).data
        self.assertEqual(detail["review_comment"], "Lower the max rebate.")

        resp = self.client.patch(
            self._brand_url("campaign-detail"), {"max_rebate": "3.00"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["max_rebate"], "3.00")
        resubmitted = self._submit().data
        self.assertEqual(resubmitted["review_status"], RS.PENDING_REVIEW)
        self.assertEqual(resubmitted["review_comment"], "")  # no longer applies
        review.refresh_from_db()
        self.assertEqual(review.status, CampaignReview.Status.PENDING)
        self.assertEqual(CampaignReview.objects.count(), 1)

    def test_rejected_campaign_cannot_be_resubmitted(self):
        self._submit()
        self._decide(CampaignReview.objects.get(), "reject", "Not a fit.")
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.review_status, RS.REJECTED)
        self.assertEqual(self._submit().status_code, status.HTTP_400_BAD_REQUEST)

    def test_incomplete_campaign_cannot_be_submitted(self):
        Campaign.objects.filter(pk=self.campaign.pk).update(claim_capacity=None)
        self.assertEqual(self._submit().status_code, status.HTTP_400_BAD_REQUEST)

    def test_queue_is_admin_only(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.get(reverse("v1:admin_panel:campaign-approvals"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    # -- revisions ---------------------------------------------------------------
    def test_revision_keeps_live_version_until_approved(self):
        self._live()
        self.client.force_authenticate(self.owner)
        resp = self.client.patch(
            self._brand_url("campaign-detail"), {"max_rebate": "8.00"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Live terms unchanged; the edit waits as a revision.
        self.assertEqual(resp.data["max_rebate"], "5.00")
        self.assertEqual(resp.data["pending_revision"]["changes"], {"max_rebate": "8.00"})
        self.assertEqual(resp.data["status"], Campaign.Status.ACTIVE)

        # A second edit merges into the same open revision.
        self.client.patch(self._brand_url("campaign-detail"), {"name": "Deal v2"}, format="json")
        revision = CampaignReview.objects.get(kind=CampaignReview.Kind.REVISION)
        self.assertEqual(revision.changes, {"max_rebate": "8.00", "name": "Deal v2"})

        self.client.force_authenticate(self.admin)
        queue = self.client.get(reverse("v1:admin_panel:campaign-approvals") + "?kind=revision")
        self.assertEqual([r["id"] for r in queue.data], [str(revision.id)])

        self._decide(revision, "approve")
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.max_rebate, Decimal("8.00"))
        self.assertEqual(self.campaign.name, "Deal v2")
        self.assertEqual(self.campaign.status, Campaign.Status.ACTIVE)

    def test_resending_unchanged_values_creates_no_revision(self):
        self._live()
        campaign_services.update_campaign(
            self.campaign, name="Deal", max_rebate=Decimal("5.00"),
            product=[self.product.id], start_at=None,
        )
        self.assertFalse(CampaignReview.objects.filter(kind=CampaignReview.Kind.REVISION).exists())
        # Only the field that actually changed is proposed.
        campaign_services.update_campaign(
            self.campaign, name="Deal", max_rebate=Decimal("6.00"), product=[self.product.id]
        )
        revision = CampaignReview.objects.get(kind=CampaignReview.Kind.REVISION)
        self.assertEqual(revision.changes, {"max_rebate": "6.00"})

    def test_rejected_revision_is_discarded(self):
        self._live()
        campaign_services.update_campaign(self.campaign, max_rebate=Decimal("8.00"))
        revision = CampaignReview.objects.get(kind=CampaignReview.Kind.REVISION)
        self._decide(revision, "reject", "Too high.")
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.max_rebate, Decimal("5.00"))
        self.assertEqual(self.campaign.review_status, RS.APPROVED)
        self.client.force_authenticate(self.owner)
        self.assertIsNone(self.client.get(self._brand_url("campaign-detail")).data["pending_revision"])

    def test_invalid_revision_is_refused_up_front(self):
        self._live()
        with self.assertRaises(campaign_services.CampaignError):
            campaign_services.update_campaign(
                self.campaign, deal_type=Campaign.DealType.BUY_X_GET_Y
            )  # no fixed reward
        self.assertFalse(CampaignReview.objects.filter(kind=CampaignReview.Kind.REVISION).exists())
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.deal_type, Campaign.DealType.FREE)

    def test_pause_does_not_need_review(self):
        self._live()
        campaign_services.pause_campaign(self.campaign)
        go = campaign_services.activate_campaign(self.campaign)
        self.assertEqual(go.status, Campaign.Status.ACTIVE)


class GrandfatherMigrationTests(APITestCase):
    def test_running_campaigns_become_approved_drafts_do_not(self):
        brand = Brand.objects.create(name="Acme", slug="acme")
        live = Campaign.objects.create(brand=brand, name="Live", status=Campaign.Status.ACTIVE)
        paused = Campaign.objects.create(brand=brand, name="P", status=Campaign.Status.PAUSED)
        draft = Campaign.objects.create(brand=brand, name="D")
        migration = importlib.import_module(
            "Apps.campaigns.migrations.0007_grandfather_existing_campaigns_approved"
        )
        migration.forwards(apps, None)
        for campaign, expected in ((live, RS.APPROVED), (paused, RS.APPROVED), (draft, RS.NOT_SUBMITTED)):
            campaign.refresh_from_db()
            self.assertEqual(campaign.review_status, expected)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class BuilderPhase3Tests(_ApprovalBase):
    """Campaign image, category rule, dates, brand-facing status."""

    def _png(self):
        import io

        from django.core.files.uploadedfile import SimpleUploadedFile
        from PIL import Image

        buf = io.BytesIO()
        Image.new("RGB", (2, 2)).save(buf, "PNG")
        return SimpleUploadedFile("c.png", buf.getvalue(), content_type="image/png")

    def test_image_upload_direct_on_draft(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.put(
            self._brand_url("campaign-image"), {"image": self._png()}, format="multipart"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["image_url"].startswith("http"))

    def test_image_change_on_live_campaign_is_a_revision(self):
        self._live()
        self.client.force_authenticate(self.owner)
        resp = self.client.put(
            self._brand_url("campaign-image"), {"image": self._png()}, format="multipart"
        )
        self.assertIsNone(resp.data["image_url"])  # live image unchanged
        self.assertIn("image", resp.data["pending_revision"]["changes"])
        self.client.force_authenticate(self.admin)
        queue = self.client.get(reverse("v1:admin_panel:campaign-approvals"))
        self.assertIn("campaign_images/", queue.data[0]["proposed_image_url"])
        revision = CampaignReview.objects.get(kind=CampaignReview.Kind.REVISION)
        approvals.approve(revision, admin=self.admin)
        self.campaign.refresh_from_db()
        self.assertTrue(self.campaign.image.name.startswith("campaign_images/"))

    def test_products_from_different_categories_block_submission(self):
        snack = create_product(brand=self.brand, name="Chips", category="Snacks")
        self.product.category = "Drinks"
        self.product.save()
        self.campaign.products.add(snack)
        resp = self._submit()
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("same category", resp.data["detail"])

    def test_scheduled_campaign_is_not_claimable_until_start(self):
        import datetime as dt

        from django.utils import timezone

        from Apps.reservations import services as reservation_services

        start = timezone.now() + dt.timedelta(days=2)
        Campaign.objects.filter(pk=self.campaign.pk).update(start_at=start)
        self.campaign.refresh_from_db()
        self._live()
        self.assertEqual(self.campaign.display_status, "scheduled")
        self.assertEqual(self.campaign.activated_at, start)  # cycles start at the start date
        shopper = User.objects.create_user(email="s@x.com", password="x", full_name="S")
        with self.assertRaises(reservation_services.ReservationError):
            reservation_services.create_reservation(user=shopper, campaign_id=self.campaign.id)

    def test_display_status_follows_review_and_lifecycle(self):
        self.assertEqual(self.campaign.display_status, "draft")
        self._submit()
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.display_status, "pending_review")
        approvals.approve(CampaignReview.objects.get(), admin=self.admin)  # unfunded
        self.campaign.refresh_from_db()
        self.assertEqual(self.campaign.display_status, "approved")

    def test_receipt_eligibility_is_editable(self):
        self.client.force_authenticate(self.owner)
        resp = self.client.patch(
            self._brand_url("campaign-detail"), {"allowed_merchants": "Target, Kroger"}, format="json"
        )
        self.assertEqual(resp.data["allowed_merchants"], "Target, Kroger")
