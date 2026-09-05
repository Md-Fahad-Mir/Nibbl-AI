"""The platform-wide single-use guarantee for a physical receipt.

Business rule under test: one physical receipt can be verified and rewarded
EXACTLY ONCE across the entire platform — across users, across claims, across
campaigns and brands, and no matter how many times it is re-submitted.

These tests deliberately assert the *global* invariants (how many Redemptions
and reward credits exist anywhere in the database) rather than just the HTTP
status of the second attempt, so a regression that silently pays twice cannot
pass by returning a tidy-looking error.
"""

from decimal import Decimal

from django.test import TransactionTestCase
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns import services as campaign_services
from Apps.products.services import create_product
from Apps.rebates.models import Redemption
from Apps.receipts import services
from Apps.receipts.models import ManualReviewItem, Receipt
from Apps.receipts.tests.test_claim_to_reward import (
    PRODUCT,
    SHOP,
    build_world,
    claim,
    image,
    ocr_returning,
    payload,
)
from Apps.reservations import services as reservation_services
from Apps.wallets import services as wallet_services
from Apps.wallets.models import LedgerEntry


def second_world(*, brand_name="Other Brand", slug="other-brand",
                 product_name=PRODUCT, owner_email="owner2@example.com"):
    """A completely separate brand + product + live campaign.

    Used to prove the block is platform-wide, not scoped to one brand or
    campaign: the same product name is registered under a *different* brand.
    """
    owner = User.objects.create_user(
        email=owner_email, password="x", full_name="Owner 2"
    )
    brand = Brand.objects.create(name=brand_name, slug=slug)
    BrandMembership.objects.create(
        brand=brand, user=owner, role=BrandMembership.Role.OWNER
    )
    product = create_product(brand=brand, name=product_name)
    campaign = campaign_services.create_campaign(
        brand=brand, product_ids=[product.id], name="Other Campaign",
        daily_budget=Decimal("100.00"), min_purchase_units=1,
    )
    campaign_services.set_tiers(
        campaign, [{"reward_amount": "3.00", "allocation_percent": "100.00"}]
    )
    wallet = wallet_services.get_or_create_brand_wallet(brand)
    wallet_services.credit(
        wallet=wallet, amount=Decimal("1000.00"),
        category=LedgerEntry.Category.FUNDING,
    )
    campaign_services.activate_campaign(campaign)
    return owner, brand, product, campaign


def reward_credits():
    """Every rebate-reward credit anywhere in the ledger."""
    return LedgerEntry.objects.filter(
        entry_type=LedgerEntry.EntryType.CREDIT,
        category=LedgerEntry.Category.REBATE_REWARD,
    )


