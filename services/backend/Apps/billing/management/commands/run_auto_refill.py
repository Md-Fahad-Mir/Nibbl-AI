"""Charge saved cards to top up low brand wallets.

Run manually or via cron until Celery Beat is introduced (~M12):
    python manage.py run_auto_refill
"""

from django.core.management.base import BaseCommand

from Apps.billing import services


class Command(BaseCommand):
    help = "Auto-refill brand wallets that have dropped below their threshold."

    def handle(self, *args, **options):
        summary = services.run_auto_refill()
        self.stdout.write(
            self.style.SUCCESS(
                "Auto-refill processed — "
                f"charged: {summary['charged']}, "
                f"skipped: {summary['skipped']}, "
                f"failed: {summary['failed']}"
            )
        )
