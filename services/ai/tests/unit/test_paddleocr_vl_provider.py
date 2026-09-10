"""PaddleOCR-VL provider tests.

The live engine is optional and heavy, so every test here stubs the pipeline.
What is under test is the contract: layout categories become lines, printed
spacing is not collapsed, logo/image blocks are kept, and vendor exceptions
never escape.
"""

from __future__ import annotations

from types import SimpleNamespace

import numpy as np
import pytest

from app.core.exceptions import ErrorCode, OCRError, OCRTimeoutError, ProviderUnavailableError
from app.ocr.base import OCRRequest
from app.ocr.factory import available_providers, create_ocr_provider
from app.ocr.providers.paddleocr_vl import (
    PaddleOCRVLProvider,
    _box,
    _content_lines,
    _limit_long_edge,
    _normalise_pages,
)


def _request() -> OCRRequest:
    return OCRRequest(image=np.zeros((20, 40, 3), np.uint8), timeout_seconds=2.0)


def _page(*blocks: dict) -> dict:
    return {
        "width": 40,
        "height": 20,
        "parsing_res_list": list(blocks),
    }


def test_provider_is_registered() -> None:
    assert "paddleocr_vl" in available_providers()


def test_factory_builds_the_provider(make_settings) -> None:
    settings = make_settings(ocr_provider="paddleocr_vl")
    provider = create_ocr_provider(settings=settings)
    assert provider.name == "paddleocr_vl"


def test_health_check_reports_missing_package(monkeypatch, settings) -> None:
    def _boom() -> None:
        raise ProviderUnavailableError(
            "paddleocr is not installed.",
            details={"provider": "paddleocr_vl"},
        )

    provider = PaddleOCRVLProvider(settings)
    monkeypatch.setattr(provider, "_engine_class", _boom)
    ready, detail = provider.health_check()
    assert not ready
    assert detail and "paddleocr" in detail


def test_spaces_and_layout_categories_are_kept(monkeypatch, settings) -> None:
    """The VLM's printed spacing and every text-bearing region must survive."""
    payload = _page(
        {
            "block_label": "title",
            "block_content": "CVS/pharmacy",
            "block_bbox": [2, 1, 30, 6],
        },
        {
            "block_label": "image",
            "block_content": "ExtraCare",
            "block_bbox": [2, 6, 18, 10],
        },
        {
            "block_label": "text",
            "block_content": "SUBTOTAL          1.98",
            "block_bbox": [2, 11, 38, 14],
        },
        {
            "block_label": "table",
            "block_content": "1 SHAMPOO  4.49\n1 SOAP     2.00",
            "block_bbox": [2, 14, 38, 19],
        },
        {
            "block_label": "chart",
            "block_content": "should be ignored",
            "block_bbox": [0, 0, 4, 4],
        },
    )

    provider = PaddleOCRVLProvider(settings)
    monkeypatch.setattr(provider, "_predict", lambda image, timeout: [payload])
    result = provider.extract(_request())

    assert result.provider == "paddleocr_vl"
    assert result.model == "paddleocr-vl-v1.6"
    assert [line.text for line in result.lines] == [
        "CVS/pharmacy",
        "ExtraCare",
        "SUBTOTAL          1.98",
        "1 SHAMPOO  4.49",
        "1 SOAP     2.00",
    ]
    assert "SUBTOTAL          1.98" in result.text
    labels = [block["label"] for block in result.provider_metadata["blocks"]]
    assert labels == ["title", "image", "text", "table"]
    assert result.has_geometry
    assert not result.has_confidence


def test_html_table_becomes_lines() -> None:
    html = "<table><tr><td>TOTAL</td><td>3.60</td></tr><tr><td>CASH</td><td>5.00</td></tr></table>"
    assert _content_lines(html) == ["TOTAL 3.60", "CASH 5.00"]


def test_content_lines_do_not_collapse_column_gaps() -> None:
    assert _content_lines("TOTAL               3.60") == ["TOTAL               3.60"]


def test_box_from_xyxy_and_polygon() -> None:
    xyxy = _box([10, 20, 40, 50], page=0)
    assert xyxy is not None
    assert (xyxy.x, xyxy.y, xyxy.width, xyxy.height) == (10, 20, 30, 30)

    quad = _box([[10, 20], [40, 20], [40, 50], [10, 50]], page=1)
    assert quad is not None
    assert quad.page == 1
    assert (quad.x, quad.y, quad.width, quad.height) == (10, 20, 30, 30)

    assert _box(None, page=0) is None
    assert _box([1, 2], page=0) is None


