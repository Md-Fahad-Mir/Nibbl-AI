"""Receipt Brand Discovery (Master: Admin Sheet 4).

Finds brands already appearing on verified shopper receipts that aren't Nibbl
partners, as sales leads — without exposing shopper identities.

* Source: lines on **verified** receipts that did not match a partner product.
* Brand: detected from the line's product text (its leading word, e.g.
  "KETTLE SEA SALT 5OZ" → KETTLE); OCR doesn't return a brand. Admin can
  rename/merge or ignore a detected brand (``DiscoveryBrandRule``).
  Detected brands that are already Nibbl partners are excluded.
* Location: the state of the shopper's saved discovery location.
"""

from __future__ import annotations

import re
from collections import defaultdict

from Apps.analytics.models import DiscoveryBrandRule
from Apps.brands.models import Brand
from Apps.offers.models import ShopperLocation
from Apps.receipts.models import Receipt, ReceiptLineItem

WORD = re.compile(r"[A-Z][A-Z'&]+")


def brand_token(description: str) -> str:
    """Leading alphabetic word of the product text, upper-cased ('' if none)."""
    match = WORD.search((description or "").upper())
    return match.group(0).strip("'&")[:40] if match else ""


def _partner_tokens() -> set[str]:
    return {brand_token(name) for name in Brand.objects.values_list("name", flat=True)} - {""}


def _line_categories(receipt) -> dict[str, str]:
    result = getattr(receipt, "ocr_result", None)
    items = ((result.canonical_data or {}).get("items") or []) if result else []
    return {str(i.get("description") or "").strip().upper(): str(i.get("category") or "") for i in items}


def collect(*, start=None, end=None, retailer: str = "", state: str = "", category: str = "", brand: str = ""):
    """Aggregate leads keyed by brand display key."""
    lines = ReceiptLineItem.objects.filter(
        receipt__status=Receipt.Status.VERIFIED, matched_product__isnull=True,
    ).select_related("receipt", "receipt__ocr_result")
    if start:
        lines = lines.filter(receipt__created_at__gte=start)
    if end:
        lines = lines.filter(receipt__created_at__lt=end)
    if retailer:
        lines = lines.filter(receipt__merchant__icontains=retailer)

    rules = {r.token: r for r in DiscoveryBrandRule.objects.all()}
    partners = _partner_tokens()
    states = dict(ShopperLocation.objects.values_list("user_id", "state"))
    categories_cache: dict = {}

    leads: dict[str, dict] = {}
    receipts_seen, retailers_seen = set(), set()
    for line in lines:
        token = brand_token(line.description)
        if not token or token in partners:
            continue
        rule = rules.get(token)
        if rule and rule.ignored:
            continue
        name = (rule.display_name if rule and rule.display_name else token.title())
        if brand and brand.lower() not in name.lower():
            continue
        receipt = line.receipt
        shopper_state = states.get(receipt.user_id, "")
        if state and shopper_state != state.upper():
            continue
        if receipt.id not in categories_cache:
            categories_cache[receipt.id] = _line_categories(receipt)
        line_category = categories_cache[receipt.id].get(line.description.strip().upper(), "")
        if category and category.lower() not in line_category.lower():
            continue

        lead = leads.setdefault(name.lower(), {
            "brand": name, "tokens": set(), "products": defaultdict(int), "retailers": defaultdict(int),
            "states": defaultdict(int), "categories": defaultdict(int), "receipts": set(),
            "shopper_receipts": defaultdict(set),
        })
        lead["tokens"].add(token)
        lead["products"][line.description.strip()] += line.quantity or 1
        if receipt.merchant:
            lead["retailers"][receipt.merchant] += 1
            retailers_seen.add(receipt.merchant.lower())
        if shopper_state:
            lead["states"][shopper_state] += 1
        if line_category:
            lead["categories"][line_category] += 1
        lead["receipts"].add(receipt.id)
        lead["shopper_receipts"][receipt.user_id].add(receipt.id)
        receipts_seen.add(receipt.id)
    return leads, receipts_seen, retailers_seen


def _top(counter: dict, n: int = 5) -> list[str]:
    return [k for k, _v in sorted(counter.items(), key=lambda kv: -kv[1])[:n]]


def _row(lead: dict) -> dict:
    shoppers = lead["shopper_receipts"]
    return {
        "brand": lead["brand"],
        "tokens": sorted(lead["tokens"]),
        "product_texts": _top(lead["products"]),
        "retailers": _top(lead["retailers"]),
        "states": _top(lead["states"]),
        "categories": _top(lead["categories"], 3),
        "unique_shoppers": len(shoppers),
        "receipt_volume": len(lead["receipts"]),
        "repeat_purchasers": sum(1 for r in shoppers.values() if len(r) > 1),
    }


def discovery(**filters) -> dict:
    leads, receipts, retailers = collect(**filters)
    rows = sorted((_row(lead) for lead in leads.values()), key=lambda r: (-r["receipt_volume"], r["brand"]))
    return {
        "summary": {
            "unpartnered_brands": len(rows),
            "verified_receipts": len(receipts),
            "participating_retailers": len(retailers),
        },
        "leads": rows,
    }


def insight(brand_name: str, **filters) -> dict | None:
    leads, _r, _t = collect(**filters)
    lead = leads.get(brand_name.lower())
    if lead is None:
        return None
    row = _row(lead)
    where = ", ".join(row["retailers"][:3]) or "major retailers"
    states = ", ".join(row["states"][:3])
    row["outreach_message"] = (
        f"Hi {row['brand']} team — shoppers on Nibbl are already buying your products. "
        f"In the selected period we saw {row['receipt_volume']} verified receipts from "
        f"{row['unique_shoppers']} shoppers"
        + (f" ({row['repeat_purchasers']} bought more than once)" if row["repeat_purchasers"] else "")
        + f", mostly at {where}" + (f" in {states}" if states else "") + ". "
        "With a Nibbl rebate campaign you can reach these verified buyers, grow repeat purchases and collect "
        "verified reviews — you only pay for verified results. Can we set up a quick call?"
    )
    return row


def set_rule(token: str, *, display_name: str = "", ignored: bool = False) -> DiscoveryBrandRule:
    rule, _ = DiscoveryBrandRule.objects.update_or_create(
        token=token.upper()[:40], defaults={"display_name": display_name.strip()[:120], "ignored": ignored},
    )
    return rule
