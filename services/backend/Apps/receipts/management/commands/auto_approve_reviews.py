"""Approve receipts left in manual review past their 7-day deadline.

Run by cron (see infrastructure/ansible/.../nibblai.cron.j2):
    python manage.py auto_approve_reviews
"""

from django.core.management.base import BaseCommand

from Apps.receipts import services


class Command(BaseCommand):
    help = "Auto-approve manual-review receipts whose 7-day deadline has passed."

    def handle(self, *args, **options):
        result = services.auto_approve_overdue()
        self.stdout.write(self.style.SUCCESS(
            f"Auto-approved {result['approved']}, rejected {result['rejected']} "
            f"(duplicates), skipped {result['skipped']}."
        ))