class SingleUseAcrossThePlatformTests(APITestCase):
    """The exact scenario from the business rule: A is rewarded, then the same
    physical receipt is blocked for everyone, forever."""

    def test_receipt_is_permanently_blocked_for_every_later_submitter(self):
        _, brand, product, campaign = build_world()
        a, r_a = claim(campaign, "a@example.com")
        b, r_b = claim(campaign, "b@example.com")
        c, r_c = claim(campaign, "c@example.com")

        # Customer A: verified + rewarded.
        with ocr_returning(payload()):
            first = services.upload_receipt(user=a, reservation_id=r_a.id, image=image())
        self.assertEqual(first.status, Receipt.Status.VERIFIED)

        # Customers B and C: same physical receipt -> blocked, no reward.
        for user, reservation in ((b, r_b), (c, r_c)):
            with self.subTest(user=user.email):
                with ocr_returning(payload()):
                    with self.assertRaises(services.DuplicateReceipt):
                        services.upload_receipt(
                            user=user, reservation_id=reservation.id, image=image()
                        )

        # Exactly one reward exists anywhere on the platform.
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(reward_credits().count(), 1)
        self.assertEqual(Receipt.objects.count(), 1)
        self.assertEqual(
            wallet_services.get_or_create_customer_wallet(b).balance, Decimal("0.00")
        )
        self.assertEqual(
            wallet_services.get_or_create_customer_wallet(c).balance, Decimal("0.00")
        )

    def test_same_user_cannot_reuse_the_receipt_on_a_second_claim(self):
        """A's own second attempt is blocked too — here on a second campaign,
        since the per-campaign cooldown already prevents re-claiming the first
        one straight after being rewarded."""
        _, brand, product, campaign = build_world()
        _, brand2, product2, campaign2 = second_world()
        a, r_a = claim(campaign, "a@example.com")

        with ocr_returning(payload()):
            services.upload_receipt(user=a, reservation_id=r_a.id, image=image())

        # Same customer, brand-new claim on another campaign, same receipt.
        second_claim = reservation_services.create_reservation(
            user=a, campaign_id=campaign2.id
        )
        with ocr_returning(payload()):
            with self.assertRaises(services.DuplicateReceipt):
                services.upload_receipt(
                    user=a, reservation_id=second_claim.id, image=image()
                )

        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(reward_credits().count(), 1)

    def test_blocked_across_a_different_campaign_of_a_different_brand(self):
        """The block is platform-wide, not per-brand or per-campaign: another
        brand running a campaign on the same product cannot pay for the same
        physical receipt."""
        _, brand, product, campaign = build_world()
        _, brand2, product2, campaign2 = second_world()

        a, r_a = claim(campaign, "a@example.com")
        with ocr_returning(payload()):
            services.upload_receipt(user=a, reservation_id=r_a.id, image=image())

        d, r_d = claim(campaign2, "d@example.com")
        with ocr_returning(payload()):
            with self.assertRaises(services.DuplicateReceipt):
                services.upload_receipt(user=d, reservation_id=r_d.id, image=image())

        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(reward_credits().count(), 1)

    def test_block_survives_after_the_first_receipt_is_declined(self):
        """A receipt that reached the review queue and was declined still holds
        its identity: the same physical receipt cannot be recycled by anyone."""
        _, brand, product, campaign = build_world()
        owner = brand.memberships.first().user
        a, r_a = claim(campaign, "a@example.com")
        b, r_b = claim(campaign, "b@example.com")

        # Unreadable date -> manual review rather than auto-verify.
        with ocr_returning(payload(date=None, time=None)):
            first = services.upload_receipt(user=a, reservation_id=r_a.id, image=image())
        item = ManualReviewItem.objects.get(receipt=first)
        services.decline_review(item=item, reviewer=owner, reason="Not eligible.")

        with ocr_returning(payload(date=None, time=None)):
            with self.assertRaises(services.DuplicateReceipt):
                services.upload_receipt(user=b, reservation_id=r_b.id, image=image())

        self.assertEqual(Redemption.objects.count(), 0)
        self.assertEqual(reward_credits().count(), 0)


