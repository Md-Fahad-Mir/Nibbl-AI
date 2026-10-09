"""Discovery (Master: Discovery Entry, Geographic Eligibility, Ranking).

Order of operations — never changed by ranking:
  1. Location: the shopper's ZIP (entered, or device position → nearest ZIP).
  2. Geography gate: Nationwide / Selected States / ZIP + radius. No match →
     not shown in discovery. (Direct URL / QR entry bypasses this only.)
  3. Campaign-level availability: a campaign the shopper has an active claim
     on, or is in cooldown for, is hidden — only that campaign, never the
     whole brand.
  4. Ranking: Base CVR × Store Match × Brand Interest (admin-configurable).
"""

from __future__ import annotations

import datetime as dt
import math
from dataclasses import dataclass
from decimal import Decimal

from django.utils import timezone

from Apps.common.text import normalize_text

RADIUS_CHOICES = (5, 10, 25, 50, 100)
EARTH_MILES = 3958.8
INTEREST_DAYS = 30


class LocationError(Exception):
    """A ZIP / position Nibbl can't place."""


@dataclass(frozen=True)
class Location:
    zip: str
    state: str
    lat: float
    lng: float


def miles_between(lat1, lng1, lat2, lng2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_MILES * math.asin(math.sqrt(a))


def from_zip(zip_code: str) -> Location:
    from Apps.offers.models import ZipCode

    row = ZipCode.objects.filter(zip=str(zip_code or "").strip()[:5]).first()
    if row is None:
        raise LocationError("Enter a valid US ZIP code.")
    return Location(row.zip, row.state, row.lat, row.lng)


def from_position(lat: float, lng: float) -> Location:
    """Nearest ZIP centroid to a device position (US only)."""
    from Apps.offers.models import ZipCode

    for box in (0.3, 1.0, 3.0):
        rows = ZipCode.objects.filter(
            lat__range=(lat - box, lat + box), lng__range=(lng - box, lng + box)
        )
        best = min(rows, key=lambda r: miles_between(lat, lng, r.lat, r.lng), default=None)
        if best is not None:
            return Location(best.zip, best.state, best.lat, best.lng)
    raise LocationError("We couldn't find a US ZIP code near your location. Enter your ZIP instead.")


def saved_location(user) -> Location | None:
    if not (user and user.is_authenticated):
        return None
    saved = getattr(user, "discovery_location", None)
    return Location(saved.zip, saved.state, saved.lat, saved.lng) if saved else None


def save_location(user, *, zip_code=None, lat=None, lng=None):
    from Apps.offers.models import ShopperLocation

    if zip_code:
        location, source = from_zip(zip_code), ShopperLocation.Source.ZIP
    elif lat is not None and lng is not None:
        location, source = from_position(float(lat), float(lng)), ShopperLocation.Source.DEVICE
    else:
        raise LocationError("Allow location or enter your ZIP code.")
    ShopperLocation.objects.update_or_create(
        user=user,
        defaults={"zip": location.zip, "state": location.state, "lat": location.lat,
                  "lng": location.lng, "source": source},
    )
    return location


# ---------------------------------------------------------------------------
# Geography gate
# ---------------------------------------------------------------------------
def in_geography(campaign, location: Location, _zips=None) -> bool:
    from Apps.campaigns.models import Campaign
    from Apps.offers.models import ZipCode

    kind = campaign.geography
    if kind == Campaign.Geography.NATIONWIDE:
        return True
    if kind == Campaign.Geography.STATES:
        return location.state in {s.upper() for s in campaign.geography_states or []}
    for area in campaign.geography_areas or []:
        center = (_zips or {}).get(area.get("zip")) or ZipCode.objects.filter(zip=area.get("zip")).first()
        if center and miles_between(location.lat, location.lng, center.lat, center.lng) <= float(
            area.get("radius_miles", 0)
        ):
            return True
    return False


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------
def _settings():
    from Apps.common.models import get_platform_settings

    return get_platform_settings()


def rank(campaigns: list, user, now=None) -> list:
    """Order eligible campaigns by Base CVR × Store Match × Brand Interest."""
    from Apps.offers.models import OfferView
    from Apps.rebates.models import Redemption
    from Apps.receipts.models import Receipt
    from Apps.reservations.models import Reservation

    if not campaigns:
        return []
    cfg = _settings()
    now = now or timezone.now()
    since = now - dt.timedelta(days=INTEREST_DAYS)
    ids = [c.id for c in campaigns]

    views, redemptions = {}, {}
    for cid in OfferView.objects.filter(campaign_id__in=ids, created_at__gte=since).exclude(
        source=OfferView.Source.PREVIEW
    ).values_list("campaign_id", flat=True):
        views[cid] = views.get(cid, 0) + 1
    for cid in Redemption.objects.filter(campaign_id__in=ids, created_at__gte=since).values_list(
        "campaign_id", flat=True
    ):
        redemptions[cid] = redemptions.get(cid, 0) + 1

    shopper_merchants, interested_brands = [], set()
    if user and user.is_authenticated:
        shopper_merchants = [
            normalize_text(m) for m in Receipt.objects.filter(
                user=user, status=Receipt.Status.VERIFIED
            ).exclude(merchant="").values_list("merchant", flat=True).distinct()
        ]
        interested_brands.update(
            OfferView.objects.filter(user=user, created_at__gte=since).values_list("campaign__brand_id", flat=True)
        )
        interested_brands.update(
            Reservation.objects.filter(user=user, created_at__gte=since).values_list("campaign__brand_id", flat=True)
        )
        interested_brands.update(
            Receipt.objects.filter(user=user, status=Receipt.Status.VERIFIED, created_at__gte=since)
            .values_list("brand_id", flat=True)
        )

    prior_views = cfg.ranking_prior_views
    prior_redemptions = cfg.ranking_prior_redemptions
    store_boost = float(cfg.store_match_multiplier)
    interest_boost = float(cfg.brand_interest_multiplier)

    def score(campaign) -> float:
        base = (redemptions.get(campaign.id, 0) + prior_redemptions) / max(
            views.get(campaign.id, 0) + prior_views, 1
        )
        retailers = [normalize_text(n) for n in campaign.retailers.values_list("name", flat=True)]
        store = store_boost if any(
            r and m and (r in m or m in r) for r in retailers for m in shopper_merchants
        ) else 1.0
        interest = interest_boost if campaign.brand_id in interested_brands else 1.0
        return base * store * interest

    return sorted(campaigns, key=lambda c: (-score(c), -c.created_at.timestamp()))


def discover(queryset, user, location: Location) -> list:
    """Eligible (geography + campaign-level availability) and ranked."""
    from Apps.offers.models import ZipCode
    from Apps.offers.services import is_in_cooldown
    from Apps.reservations.models import Reservation

    campaigns = list(queryset)
    area_zips = {a.get("zip") for c in campaigns for a in (c.geography_areas or [])}
    zips = {z.zip: z for z in ZipCode.objects.filter(zip__in=area_zips)}
    eligible = [c for c in campaigns if c.is_live and in_geography(c, location, zips)]

    if user and user.is_authenticated:
        claimed = set(
            Reservation.objects.filter(
                user=user, status=Reservation.Status.ACTIVE, campaign__in=eligible
            ).values_list("campaign_id", flat=True)
        )
        # Campaign-level only: another campaign from the same brand stays.
        eligible = [c for c in eligible if c.id not in claimed and not is_in_cooldown(user, c)]
    return rank(eligible, user)


def going_fast_fraction() -> Decimal:
    return Decimal(_settings().going_fast_percent) / Decimal(100)
