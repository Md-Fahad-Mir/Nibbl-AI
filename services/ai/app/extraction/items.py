"""Line-item extraction.

Item rows are the least standardised part of a receipt. These are all real
layouts, and all are handled here::

    Milk                    2.50      description + total
    Coffee x2               8.00      trailing quantity
    2 Coffee                8.00      leading quantity
    2 x 4.00                8.00      quantity x unit price + total
    Bread              1.50  3.00     quantity implied, unit + total
    COFFEE                            description-only, price on next line
        4.00
    Apples 1.2kg @ 3.00     3.60      weighted item

The strategy is to classify each candidate line by *how many amounts it
carries and what precedes them*, rather than by fixed column positions --
which vary between every point-of-sale system in existence.

Nothing is invented: a row with no price yields an item with
``total_price=None``, and a line that cannot be interpreted as an item is
skipped rather than forced into one.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

from app.domain.evidence import Evidence, ExtractionMethod
from app.extraction.context import PRICE_TAX_FLAG, LineView, ReceiptContext
from app.extraction.lexicon import LabelCategory
from app.normalization.money import ParsedAmount, SeparatorStyle, parse_all_amounts
from app.schemas.receipt import LineItem

#: "2 x 4.00", "2 @ 4.00", "2x4.00" -- quantity and unit price together.
_QTY_AT_PRICE = re.compile(
    r"(?<![\w.])(\d{1,4}(?:[.,]\d{1,3})?)\s*(?:X|@|\*)\s*(\d+(?:[.,]\d{1,3})?)",
    re.IGNORECASE,
)

#: A leading quantity: "2 COFFEE", "3  BREAD".
_LEADING_QTY = re.compile(r"^\s*(\d{1,3})\s+(?=[A-Za-z])")

#: The leading number is the brand, not a column quantity. Qty-column POS
#: prints these as "1 5 Hour Energy"; without that extra 1, taking 5 as the
#: quantity left the name as "Hour Energy".
_NUMBERED_PRODUCT = re.compile(
    r"^\s*\d{1,4}\s+"
    r"(?:HOUR|HRS?|UP|GUYS|MUSKETEERS|ELEVEN|WONDERS|ALIVE|STEP|"
    r"IN[\s\-]?1|FOR[\s\-]?1)\b",
    re.IGNORECASE,
)

#: A quantity marker attached to the description: "COFFEE X2", "COFFEE x 2".
#: Not anchored to end-of-line, because the line total follows it.
_MARKED_QTY = re.compile(r"(?<=[A-Za-z\s])[Xx]\s*(\d{1,3})(?![\d.,])")

#: A weighted or counted quantity with its unit: "1.2KG", "0.85 kg", "3 PCS".
_WEIGHT = re.compile(
    r"(?<![\w.])(\d+(?:[.,]\d{1,3})?)\s*(KG|G|GM|LB|OZ|L|ML|EA|PCS?|UNIT)\b",
    re.IGNORECASE,
)

#: The "@ unit-price" that follows a weight: "1.2KG @ 3.00".
_AT_PRICE = re.compile(r"@\s*(\d+(?:[.,]\d{1,3})?)")

#: A SKU / product code printed alongside the description.
_SKU = re.compile(r"(?<![\w])((?=[A-Z0-9\-]{5,20}$)[A-Z0-9]{2,}[A-Z0-9\-]*)")

#: UPC-A / EAN / Walmart item codes sitting after the name. The whole-string
#: ``_SKU`` pattern misses these because the tax flag and price follow them.
_EMBEDDED_SKU = re.compile(
    r"(?<![\d.,A-Za-z])(\d{11,14}|[0-9]{6,12}[A-Z]{1,4})(?![\dA-Za-z])",
    re.IGNORECASE,
)

#: OCR glues a 12-digit UPC to the cents price: ``0681131092874.47``.
_GLUED_UPC_PRICE = re.compile(r"(?<![\d])(\d{12})(\d[.,]\d{2})(?![\d])")

#: Walmart prints the tax letter *before* the price: ``NIGHT HAWK ... F 2.78``.
#: ``X`` is omitted — it is the qty×price operator in ``2 x 4.00``.
#: Must follow a digit (the UPC) so "Vitamin E 4.99" is not eaten.
_PRE_PRICE_TAX_FLAG = re.compile(
    r"(?<=\d)\s+([TFNE])\s+(?=\d+[.,]\d{2})",
    re.IGNORECASE,
)

#: Leftover tax letters and a stray OCR ``0`` after the price has been taken.
#: ``E`` is omitted so "Vitamin E" is not stripped as an exempt flag.
_TRAILING_TAX_NOISE = re.compile(r"(?:\s+[TFNX]|\s+0)+\s*$", re.IGNORECASE)

#: A leading product code: a long run of digits with no decimal separator, at
#: the start of the line. Target-style receipts print a 9-digit DPCI before the
#: description, and it parses as a perfectly good "amount" -- which is how a
#: 270030028 unit price on a $3.79 item comes about. Captured as the SKU and
#: removed before prices are read.
_LEADING_PRODUCT_CODE = re.compile(r"^\s*(\d{6,14})(?![\d.,])\s+(?=\S)")

#: A bare integer of at least this many digits is a product code, not a price.
_PRODUCT_CODE_MIN_DIGITS = 6

#: The unit price of a line cannot plausibly exceed its total by this factor.
#: A guard against any remaining identifier that slips through as a price.
_MAX_UNIT_PRICE_RATIO = 100

#: Per-item discount markers.
_ITEM_DISCOUNT = re.compile(r"\b(DISCOUNT|DISC|PROMO|COUPON|SAVE|OFF)\b", re.IGNORECASE)

#: Text that means the line is structural, not an item.
_NON_ITEM = re.compile(
    r"^\s*(?:ITEM|DESCRIPTION|QTY|QUANTITY|PRICE|AMOUNT|UNIT|TOTAL|NO\.?)"
    r"(?:\s+(?:ITEM|DESCRIPTION|QTY|QUANTITY|PRICE|AMOUNT|UNIT|TOTAL))*\s*$",
    re.IGNORECASE,
)

#: Register/transaction metadata. These lines are dense with long numbers, so
#: without an explicit exclusion they parse as an item with an absurd price:
#: "REG#03 TRN#7524 CSHR#1416938 STR#6855" became a 6855.00 purchase, and an
#: ExtraCare card number became a 7080.00 one.
_METADATA_LINE = re.compile(
    r"\b(?:REG\s*#|TRN\s*#|CSHR\s*#|STR\s*#|TILL\s*#|LANE\s*#|POS\s*#"
    r"|EXTRACARE|LOYALTY|MEMBER(?:SHIP)?\s*(?:#|NO|CARD)|REWARDS?\s*(?:#|CARD)"
    r"|CARD\s*#|ACCOUNT\s*#|HELPED\s+BY|SERVED\s+BY|CASHIER|OPERATOR"
    r"|TRIP\s+SUMMARY|RETURNS?\s+WITH|SAVINGS\s+VALUE|TODAY\s+YOU\s+SAVED)\b",
    re.IGNORECASE,
)

#: Coupon and manufacturer-discount rows. Real reductions, but not purchases:
#: counting them as items double-books the receipt. ``PROMO`` is the 7-Eleven
#: / NCR form of the same thing -- a negative line in the item list that is
#: then summarised again as DISCOUNT(S) after the subtotal.
_COUPON_LINE = re.compile(
    r"\b(?:MFR\s+COUPON|CVS\s+COUPON|COUPON|VOUCHER|REBATE|PROMO)\b",
    re.IGNORECASE,
)

#: A trailing saving printed on the item line itself: "SAVED .50",
#: "SAVED 50% 3.00", "YOU SAVE 1.97". The amount belongs to the discount, not
#: to the price, and taking the rightmost number would otherwise read it as
#: the line total.
_SAVED_SUFFIX = re.compile(
    r"\b(?:SAVED|YOU\s+SAVE|SAVINGS?)\b"
    r"(?:\s*\d{1,2}(?:[.,]\d{1,2})?\s*%)?"  # optional "50%" before the amount
    r"\s*([\d.,]+)?\s*\S{0,4}\s*$",
    re.IGNORECASE,
)

#: Promotional annotations printed beneath an item. They carry a price but
#: describe the item above rather than a purchase of their own, so counting
#: them double-bills the receipt.
_ANNOTATION = re.compile(
    r"^\s*(?:"
    r"REGULAR\s+PRICE|REG\.?\s+PRICE|WAS\b|YOU\s+(?:SAVE|PAY)|SAVE\b"
    r"|MSRP|LIST\s+PRICE|ORIG(?:INAL)?\.?\s+PRICE|MEMBER\s+PRICE|PRICE\s+EACH"
    r"|\d+\s*@\s*\S+\s*(?:EA|EACH)?\s*$"
    # "4.49 EACH OR 3/ 12.00" -- a unit-price note under the item above.
    r"|[\d.,]+\s+EACH\b"
    # "BUY 1, GET 1 FOR 50% OFF" -- a promotion, not a purchase.
    r"|BUY\s*\d*\s*,?\s*GET\b"
    r")",
    re.IGNORECASE,
)

#: Labels that disqualify a line from being an item.
_DISQUALIFYING = (
    LabelCategory.SUBTOTAL,
    LabelCategory.TOTAL,
    LabelCategory.TAX,
    LabelCategory.CHANGE,
    LabelCategory.TENDERED,
    LabelCategory.SERVICE_CHARGE,
    LabelCategory.SHIPPING,
    LabelCategory.ITEM_COUNT,
    LabelCategory.DATE,
    LabelCategory.TIME,
    LabelCategory.RECEIPT_ID,
    LabelCategory.MERCHANT_CONTACT,
    LabelCategory.FOOTER,
)

#: A description shorter than this is more likely OCR noise than a product.
_MIN_DESCRIPTION_LENGTH = 2

#: Beyond this, a "quantity" is a quantity no longer -- it is a year, a code
#: or a mis-parsed price.
_MAX_PLAUSIBLE_QUANTITY = Decimal("1000")


@dataclass(frozen=True, slots=True)
class ItemsResult:
    """Extracted items plus the evidence supporting the set as a whole."""

    items: tuple[LineItem, ...]
    #: Per-item extraction confidence priors, aligned with ``items``.
    methods: tuple[ExtractionMethod, ...]
    evidence: tuple[Evidence, ...]
    #: Lines inside the item region that could not be interpreted.
    skipped_lines: int = 0


def extract_items(context: ReceiptContext) -> ItemsResult:
    """Extract line items from the item region of ``context``.

    Falls back to scanning the whole document when section detection found no
    item region, which happens on receipts whose totals block is unlabelled.
    """
    result = _scan_region(_item_region(context), context)
    if not result.items:
        # Section detection can misplace the items boundary -- a footer note
        # containing the word "total", for instance, drags the totals block
        # upwards and strands the real items below it. Rather than return an
        # empty list, retry across every line that is not clearly structural.
        fallback = _scan_region(_fallback_region(context), context)
        if fallback.items:
            return fallback
    return result


def _scan_region(region: list[LineView], context: ReceiptContext) -> ItemsResult:
    """Interpret the lines of one candidate item region."""
    items: list[LineItem] = []
    methods: list[ExtractionMethod] = []
    evidence: list[Evidence] = []
    skipped = 0

    index = 0
    while index < len(region):
        line = region[index]

        if _is_structural(line):
            index += 1
            continue

        parsed = _parse_item_line(line, context)

        if parsed is None:
            # A description-only line may be completed by a price on the line
            # below -- a common narrow-receipt layout.
            continuation = _try_continuation(region, index)
            if continuation is not None:
                item, method, ev, consumed = continuation
                items.append(item)
                methods.append(method)
                evidence.append(ev)
                index += consumed
                continue
            if line.normalized.strip():
                skipped += 1
            index += 1
            continue

        item, method, ev = parsed
        items.append(item)
        methods.append(method)
        evidence.append(ev)
        index += 1

    return ItemsResult(
        items=tuple(items),
        methods=tuple(methods),
        evidence=tuple(evidence),
        skipped_lines=skipped,
    )


def _item_region(context: ReceiptContext) -> list[LineView]:
    """The item region identified by section detection."""
    return [
        line for line in context.lines if context.items_start <= line.index < context.items_end
    ] or _fallback_region(context)


def _fallback_region(context: ReceiptContext) -> list[LineView]:
    """Every line that is not clearly a header, total or footer line.

    Skips the first line, which is the merchant name on essentially every
    receipt and would otherwise be read as an item whenever it happens to sit
    beside a number.
    """
    return [
        line for line in context.lines[1:] if not line.has(*_DISQUALIFYING) and not line.is_blank
    ]


def _is_structural(line: LineView) -> bool:
    """Whether the line is a divider, column header or otherwise not an item."""
    if line.is_blank or line.is_divider:
        return True
    if _NON_ITEM.match(line.normalized) or _ANNOTATION.match(line.normalized):
        return True
    if _METADATA_LINE.search(line.normalized) or _COUPON_LINE.search(line.normalized):
        return True
    return line.has(*_DISQUALIFYING)


def _parse_item_line(
    line: LineView, context: ReceiptContext
) -> tuple[LineItem, ExtractionMethod, Evidence] | None:
    """Interpret a single line as an item, or return ``None``.

    The number of amounts on the line drives the interpretation:

    * **0** -- not an item on its own; may be completed by a continuation.
    * **1** -- description plus line total.
    * **2** -- either ``qty x unit`` (when a multiplication marker is present)
      or ``unit total`` (when it is not).
    * **3+** -- ``qty unit total``; the rightmost is the line total, which is
      the one invariant across point-of-sale layouts.
    """
    if not line.amounts:
        return None

    text = line.normalized
    quantity: Decimal | None = None
    unit: str | None = None
    unit_price: Decimal | None = None
    method = ExtractionMethod.HEURISTIC

    # Consume quantity markers *before* looking for prices. Doing it in this
    # order is what keeps the "1" of "Milk 1L" out of the price list and the
    # "L" out of the description -- parsing prices first would leave both
    # fragments behind.
    working = text
    sku: str | None = None
    saved: Decimal | None = None

    # Take the saving off the end before any price is read, so the rightmost
    # remaining amount is the actual line total.
    saved_match = _SAVED_SUFFIX.search(working)
    if saved_match is not None:
        saved = _to_decimal(saved_match.group(1)) if saved_match.group(1) else None
        working = _blank(working, saved_match.span())

    # Strip a leading product code before anything else reads it as money.
    code = _LEADING_PRODUCT_CODE.match(working)
    if code is not None:
        sku = code.group(1)
        working = _blank(working, code.span(1))

    # Separate a UPC that OCR jammed into the price, then lift any remaining
    # mid-line product code so it is not left in the description.
    working = _GLUED_UPC_PRICE.sub(r"\1 \2", working)
    embedded = _pick_embedded_sku(working)
    if embedded is not None:
        sku = sku or embedded[0]
        working = _blank(working, embedded[1])

    qty_at_price = _QTY_AT_PRICE.search(working)
    if qty_at_price is not None and _is_glued_pack_marker(working, qty_at_price):
        qty_at_price = None
    weight = _WEIGHT.search(working)

    # Drop T/F/N/E/X taxability flags before prices are read, so "6.00 T",
    # the glued OCR form "6.00T", and Walmart's "F 2.78" all leave a clean
    # description.
    working = PRICE_TAX_FLAG.sub(r"\g<price>", working)
    working = _PRE_PRICE_TAX_FLAG.sub(lambda match: " " * len(match.group(0)), working)

    if qty_at_price is not None and _is_product_code(qty_at_price.group(2)):
        # "2 x 284060377 GG OATMILK" has the exact shape of quantity-times-unit-
        # price, but the second number is a product code. The quantity is still
        # real, so keep it and record the code as the SKU rather than pricing
        # the line at 284 million.
        quantity = _to_decimal(qty_at_price.group(1))
        sku = sku or qty_at_price.group(2)
        working = _blank(working, qty_at_price.span())
        method = ExtractionMethod.REGEX
    elif qty_at_price is not None:
        quantity = _to_decimal(qty_at_price.group(1))
        unit_price = _to_decimal(qty_at_price.group(2))
        working = _blank(working, qty_at_price.span())
        method = ExtractionMethod.REGEX
    elif weight is not None:
        quantity = _to_decimal(weight.group(1))
        unit = weight.group(2).upper()
        working = _blank(working, weight.span())
        at_price = _AT_PRICE.search(working)
        if at_price is not None:
            unit_price = _to_decimal(at_price.group(1))
            working = _blank(working, at_price.span())
        method = ExtractionMethod.REGEX
    else:
        marked = _MARKED_QTY.search(working)
        leading = _LEADING_QTY.match(working)
        if marked is not None:
            quantity = _to_decimal(marked.group(1))
            working = _blank(working, marked.span())
            method = ExtractionMethod.REGEX
        elif leading is not None and not _NUMBERED_PRODUCT.match(working):
            quantity = _to_decimal(leading.group(1))
            working = _blank(working, leading.span(1))
            method = ExtractionMethod.REGEX

    prices = parse_all_amounts(working, style=context.separator_style, repair_ocr=False)
    expanded: list[ParsedAmount] = []
    for price in prices:
        expanded.extend(_split_model_and_price(working, price, context.separator_style))
    prices = [price for price in expanded if not _is_name_amount(working, price)]
    # Once a real money figure is on the line, leftover bare integers are
    # pack sizes, model numbers and brand digits -- not a second price.
    if any("." in price.raw or "," in price.raw for price in prices):
        prices = [price for price in prices if "." in price.raw or "," in price.raw]
    if not prices:
        return None

    total_price: Decimal | None = prices[-1].value
    if unit_price is None and len(prices) >= 2:
        # Only a figure carrying cents is a candidate unit price. A bare
        # integer in that position is a size or pack code -- "12Z" read as
        # "122", "128S" read as "1285" -- and taking it would price a 4.49
        # item at 122.00.
        unit_candidate = prices[-2]
        if "." in unit_candidate.raw or "," in unit_candidate.raw:
            unit_price = unit_candidate.value

    description = _extract_description(working, prices)
    if description is not None:
        description = _TRAILING_TAX_NOISE.sub("", description).strip()
        if sku is None:
            leftover = _pick_embedded_sku(description)
            if leftover is not None:
                sku = leftover[0]
                description = _blank(description, leftover[1])
                description = _TRAILING_TAX_NOISE.sub("", description).strip()
                description = re.sub(r"\s+", " ", description)
    if description is None or len(description) < _MIN_DESCRIPTION_LENGTH:
        return None

    if quantity is not None and (quantity <= 0 or quantity > _MAX_PLAUSIBLE_QUANTITY):
        quantity = None

    # A unit price far above the line total is an identifier that slipped
    # through, not a price.
    if (
        unit_price is not None
        and total_price is not None
        and total_price > 0
        and unit_price > total_price * _MAX_UNIT_PRICE_RATIO
    ):
        unit_price = None

    # A "unit price" equal to the line total is not a separate figure, it is
    # the same number read twice from a single-quantity row.
    if (
        unit_price is not None
        and total_price is not None
        and unit_price == total_price
        and (quantity is None or quantity == 1)
    ):
        unit_price = None

    # Complete the quantity/unit-price/total triple only when two members are
    # known -- never invent a value from one.
    if quantity is not None and unit_price is None and total_price is not None and quantity > 0:
        candidate = (total_price / quantity).quantize(Decimal("0.01"))
        if candidate > 0:
            unit_price = candidate

    if total_price is None:
        return None

    discount = saved
    if discount is None and _ITEM_DISCOUNT.search(text) and total_price < 0:
        discount = abs(total_price)

    evidence = line.evidence(method, notes=f"prices={len(prices)}")
    item = LineItem(
        description=description,
        sku=sku or _extract_sku(description),
        quantity=quantity,
        unit=unit,
        unit_price=unit_price,
        total_price=total_price,
        discount=discount,
        line_index=line.index,
    )
    return item, method, evidence


def _try_continuation(
    region: list[LineView], index: int
) -> tuple[LineItem, ExtractionMethod, Evidence, int] | None:
    """Join a description-only line with a price on the following line.

    Only applies when the description line carries no amount at all and the
    next line carries nothing *but* an amount -- a narrow pattern, chosen so
    that unrelated adjacent lines are not fused into a fictional item.
    """
    line = region[index]
    if line.amounts or not line.normalized.strip() or index + 1 >= len(region):
        return None

    following = region[index + 1]
    if not following.amounts or len(following.amounts) > 1:
        return None
    remainder = following.normalized.replace(following.amounts[0].raw, "").strip()
    if remainder:
        return None

    description = line.normalized.strip()
    if len(description) < _MIN_DESCRIPTION_LENGTH:
        return None

    evidence = Evidence(
        source_text=f"{line.raw} / {following.raw}",
        line_index=line.index,
        bbox=line.bbox,
        ocr_confidence=min(line.confidence, following.confidence),
        method=ExtractionMethod.SPATIAL,
        notes="description_and_price_on_adjacent_lines",
    )
    item = LineItem(
        description=description,
        sku=_extract_sku(description),
        total_price=following.amounts[0].value,
        line_index=line.index,
    )
    return item, ExtractionMethod.SPATIAL, evidence, 2


def _is_product_code(token: str) -> bool:
    """Whether a numeric token is an identifier rather than a price.

    ``2 x 284060377 GG OATMILK`` has the exact shape of "quantity times unit
    price", but 284060377 is a product code. A price on a receipt carries a
    decimal separator or is small; a long bare integer is neither.
    """
    cleaned = token.strip()
    if any(sep in cleaned for sep in ".,"):
        return False
    return cleaned.isdigit() and len(cleaned) >= _PRODUCT_CODE_MIN_DIGITS


def _is_glued_pack_marker(text: str, match: re.Match[str]) -> bool:
    """Whether a qty×price match is actually a pack size in the name.

    ``Wings 8x 6.00`` has the shape of 8 × 6.00, but ``8x`` is an 8-pack and
    6.00 is the line total. True quantity-times-price either spaces the
    operator (``2 x 4.00  8.00``) or still has another price after the match.
    """
    token = match.group(0)
    if re.search(r"\d\s+[xX@*]", token):
        return False
    if not re.search(r"\d[xX]", token):
        return False
    rest = text[match.end() :]
    return not parse_all_amounts(rest, repair_ocr=False)


def _split_model_and_price(
    text: str, amount: ParsedAmount, style: SeparatorStyle
) -> list[ParsedAmount]:
    """Split ``iPhone 16 899.00`` so 16 is not absorbed into a grouped price.

    Space-as-thousands (``1 234,50``) is a real grouping form in comma-decimal
    locales. In dot-decimal receipts the digits before the space on an item
    line are a model number sitting next to the price.
    """
    if style is SeparatorStyle.COMMA_DECIMAL:
        return [amount]
    match = re.fullmatch(r"(\d{1,4})[\s\u00a0\u202f]+(\d+[.,]\d{1,3})", amount.raw.strip())
    if match is None:
        return [amount]
    idx = text.find(amount.raw)
    prefix = text[:idx] if idx >= 0 else ""
    if not any(char.isalpha() for char in prefix):
        return [amount]
    model = match.group(1)
    price = match.group(2)
    return [
        ParsedAmount(value=Decimal(model), raw=model),
        ParsedAmount(value=Decimal(price.replace(",", ".")), raw=price),
    ]


def _is_name_amount(text: str, amount: ParsedAmount) -> bool:
    """Whether ``amount`` is digits inside the product name, not a price.

    Receipt prices carry cents. The integers that remain are pack ratios
    (``3:1``), letter-glued codes (``B12``, ``3M``, ``V8``), hyphenated
    brands (``7-Up``), pack markers (``8x``, ``12pk``) and percents (``2%``).
    Stripping them is how "Hot Dog 3:1" became "Hot Dog" and "Vitamin B12"
    became "Vitamin B".
    """
    if "." in amount.raw or "," in amount.raw:
        return False

    start = 0
    while True:
        found = text.find(amount.raw, start)
        if found < 0:
            return False
        after_at = found + len(amount.raw)
        before = text[found - 1] if found > 0 else ""
        after = text[after_at] if after_at < len(text) else ""
        # Skip a match that is only the prefix/suffix of a longer number.
        if before.isdigit() or after.isdigit() or before in ".," or after in ".,":
            start = found + 1
            continue
        if before.isalpha() or after.isalpha():
            return True
        if before == ":" or after == ":":
            return True
        if after in "-/" and after_at + 1 < len(text) and text[after_at + 1].isalpha():
            return True
        if after in "%xX":
            return True
        if re.match(r"\s*(?:PK|PACK|CT|COUNT|PC|PCS)\b", text[after_at:], re.IGNORECASE):
            return True
        start = found + 1


def _blank(text: str, span: tuple[int, int]) -> str:
    """Replace ``span`` with spaces, preserving every other character offset.

    Blanking rather than deleting keeps later matches aligned with the
    original string, so several markers can be consumed in sequence without
    each one invalidating the next one's offsets.
    """
    start, end = span
    return text[:start] + " " * (end - start) + text[end:]


def _extract_description(text: str, amounts: list[ParsedAmount]) -> str | None:
    """Strip prices and decoration, leaving the product description.

    ``text`` has already had its quantity markers blanked by the caller, so
    only prices and punctuation remain to remove.
    """
    cleaned = text
    for amount in reversed(amounts):
        # Prices sit on the right; replace the last occurrence so a "1" in
        # the name is not eaten by a "1.00" total whose raw was mis-sliced.
        idx = cleaned.rfind(amount.raw)
        if idx < 0:
            continue
        cleaned = cleaned[:idx] + " " + cleaned[idx + len(amount.raw) :]

    cleaned = re.sub(r"[@*]", " ", cleaned)
    cleaned = re.sub(r"[.\-_*=]{2,}", " ", cleaned)
    cleaned = re.sub(r"[$€£¥₹৳]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .,-:*#")

    if not cleaned or not any(char.isalpha() for char in cleaned):
        return None
    return cleaned


def _pick_embedded_sku(text: str) -> tuple[str, tuple[int, int]] | None:
    """Return ``(code, span)`` for a mid-line UPC / EAN / letter-suffixed PLU."""
    matches = list(_EMBEDDED_SKU.finditer(text))
    if not matches:
        return None
    chosen = max(
        matches,
        key=lambda match: (len(re.sub(r"\D", "", match.group(1))), len(match.group(1))),
    )
    return chosen.group(1), chosen.span(1)


def _extract_sku(description: str) -> str | None:
    """Pull a product code out of a description, when one is clearly present."""
    embedded = _pick_embedded_sku(description)
    if embedded is not None:
        return embedded[0]
    match = _SKU.search(description.strip())
    if match is None:
        return None
    candidate = match.group(1)
    if not any(char.isdigit() for char in candidate):
        return None
    return candidate


def _to_decimal(raw: str) -> Decimal | None:
    try:
        return Decimal(raw.replace(",", "."))
    except (ArithmeticError, ValueError):
        return None


def sum_item_totals(items: tuple[LineItem, ...]) -> Decimal | None:
    """Sum line totals, or ``None`` when no item carries one.

    Returning ``None`` rather than zero keeps "no priced items" distinguishable
    from "items totalling zero" in the financial validator.
    """
    priced = [item.total_price for item in items if item.total_price is not None]
    if not priced:
        return None
    return sum(priced, Decimal("0"))
