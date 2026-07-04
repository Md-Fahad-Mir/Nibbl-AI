"""Backfill Brand entities for brand-role users who were approved without one.

Usage:
    python manage.py provision_brands          # dry run (shows what would happen)
    python manage.py provision_brands --apply  # actually create the records
"""

from django.core.management.base import BaseCommand

from Apps.accounts.models import User
from Apps.brands.models import BrandMembership
from Apps.brands.services import ensure_brand_for_user


class Command(BaseCommand):
    help = "Create Brand + BrandMembership for approved brand users who lack one."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually create the records (default is dry run).",
        )

    def handle(self, *args, **options):
        apply = options["apply"]

        orphan_users = (
            User.objects.filter(
                role=User.Role.BRAND,
                is_approved=True,
                is_deleted=False,
            )
            .exclude(
                id__in=BrandMembership.objects.filter(is_active=True).values("user_id")
            )
        )

        count = orphan_users.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS("No brand users without a Brand entity found."))
            return

        self.stdout.write(f"Found {count} brand user(s) without a Brand entity:")
        for user in orphan_users:
            self.stdout.write(f"  • {user.email} ({user.id})")
            if apply:
                brand = ensure_brand_for_user(user)
                if brand:
                    self.stdout.write(
                        self.style.SUCCESS(f"    → Created Brand '{brand.name}' ({brand.id})")
                    )

        if not apply:
            self.stdout.write(
                self.style.WARNING("\nDry run — re-run with --apply to create the records.")
            )
        else:
            self.stdout.write(self.style.SUCCESS(f"\nDone. Provisioned brands for {count} user(s)."))
