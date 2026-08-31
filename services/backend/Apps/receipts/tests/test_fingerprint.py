"""Unit coverage of the full-data receipt fingerprint (Apps.receipts.ocr).

Pure functions, no database — this is the fast, exhaustive layer for the
canonicalization/hashing rules themselves (key order, whitespace, money
formats, which fields are excluded and why). How fingerprinting behaves as
part of the full upload flow (duplicate detection, manual review routing,
reward issuance) is covered in test_claim_to_reward.py instead.
"""

from django.test import SimpleTestCase

from Apps.receipts import ocr


def envelope(data: dict, **extra) -> dict:
    """A minimal provider envelope wrapping `data`, plus pipeline metadata
    that must never affect the fingerprint."""
    body = {
        "success": True,
        "data": data,
        "warnings": [],
        "errors": [],
        "processing": {"request_id": "should-be-ignored", "processing_time_ms": 1.0},
    }
    body.update(extra)
    return body


class DeterminismTests(SimpleTestCase):
    """Test 1 / Test 9 (spec §13): identical data -> identical fingerprint,
    every time, regardless of incidental formatting."""

    def test_identical_payloads_hash_identically(self):
        data = {"merchant": {"name": "Shop"}, "total": "10.00"}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(data)),
            ocr.build_full_fingerprint(envelope(dict(data))),
        )

    def test_repeated_calls_are_stable(self):
        data = {"merchant": {"name": "Shop"}, "total": "10.00"}
        hashes = {ocr.build_full_fingerprint(envelope(data)) for _ in range(20)}
        self.assertEqual(len(hashes), 1)

    def test_hash_is_a_64_char_hex_sha256(self):
        fp = ocr.build_full_fingerprint(envelope({"total": "1.00"}))
        self.assertEqual(len(fp), 64)
        int(fp, 16)  # raises ValueError if not hex


class KeyOrderTests(SimpleTestCase):
    """Test 8: same receipt, JSON keys in a different order -> same fingerprint."""

    def test_top_level_key_order_is_irrelevant(self):
        a = {"merchant": {"name": "Shop"}, "total": "10.00", "receipt_number": "1"}
        b = {"receipt_number": "1", "total": "10.00", "merchant": {"name": "Shop"}}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )

    def test_nested_key_order_is_irrelevant(self):
        a = {"transaction": {"date": "2026-08-29", "time": "14:30:00"}}
        b = {"transaction": {"time": "14:30:00", "date": "2026-08-29"}}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )


class WhitespaceAndCaseTests(SimpleTestCase):
    """Test 9: insignificant OCR whitespace/case differences don't change
    the fingerprint."""

    def test_surrounding_and_repeated_whitespace_is_collapsed(self):
        a = {"merchant": {"name": "Fahad Chocolate Shop"}}
        b = {"merchant": {"name": "  Fahad   Chocolate    Shop  "}}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )

    def test_case_differences_are_normalized(self):
        a = {"merchant": {"name": "Fahad Chocolate Shop"}}
        b = {"merchant": {"name": "FAHAD CHOCOLATE SHOP"}}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )


class MoneyNormalizationTests(SimpleTestCase):
    """The worked example from the spec: "65.77" == "$65.77" == "65.770"."""

    def test_currency_symbol_and_trailing_zeros_do_not_matter(self):
        fps = {
            ocr.build_full_fingerprint(envelope({"total": "65.77"})),
            ocr.build_full_fingerprint(envelope({"total": "$65.77"})),
            ocr.build_full_fingerprint(envelope({"total": "65.770"})),
            ocr.build_full_fingerprint(envelope({"total": "65.7700"})),
        }
        self.assertEqual(len(fps), 1)

    def test_thousands_separators_do_not_matter(self):
        a = ocr.build_full_fingerprint(envelope({"total": "1234.50"}))
        b = ocr.build_full_fingerprint(envelope({"total": "1,234.50"}))
        self.assertEqual(a, b)

    def test_a_genuinely_different_amount_changes_the_hash(self):
        a = ocr.build_full_fingerprint(envelope({"total": "65.77"}))
        b = ocr.build_full_fingerprint(envelope({"total": "65.78"}))
        self.assertNotEqual(a, b)

    def test_round_numbers_do_not_use_scientific_notation(self):
        canonical = ocr.canonicalize_receipt_data(envelope({"total": "100"}))
        self.assertEqual(canonical["total"], "100")


