"""Master Admin Withdrawals: Ready for Batch / Manual Review / Processing /
Completed / Failed, PayPal file, and idempotent results import."""

import csv
import io
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APITestCase

from Apps.accounts.models import User
from Apps.payouts import services
from Apps.payouts.models import WithdrawalRequest
from Apps.wallets import services as wallet_services
from Apps.wallets.models import Hold, LedgerEntry

S = WithdrawalRequest.Status


def _shopper(email, balance="100.00"):
    user = User.objects.create_user(email=email, password="x", full_name=email.split("@")[0].title())
    wallet = wallet_services.get_or_create_customer_wallet(user)
    wallet_services.credit(wallet=wallet, amount=Decimal(balance), category=LedgerEntry.Category.ADJUSTMENT)
    method = services.add_payout_method(user=user, provider="paypal", handle=f"{email}.pp")
    return user, wallet, method


class WithdrawalBoardTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email="admin@x.com", password="x", full_name="Admin",
                                              role=User.Role.ADMIN, is_staff=True)
        self.client.force_authenticate(self.admin)
        self.u1, self.w1_wallet, m1 = _shopper("ann@x.com")
        self.u2, self.w2_wallet, m2 = _shopper("bob@x.com")
        self.u3, _, m3 = _shopper("cy@x.com")
        self.safe1 = services.request_withdrawal(user=self.u1, payout_method_id=m1.id, amount=Decimal("10.00"))
        self.safe2 = services.request_withdrawal(user=self.u2, payout_method_id=m2.id, amount=Decimal("15.00"))
        self.flagged = services.request_withdrawal(user=self.u3, payout_method_id=m3.id, amount=Decimal("40.00"))
        self.board = reverse("v1:payouts:admin-withdrawal-board")

    def action(self, withdrawal, name, body=None):
        return self.client.post(reverse("v1:payouts:admin-withdrawal-action", args=[withdrawal.id, name]),
                                body or {}, format="json")

    def import_rows(self, rows):
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=["Reference ID", "Transaction Status", "Transaction ID", "Failure Reason"])
        writer.writeheader()
        writer.writerows(rows)
        upload = SimpleUploadedFile("results.csv", buffer.getvalue().encode(), content_type="text/csv")
        return self.client.post(reverse("v1:payouts:admin-payout-results-import"), {"file": upload}, format="multipart")

    def test_routing_tabs_and_manual_review(self):
        data = self.client.get(self.board, {"tab": "ready"}).data
        self.assertEqual(data["counts"]["ready"], 2)
        self.assertEqual(data["counts"]["review"], 1)
        self.assertEqual(data["fee_per_payout"], "0.25")
        review = self.client.get(self.board, {"tab": "review"}).data["results"][0]
        self.assertEqual(review["id"], str(self.flagged.id))
        self.assertTrue(review["flag_reason"])
        self.assertEqual(review["history"]["total"], 1)
        self.assertEqual(len(self.client.get(self.board, {"tab": "ready", "q": "ann"}).data["results"]), 1)

        self.assertEqual(self.action(self.flagged, "reject").status_code, 400)  # reason required
        self.assertEqual(self.action(self.flagged, "approve").data["status"], "approved")  # → Ready for Batch

    def test_batch_file_partial_success_and_idempotent_import(self):
        batch = services.create_batch(admin=self.admin, withdrawal_ids=[self.safe1.id, self.safe2.id])
        csv_text = self.client.get(reverse("v1:payouts:admin-batch-paypal-file", args=[batch.id])).content.decode()
        rows = list(csv.reader(io.StringIO(csv_text)))
        self.assertEqual(rows[0], services.PAYPAL_FILE_HEADER)
        self.assertEqual({r[3] for r in rows[1:]}, {str(self.safe1.id), str(self.safe2.id)})
        # Exported withdrawals can't go into a second batch.
        with self.assertRaises(services.PayoutError):
            services.create_batch(admin=self.admin, withdrawal_ids=[self.safe1.id])

        results = [
            {"Reference ID": str(self.safe1.id), "Transaction Status": "SUCCESS", "Transaction ID": "TX1"},
            {"Reference ID": str(self.safe2.id), "Transaction Status": "FAILED", "Failure Reason": "Receiver unconfirmed"},
            {"Reference ID": "not-ours", "Transaction Status": "SUCCESS"},
        ]
        summary = self.import_rows(results).data
        self.assertEqual((summary["paid"], summary["failed"], summary["unmatched"]), (1, 1, ["not-ours"]))
        payouts = lambda: self.w1_wallet.ledger_entries.filter(category=LedgerEntry.Category.PAYOUT).count()  # noqa: E731
        self.assertEqual(payouts(), 1)

        # Same file again: nothing changes.
        again = self.import_rows(results).data
        self.assertEqual((again["paid"], again["failed"], again["already_recorded"]), (0, 0, 2))
        self.assertEqual(payouts(), 1)

        self.safe1.refresh_from_db()
        self.safe2.refresh_from_db()
        self.assertEqual((self.safe1.status, self.safe1.paypal_transaction_id), (S.PAID, "TX1"))
        self.assertEqual((self.safe2.status, self.safe2.failure_permanent), (S.FAILED, False))
        self.assertEqual(self.safe2.hold.status, Hold.Status.ACTIVE)  # retryable → still reserved
        batch.refresh_from_db()
        self.assertEqual(batch.status, "completed")

        failed_tab = self.client.get(self.board, {"tab": "failed"}).data
        self.assertEqual(failed_tab["results"][0]["failure_reason"], "Receiver unconfirmed")

        # Retry → Ready for Batch again (new batch allowed after a failure).
        self.assertEqual(self.action(self.safe2, "retry").data["status"], "approved")
        services.create_batch(admin=self.admin, withdrawal_ids=[self.safe2.id])
        # Permanent failure (RETURNED) returns the money to the balance.
        self.import_rows([{"Reference ID": str(self.safe2.id), "Transaction Status": "RETURNED"}])
        self.safe2.refresh_from_db()
        self.assertEqual((self.safe2.status, self.safe2.failure_permanent), (S.FAILED, True))
        self.assertEqual(self.safe2.hold.status, Hold.Status.RELEASED)
        self.w2_wallet.refresh_from_db()
        self.assertEqual(self.w2_wallet.available(), Decimal("100.00"))

    def test_return_failed_funds_and_shopper_view(self):
        batch = services.create_batch(admin=self.admin, withdrawal_ids=[self.safe1.id])
        self.import_rows([{"Reference ID": str(self.safe1.id), "Transaction Status": "FAILED"}])
        self.client.force_authenticate(self.u1)
        item = next(i for i in self.client.get(reverse("v1:wallets:shopper-wallet-activity")).data["items"]
                    if i["type"] == "withdrawal")
        self.assertEqual(item["status"], "processing")  # retryable: still on its way

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.action(self.safe1, "return-funds").data["status"], "failed")
        self.client.force_authenticate(self.u1)
        item = next(i for i in self.client.get(reverse("v1:wallets:shopper-wallet-activity")).data["items"]
                    if i["type"] == "withdrawal")
        self.assertEqual(item["status"], "failed")
        self.w1_wallet.refresh_from_db()
        self.assertEqual(self.w1_wallet.available(), Decimal("100.00"))
        self.assertTrue(batch.withdrawals.exists())
