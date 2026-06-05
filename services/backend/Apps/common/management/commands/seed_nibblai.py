"""
Management command to populate the database with realistic dummy data.

Usage:
    python manage.py seed_nibblai --users 10 --brands 5 --products 50 --campaigns 5
    python manage.py seed_nibblai --flush  # Clear and repopulate
"""

from decimal import Decimal
from datetime import datetime, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from Apps.accounts.models import User
from Apps.billing.models import Plan
from Apps.brands.models import Brand, BrandMembership
from Apps.campaigns.models import Campaign
from Apps.products.models import Product


class Command(BaseCommand):
    help = "Populate database with realistic dummy data for testing"

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Clear all data before populating",
        )
        parser.add_argument(
            "--users",
            type=int,
            default=10,
            help="Number of users to create",
        )
        parser.add_argument(
            "--brands",
            type=int,
            default=5,
            help="Number of brands to create",
        )
        parser.add_argument(
            "--products",
            type=int,
            default=50,
            help="Number of products to create",
        )
        parser.add_argument(
            "--campaigns",
            type=int,
            default=5,
            help="Number of campaigns to create",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("🌱 Seeding NibblAI database...\n"))

        if options["flush"]:
            self.flush_database()

        # Create plans (always needed first)
        self.create_plans()

        # Create users
        self.create_users(options["users"])

        # Create brands
        self.create_brands(options["brands"])

        # Create products
        self.create_products(options["products"])

        # Create campaigns
        self.create_campaigns(options["campaigns"])

        self.stdout.write(self.style.SUCCESS("\n✅ Seeding complete!\n"))

    def flush_database(self):
        """Clear all data"""
        self.stdout.write(self.style.WARNING("🗑️  Flushing database..."))
        User.objects.all().delete()
        Brand.objects.all().delete()
        Product.objects.all().delete()
        Campaign.objects.all().delete()
        self.stdout.write(self.style.SUCCESS("✓ Database flushed"))

    def create_plans(self):
        """Create billing plans"""
        self.stdout.write("📋 Creating plans...")

        plans_data = [
            {"slug": "starter", "name": "Starter", "price": "99.00"},
            {"slug": "pro", "name": "Pro", "price": "299.00"},
            {"slug": "scale", "name": "Scale", "price": "999.00"},
        ]

        for plan_data in plans_data:
            Plan.objects.get_or_create(
                slug=plan_data["slug"],
                defaults={
                    "name": plan_data["name"],
                    "price_per_month": plan_data["price"],
                },
            )

        self.stdout.write(self.style.SUCCESS(f"✓ Created {len(plans_data)} plans"))

    def create_users(self, count=10):
        """Create sample users"""
        self.stdout.write(f"👤 Creating {count} users...")

        # Admin user
        User.objects.get_or_create(
            email="admin@nibblai.app",
            defaults={
                "full_name": "Platform Admin",
                "is_staff": True,
                "is_superuser": True,
                "is_email_verified": True,
            },
        )

        # Regular users
        for i in range(count):
            User.objects.get_or_create(
                email=f"user{i}@example.com",
                defaults={
                    "full_name": f"User {i}",
                    "phone": f"+1555123{i:04d}",
                    "is_email_verified": True,
                    "is_phone_verified": i % 3 == 0,
                    "is_active": True,
                },
            )

        self.stdout.write(self.style.SUCCESS(f"✓ Created {count} users"))

    def create_brands(self, count=5):
        """Create sample brands"""
        self.stdout.write(f"🏢 Creating {count} brands...")

        brand_names = [
            "Acme Corp",
            "TechBrand Inc",
            "Global Goods",
            "Fashion Hub",
            "Food Court",
        ][:count]

        plans = list(Plan.objects.all())
        users = list(User.objects.filter(is_staff=False))

        for i, name in enumerate(brand_names):
            brand, created = Brand.objects.get_or_create(
                slug=name.lower().replace(" ", "-"),
                defaults={
                    "name": name,
                    "website": f"https://{name.lower().replace(' ', '')}.com",
                    "plan": plans[i % len(plans)],
                    "status": Brand.Status.ACTIVE,
                },
            )

            # Add brand owner
            if users and created:
                owner = users[i % len(users)]
                BrandMembership.objects.get_or_create(
                    brand=brand,
                    user=owner,
                    defaults={"role": BrandMembership.Role.OWNER},
                )

        self.stdout.write(self.style.SUCCESS(f"✓ Created {count} brands"))

    def create_products(self, count=50):
        """Create sample products"""
        self.stdout.write(f"📦 Creating {count} products...")

        product_names = [
            "iPhone 15", "Samsung Galaxy", "MacBook Pro",
            "Nike Shoes", "Adidas Jacket", "Gucci Bag",
            "Starbucks Coffee", "Coca-Cola", "Pizza",
            "Netflix Subscription", "Uber Ride", "AWS Hosting",
        ]

        brands = list(Brand.objects.all())
        if not brands:
            self.stdout.write(self.style.WARNING("⚠️  No brands found. Create brands first."))
            return

        for i in range(count):
            product_name = product_names[i % len(product_names)]
            if i > len(product_names):
                product_name = f"{product_name} {i // len(product_names)}"

            brand = brands[i % len(brands)]
            Product.objects.get_or_create(
                brand=brand,
                name=product_name,
                defaults={
                    "sku": f"SKU{i:04d}",
                    "category": ["Electronics", "Fashion", "Food", "Services"][i % 4],
                },
            )

        self.stdout.write(self.style.SUCCESS(f"✓ Created {count} products"))

    def create_campaigns(self, count=5):
        """Create sample campaigns"""
        self.stdout.write(f"🎯 Creating {count} campaigns...")

        brands = list(Brand.objects.all())
        if not brands:
            self.stdout.write(self.style.WARNING("⚠️  No brands found. Create brands first."))
            return

        for i in range(count):
            brand = brands[i % len(brands)]

            # Get first product for this brand
            product = brand.products.first()
            if not product:
                # Create a default product if none exists
                product, _ = Product.objects.get_or_create(
                    brand=brand,
                    name=f"Default Product {i}",
                    defaults={"sku": f"DEFAULT{i}"},
                )

            name = f"Campaign {i + 1}"
            now = timezone.now()

            Campaign.objects.get_or_create(
                brand=brand,
                product=product,
                name=name,
                defaults={
                    "description": f"Sample campaign for {brand.name}",
                    "status": [Campaign.Status.ACTIVE, Campaign.Status.PAUSED, Campaign.Status.DRAFT][i % 3],
                    "daily_budget": Decimal("100.00"),
                    "start_at": now,
                    "end_at": now + timedelta(days=90),
                },
            )

        self.stdout.write(self.style.SUCCESS(f"✓ Created {count} campaigns"))
