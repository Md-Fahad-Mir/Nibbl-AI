"""Publish 1–3★ reviews whose 7-day brand response period ended, and expire
unfinished review opportunities (releasing their reserved $1 + fee).

Run by cron: python manage.py process_reviews
"""

from django.core.management.base import BaseCommand

from Apps.reviews import campaigns


class Command(BaseCommand):
    help = "Release held reviews and expire review opportunities."

    def handle(self, *args, **options):
        released = campaigns.release_held()
        expired = campaigns.expire_sessions()
        self.stdout.write(self.style.SUCCESS(f"Published {released} held review(s); expired {expired} opportunity(ies)."))