class SingleUseThroughManualApprovalTests(APITestCase):
    """The manual review queue must not become a second, unguarded door to a
    reward for a receipt the platform cannot uniquely identify."""

    def _unreadable_payload(self):
        """OCR succeeded but extracted nothing usable — no fingerprint can be
        built, so this receipt's identity is unknown to the platform."""
        return {
            "success": True,
            "data": {"merchant": {}, "transaction": {}, "items": [],
                     "receipt_number": None, "total": None},
            "warnings": [], "errors": [], "processing": {"request_id": "x"},
        }

    def test_unidentifiable_receipts_cannot_be_approved_into_a_reward(self):
        """Two submissions of an unreadable receipt both land in the queue with
        no fingerprint. Approving them would pay twice for what may well be the
        same physical receipt, so approval must be refused outright."""
        _, brand, product, campaign = build_world()
        owner = brand.memberships.first().user
        a, r_a = claim(campaign, "a@example.com")
        b, r_b = claim(campaign, "b@example.com")

        with ocr_returning(self._unreadable_payload()):
            first = services.upload_receipt(user=a, reservation_id=r_a.id, image=image())
        with ocr_returning(self._unreadable_payload()):
            second = services.upload_receipt(user=b, reservation_id=r_b.id, image=image())

        # Neither could be fingerprinted, so neither is protected by the
        # UNIQUE index — both exist side by side in the review queue.
        self.assertIsNone(first.full_fingerprint)
        self.assertIsNone(second.full_fingerprint)

        for receipt in (first, second):
            with self.subTest(receipt=receipt.id):
                item = ManualReviewItem.objects.get(receipt=receipt)
                with self.assertRaises(services.ReceiptError):
                    services.approve_review(item=item, reviewer=owner)

                # The refusal must roll back cleanly: the item stays OPEN so
                # the reviewer still has a way to resolve it.
                item.refresh_from_db()
                self.assertEqual(item.status, ManualReviewItem.Status.OPEN)
                receipt.refresh_from_db()
                self.assertEqual(receipt.status, Receipt.Status.PENDING)

        self.assertEqual(Redemption.objects.count(), 0)
        self.assertEqual(reward_credits().count(), 0)

    def test_a_refused_approval_can_still_be_declined_afterwards(self):
        """The reviewer is not stuck: declining an unidentifiable receipt
        still works and releases the claim's escrow hold."""
        _, brand, product, campaign = build_world()
        owner = brand.memberships.first().user
        a, r_a = claim(campaign, "a@example.com")

        with ocr_returning(self._unreadable_payload()):
            receipt = services.upload_receipt(user=a, reservation_id=r_a.id, image=image())

        item = ManualReviewItem.objects.get(receipt=receipt)
        with self.assertRaises(services.ReceiptError):
            services.approve_review(item=item, reviewer=owner)

        item.refresh_from_db()
        declined = services.decline_review(
            item=item, reviewer=owner, reason="Receipt photo unreadable."
        )
        self.assertEqual(declined.status, Receipt.Status.REJECTED)
        self.assertEqual(Redemption.objects.count(), 0)
        self.assertEqual(reward_credits().count(), 0)

    def test_identifiable_receipt_can_still_be_approved_normally(self):
        """The guard must not break the ordinary review flow: a receipt that
        *was* fingerprinted (e.g. an alias gap) still approves and pays."""
        _, brand, product, campaign = build_world()
        owner = brand.memberships.first().user
        a, r_a = claim(campaign, "a@example.com")

        unknown_item = payload(items=[
            {"description": "MYSTERY SNACK", "quantity": "1", "unit": None,
             "unit_price": "3.00", "total_price": "3.00"},
        ])
        with ocr_returning(unknown_item):
            receipt = services.upload_receipt(user=a, reservation_id=r_a.id, image=image())

        self.assertIsNotNone(receipt.full_fingerprint)
        item = ManualReviewItem.objects.get(receipt=receipt)
        approved = services.approve_review(item=item, reviewer=owner)

        self.assertEqual(approved.status, Receipt.Status.VERIFIED)
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(reward_credits().count(), 1)


class ConcurrentSingleUseTests(TransactionTestCase):
    """Two people submitting the same physical receipt at the same instant."""

    reset_sequences = True

    def test_only_one_of_two_racing_submissions_is_ever_rewarded(self):
        import threading

        from django.db import connection

        _, brand, product, campaign = build_world()
        a, r_a = claim(campaign, "a@example.com")
        b, r_b = claim(campaign, "b@example.com")

        outcomes = []
        barrier = threading.Barrier(2)

        def submit(user, reservation):
            try:
                barrier.wait(timeout=5)
                with ocr_returning(payload()):
                    services.upload_receipt(
                        user=user, reservation_id=reservation.id, image=image()
                    )
                outcomes.append("rewarded")
            except services.DuplicateReceipt:
                outcomes.append("blocked")
            except Exception as exc:  # noqa: BLE001 - surfaced by the assert
                outcomes.append(f"error:{exc}")
            finally:
                connection.close()

        threads = [
            threading.Thread(target=submit, args=(a, r_a)),
            threading.Thread(target=submit, args=(b, r_b)),
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=20)

        self.assertEqual(outcomes.count("rewarded"), 1, outcomes)
        self.assertEqual(Redemption.objects.count(), 1)
        self.assertEqual(reward_credits().count(), 1)
