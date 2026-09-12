"""Read-side queries for redemptions."""

from Apps.rebates.models import Redemption


def redemptions_for_user(user):
    return Redemption.objects.filter(user=user).select_related("campaign", "brand")


def get_user_redemption(user, redemption_id) -> Redemption | None:
    return (
        Redemption.objects.filter(user=user, id=redemption_id)
        .select_related("campaign", "brand")
        .first()
    )


def redemptions_for_brand(brand):
    return Redemption.objects.filter(brand=brand).select_related("campaign", "user")


def get_brand_redemption(brand, redemption_id) -> Redemption | None:
    return (
        Redemption.objects.filter(brand=brand, id=redemption_id)
        .select_related("campaign", "user", "receipt")
        .first()
    )