class IdentifierFieldTests(SimpleTestCase):
    """Identifier-shaped fields (store_id, sku, card_last_4, ...) must be
    preserved as exact text, never numerically collapsed — "007" and "7" are
    different identities even though they're both "numbers"."""

    def test_leading_zeros_are_preserved_on_identifier_fields(self):
        for key in ("store_id", "register_id", "card_last_4", "authorization_code"):
            with self.subTest(key=key):
                a = ocr.build_full_fingerprint(envelope({key: "007"}))
                b = ocr.build_full_fingerprint(envelope({key: "7"}))
                self.assertNotEqual(a, b, f"{key} should not be numerically normalized")

    def test_item_sku_preserves_leading_zeros(self):
        a = ocr.build_full_fingerprint(
            envelope({"items": [{"description": "X", "sku": "007"}]})
        )
        b = ocr.build_full_fingerprint(
            envelope({"items": [{"description": "X", "sku": "7"}]})
        )
        self.assertNotEqual(a, b)

    def test_transaction_id_and_receipt_number_are_text_not_numbers(self):
        canonical = ocr.canonicalize_receipt_data(
            envelope({"receipt_number": "00123", "transaction": {"transaction_id": "00123"}})
        )
        self.assertEqual(canonical["receipt_number"], "00123")
        self.assertEqual(canonical["transaction"]["transaction_id"], "00123")


class ExcludedFieldTests(SimpleTestCase):
    """Test 11/12 context (spec §11-§12): processing/pipeline metadata and the
    OCR engine's own judgments about the extraction must never affect the
    fingerprint — only what's actually printed on the receipt."""

    def _same_data_different_meta(self, **meta_a_vs_b):
        data = {"total": "10.00"}
        a = envelope(data, **{k: v[0] for k, v in meta_a_vs_b.items()})
        b = envelope(data, **{k: v[1] for k, v in meta_a_vs_b.items()})
        return ocr.build_full_fingerprint(a), ocr.build_full_fingerprint(b)

    def test_request_id_is_excluded(self):
        a = envelope({"total": "10.00"}, processing={"request_id": "AAA"})
        b = envelope({"total": "10.00"}, processing={"request_id": "BBB"})
        self.assertEqual(ocr.build_full_fingerprint(a), ocr.build_full_fingerprint(b))

    def test_processing_time_is_excluded(self):
        a = envelope({"total": "10.00"}, processing={"processing_time_ms": 100.0})
        b = envelope({"total": "10.00"}, processing={"processing_time_ms": 999.9})
        self.assertEqual(ocr.build_full_fingerprint(a), ocr.build_full_fingerprint(b))

    def test_confidence_is_excluded_even_nested_under_data(self):
        a = {"total": "10.00", "confidence": {"overall": 0.99, "fields": {"total": 0.99}}}
        b = {"total": "10.00", "confidence": {"overall": 0.10, "fields": {"total": 0.10}}}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )

    def test_validation_and_review_are_excluded(self):
        a = {"total": "10.00", "validation": {"is_valid": True}, "review": {"review_required": False}}
        b = {"total": "10.00", "validation": {"is_valid": False}, "review": {"review_required": True}}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )

    def test_schema_version_and_document_type_are_excluded(self):
        a = {"total": "10.00", "schema_version": "1.0", "document_type": "receipt"}
        b = {"total": "10.00", "schema_version": "2.0", "document_type": "invoice"}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )

    def test_line_index_is_excluded(self):
        a = {"items": [{"description": "X", "line_index": 1}]}
        b = {"items": [{"description": "X", "line_index": 99}]}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )

    def test_success_warnings_errors_wrapper_is_excluded(self):
        a = envelope({"total": "10.00"}, warnings=[{"code": "X"}], errors=[])
        b = envelope({"total": "10.00"}, warnings=[], errors=[{"code": "Y", "message": "z"}])
        self.assertEqual(ocr.build_full_fingerprint(a), ocr.build_full_fingerprint(b))


class MissingValueTests(SimpleTestCase):
    """Test 5 / Test 6 (spec §13): fingerprint still builds from whatever IS
    present; absent, null and empty-string all normalize identically."""

    def test_absent_key_and_explicit_null_canonicalize_identically(self):
        a = ocr.canonicalize_receipt_data(envelope({"total": "10.00"}))
        b = ocr.canonicalize_receipt_data(envelope({"total": "10.00", "receipt_number": None}))
        self.assertEqual(a, b)

    def test_null_and_empty_string_canonicalize_identically(self):
        a = ocr.canonicalize_receipt_data(envelope({"receipt_number": None}))
        b = ocr.canonicalize_receipt_data(envelope({"receipt_number": "   "}))
        self.assertEqual(a, b)

    def test_missing_transaction_id_does_not_block_fingerprinting(self):
        fp = ocr.build_full_fingerprint(
            envelope({"merchant": {"name": "Shop"}, "items": [{"description": "Milk"}]})
        )
        self.assertIsNotNone(fp)

    def test_missing_date_time_does_not_block_fingerprinting(self):
        fp = ocr.build_full_fingerprint(
            envelope({"merchant": {"name": "Shop"}, "receipt_number": "INV-1"})
        )
        self.assertIsNotNone(fp)

    def test_completely_empty_data_returns_none(self):
        self.assertIsNone(ocr.build_full_fingerprint(envelope({})))

    def test_all_null_or_empty_data_returns_none(self):
        blank = {"merchant": {}, "transaction": {}, "items": [], "receipt_number": None, "total": None}
        self.assertIsNone(ocr.build_full_fingerprint(envelope(blank)))


