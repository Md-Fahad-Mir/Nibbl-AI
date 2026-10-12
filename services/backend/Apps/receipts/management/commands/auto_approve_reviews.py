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
        # Master: full receipts are kept 30 days, then only the matching line.
        from django.conf import settings

        from Apps.receipts.retention import purge_expired_images

        if not settings.RECEIPT_IMAGE_PURGE_ENABLED:
            return
        purged = purge_expired_images()
        if purged:
            self.stdout.write(self.style.SUCCESS(f"Removed {purged} receipt photo(s) older than 30 days."))