def test_result_json_attribute_is_accepted(settings) -> None:
    page = SimpleNamespace(json={"parsing_res_list": [{"block_content": "Milk 2.50"}]})
    lines, _, _ = _normalise_pages([page], (10, 10, 3))
    assert [line.text for line in lines] == ["Milk 2.50"]


def test_object_blocks_are_read() -> None:
    """Live PaddleX blocks are objects with label/content/bbox, not dicts."""
    block = SimpleNamespace(label="title", content="GREENFIELD MARKET", bbox=[1, 2, 8, 9])
    lines, _, meta = _normalise_pages(
        [{"parsing_res_list": [block]}],
        (20, 40, 3),
    )
    assert [line.text for line in lines] == ["GREENFIELD MARKET"]
    assert meta[0]["label"] == "title"


def test_paddlex_res_wrapper_is_unwrapped() -> None:
    """Live PaddleX results are ``{'res': {parsing_res_list, ...}}``."""
    page = {
        "res": {
            "width": 40,
            "height": 20,
            "parsing_res_list": [{"block_label": "text", "block_content": "TOTAL 14.58"}],
        }
    }
    lines, _, meta = _normalise_pages([page], (20, 40, 3))
    assert [line.text for line in lines] == ["TOTAL 14.58"]
    assert meta[0]["label"] == "text"


def test_empty_result_is_ocr_empty(monkeypatch, settings) -> None:
    provider = PaddleOCRVLProvider(settings)
    monkeypatch.setattr(provider, "_predict", lambda image, timeout: [_page()])
    with pytest.raises(OCRError) as exc:
        provider.extract(_request())
    assert exc.value.code is ErrorCode.OCR_EMPTY_RESULT


def test_vendor_exception_is_normalised(monkeypatch, settings) -> None:
    provider = PaddleOCRVLProvider(settings)

    def _boom(image, timeout):
        raise RuntimeError("native paddle failure")

    monkeypatch.setattr(provider, "_predict", _boom)
    with pytest.raises(OCRError) as exc:
        provider.extract(_request())
    assert exc.value.code is ErrorCode.OCR_FAILED
    assert exc.value.details["error_type"] == "RuntimeError"


def test_timeout_is_retryable(monkeypatch, settings) -> None:
    provider = PaddleOCRVLProvider(settings)
    monkeypatch.setattr(provider, "_pipeline_instance", lambda: SimpleNamespace(predict=lambda image: None))

    def _never_finishes(target, kwargs=None, daemon=None, name=None):
        class _Alive:
            def start(self) -> None:
                return None

            def join(self, timeout: float | None = None) -> None:
                return None

            def is_alive(self) -> bool:
                return True

        return _Alive()

    monkeypatch.setattr("app.ocr.providers.paddleocr_vl.threading.Thread", _never_finishes)
    with pytest.raises(OCRTimeoutError) as exc:
        provider.extract(_request())
    assert exc.value.retryable


def test_missing_package_is_unavailable(monkeypatch, settings) -> None:
    provider = PaddleOCRVLProvider(settings)

    def _missing() -> None:
        raise ProviderUnavailableError(
            "paddleocr is not installed.",
            details={"provider": "paddleocr_vl"},
        )

    monkeypatch.setattr(provider, "_engine_class", _missing)
    with pytest.raises(ProviderUnavailableError):
        provider.extract(_request())


def test_describe_names_the_pipeline(settings) -> None:
    info = PaddleOCRVLProvider(settings).describe()
    assert info["provider"] == "paddleocr_vl"
    assert info["use_ocr_for_image_block"] is True
    assert info["use_seal_recognition"] is True
    assert info["max_long_edge"] == 1280


def test_long_edge_is_capped() -> None:
    image = np.zeros((3000, 1200, 3), np.uint8)
    capped = _limit_long_edge(image, 1280)
    assert capped.shape[0] == 1280
    assert capped.shape[1] == 512
    assert _limit_long_edge(image, 0).shape == image.shape
    assert _limit_long_edge(np.zeros((400, 300, 3), np.uint8), 1280).shape == (400, 300, 3)


def test_pipeline_settings_from_env(monkeypatch) -> None:
    from app.core.config import Settings

    monkeypatch.setenv("PADDLEOCR_VL_PIPELINE_VERSION", "v1.5")
    monkeypatch.setenv("PADDLEOCR_VL_DEVICE", "cpu")
    monkeypatch.setenv("PADDLEOCR_VL_USE_OCR_FOR_IMAGE_BLOCK", "false")
    settings = Settings(_env_file=None)
    assert settings.paddleocr_vl_pipeline_version == "v1.5"
    assert settings.paddleocr_vl_device == "cpu"
    assert settings.paddleocr_vl_use_ocr_for_image_block is False