class ItemArrayTests(SimpleTestCase):
    """Test 7 (spec §13): all item data participates; item order (OCR
    line-read jitter) must not change the fingerprint, but the item content
    genuinely must."""

    def test_all_items_participate(self):
        one_item = {"items": [{"description": "Coke", "quantity": "1"}]}
        two_items = {
            "items": [
                {"description": "Coke", "quantity": "1"},
                {"description": "Chips", "quantity": "1"},
            ]
        }
        self.assertNotEqual(
            ocr.build_full_fingerprint(envelope(one_item)),
            ocr.build_full_fingerprint(envelope(two_items)),
        )

    def test_item_order_does_not_matter(self):
        a = {"items": [{"description": "Coke", "quantity": "1"},
                        {"description": "Chips", "quantity": "2"}]}
        b = {"items": [{"description": "Chips", "quantity": "2"},
                        {"description": "Coke", "quantity": "1"}]}
        self.assertEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )

    def test_a_changed_item_field_changes_the_hash(self):
        a = {"items": [{"description": "Coke", "unit_price": "1.00"}]}
        b = {"items": [{"description": "Coke", "unit_price": "1.50"}]}
        self.assertNotEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )

    def test_duplicate_identical_lines_are_each_kept(self):
        """Two lines of the exact same product are a different receipt from
        one line of it — the list length still matters even after sorting."""
        one = {"items": [{"description": "Coke", "quantity": "1"}]}
        two = {"items": [{"description": "Coke", "quantity": "1"},
                          {"description": "Coke", "quantity": "1"}]}
        self.assertNotEqual(
            ocr.build_full_fingerprint(envelope(one)),
            ocr.build_full_fingerprint(envelope(two)),
        )


class DifferentReceiptTests(SimpleTestCase):
    """Test 3 / Test 4 (spec §13): receipts that are genuinely different must
    not collide, even when they share a product/shop."""

    def test_different_receipt_numbers_do_not_collide(self):
        a = {"merchant": {"name": "Shop"}, "receipt_number": "INV-1"}
        b = {"merchant": {"name": "Shop"}, "receipt_number": "INV-2"}
        self.assertNotEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )

    def test_same_product_and_shop_different_transaction_do_not_collide(self):
        a = {
            "merchant": {"name": "Shop"},
            "transaction": {"date": "2026-08-29", "time": "14:30:00"},
            "items": [{"description": "Milk", "unit_price": "2.50"}],
            "receipt_number": "INV-1",
        }
        b = {
            "merchant": {"name": "Shop"},
            "transaction": {"date": "2026-08-29", "time": "16:45:00"},
            "items": [{"description": "Milk", "unit_price": "2.50"}],
            "receipt_number": "INV-2",
        }
        self.assertNotEqual(
            ocr.build_full_fingerprint(envelope(a)),
            ocr.build_full_fingerprint(envelope(b)),
        )


class LegacyShapeTests(SimpleTestCase):
    """The no-image / client-supplied path (Apps.receipts.services._from_legacy)
    stores a different `.raw` shape (no envelope) — it must still fingerprint
    from the same content, not just the items list."""

    def test_legacy_shape_without_a_data_wrapper_still_hashes(self):
        raw = {"provider": "client-supplied", "items": [{"description": "Milk", "quantity": 1}]}
        self.assertIsNotNone(ocr.build_full_fingerprint(raw))

    def test_legacy_provider_tag_does_not_affect_the_hash(self):
        a = {"provider": "client-supplied", "items": [{"description": "Milk"}]}
        b = {"provider": "something-else", "items": [{"description": "Milk"}]}
        self.assertEqual(ocr.build_full_fingerprint(a), ocr.build_full_fingerprint(b))


class ConfidenceExtractionTests(SimpleTestCase):
    def test_overall_confidence_is_read_when_present(self):
        body = envelope({"total": "1.00", "confidence": {"overall": 0.87}})
        self.assertEqual(ocr.extract_confidence(body), 0.87)

    def test_missing_confidence_returns_none(self):
        self.assertIsNone(ocr.extract_confidence(envelope({"total": "1.00"})))

    def test_malformed_confidence_returns_none_not_a_crash(self):
        body = envelope({"total": "1.00", "confidence": "not-a-dict"})
        self.assertIsNone(ocr.extract_confidence(body))
