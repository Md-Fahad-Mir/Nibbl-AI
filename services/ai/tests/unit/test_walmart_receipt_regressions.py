"""Regressions from a photographed Walmart receipt.

PaddleOCR-VL returns one line per item in the US grocery shape
``NAME  UPC  TAX_FLAG  PRICE``, sometimes with the UPC glued to the cents.
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.extraction.receipt import RuleBasedReceiptExtractor
from app.security.redaction import redact_text


@pytest.fixture
def extract(settings, ocr_result_factory):
    def _extract(lines: list[str]):
        return RuleBasedReceiptExtractor(settings).extract(ocr_result_factory(lines))

    return _extract

_WALMART_OCR = [
    "Give us feedback @ survey.walmart.com Thank you! ID #:7P9W2NFJGWL",
    "Walmart",
    "610 W 29TH ST",
    "SAN ANGELO TX 76903",
    "ST#01249OP#009046TE#46TR#06738",
    "NIGHT HAWK 004170901935 F 2.78 0",
    "HEALTHCHOICE 007265545445 F 2.98 0",
    "MANGO YOGURT 005360000026 F 0.50 0",
    "BANAN YOGURT 005360000030 F 0.50 0",
    "POTATOES 089286700194 F 2.94 N",
    "SUGAR GRANU 007874237117 F 4.98 N",
    "AUTODRIVE 20 0681131092874.47 X",
    "AUTODRIVE 20 0681131092874.47 X",
    "DUTCH OVEN 001601710695 19.94 X",
    "BULK LEMONS 000000004958KF 0.48 N",
    "SUBTOTAL 44.04",
    "TAX 1 8.250 % 2.38",
    "TOTAL 46.42",
    "DEBIT TEND 46.42",
    "CHANGE DUE 0.00",
    "EFT DEBIT PAY FROM PRIMARY",
    "46.42 TOTAL PURCHASE",
    "US DEBIT",
    "***** 5870",
    "REF#026500333070",
    "NETWORK ID.0076 APPR CODE 541926",
    "09/21/20",
    "17:06:36",
    "#ITEMS SOLD 10",
]


def test_walmart_line_items_drop_upc_and_tax_flags(extract) -> None:
    result = extract(_WALMART_OCR)
    assert [(item.description, item.sku, item.total_price) for item in result.items] == [
        ("NIGHT HAWK", "004170901935", Decimal("2.78")),
        ("HEALTHCHOICE", "007265545445", Decimal("2.98")),
        ("MANGO YOGURT", "005360000026", Decimal("0.50")),
        ("BANAN YOGURT", "005360000030", Decimal("0.50")),
        ("POTATOES", "089286700194", Decimal("2.94")),
        ("SUGAR GRANU", "007874237117", Decimal("4.98")),
        ("AUTODRIVE 20", "068113109287", Decimal("4.47")),
        ("AUTODRIVE 20", "068113109287", Decimal("4.47")),
        ("DUTCH OVEN", "001601710695", Decimal("19.94")),
        ("BULK LEMONS", "000000004958KF", Decimal("0.48")),
    ]


def test_walmart_header_and_settlement(extract) -> None:
    result = extract(_WALMART_OCR)
    assert result.merchant_name.value == "Walmart"
    assert result.merchant_address.value is not None
    assert "610 W 29TH ST" in result.merchant_address.value
    assert "SAN ANGELO TX 76903" in result.merchant_address.value
    assert result.merchant_store_id.value == "01249"
    assert result.receipt_number.value == "06738"
    assert result.subtotal.value == Decimal("44.04")
    assert result.total.value == Decimal("46.42")
    assert result.tax.value is not None
    assert result.tax.value.total == Decimal("2.38")
    assert result.amount_tendered.value == Decimal("46.42")
    assert result.change.value == Decimal("0.00")
    assert result.card_last4.value == "5870"
    assert result.authorization_code.value == "541926"
    assert result.currency.value == "USD"


def test_glued_upc_is_not_redacted_as_a_card() -> None:
    result = redact_text("AUTODRIVE 20 0681131092874.47 X")
    assert "068113109287" in result.text
    assert not result.redacted
