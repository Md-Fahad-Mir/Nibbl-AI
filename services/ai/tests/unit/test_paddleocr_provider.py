"""PP-OCRv5 provider tests. The live engine is stubbed."""

from __future__ import annotations

from types import SimpleNamespace

import numpy as np
import pytest

from app.core.exceptions import ErrorCode, OCRError, ProviderUnavailableError
from app.ocr.base import OCRRequest
from app.ocr.factory import available_providers, create_ocr_provider
from app.ocr.providers.paddleocr import PaddleOCRProvider, _normalise_pages


def _request() -> OCRRequest:
    return OCRRequest(image=np.zeros((20, 40, 3), np.uint8), timeout_seconds=2.0)


def test_provider_is_registered() -> None:
    assert "paddleocr" in available_providers()


def test_factory_builds_the_provider(make_settings) -> None:
    settings = make_settings(ocr_provider="paddleocr")
    provider = create_ocr_provider(settings=settings)
    assert provider.name == "paddleocr"


def test_rec_texts_become_lines(monkeypatch, settings) -> None:
    payload = {
        "rec_texts": ["Walmart", "TOTAL 46.42"],
        "rec_scores": [0.99, 0.95],
        "rec_boxes": [[1, 1, 20, 8], [1, 10, 30, 18]],
    }
    provider = PaddleOCRProvider(settings)
    monkeypatch.setattr(provider, "_predict", lambda image, timeout: [payload])
    result = provider.extract(_request())
    assert [line.text for line in result.lines] == ["Walmart", "TOTAL 46.42"]
    assert result.lines[0].confidence == pytest.approx(0.99)
    assert result.provider == "paddleocr"


def test_empty_result_is_ocr_empty(monkeypatch, settings) -> None:
    provider = PaddleOCRProvider(settings)
    monkeypatch.setattr(provider, "_predict", lambda image, timeout: [{"rec_texts": []}])
    with pytest.raises(OCRError) as exc:
        provider.extract(_request())
    assert exc.value.code is ErrorCode.OCR_EMPTY_RESULT


def test_missing_package_is_unavailable(monkeypatch, settings) -> None:
    provider = PaddleOCRProvider(settings)

    def _missing() -> None:
        raise ProviderUnavailableError(
            "paddleocr is not installed.",
            details={"provider": "paddleocr"},
        )

    monkeypatch.setattr(provider, "_engine_class", _missing)
    with pytest.raises(ProviderUnavailableError):
        provider.extract(_request())


def test_res_wrapper_is_unwrapped() -> None:
    page = SimpleNamespace(
        json={"res": {"rec_texts": ["SUBTOTAL 44.04"], "rec_scores": [0.9], "rec_polys": []}}
    )
    lines, _ = _normalise_pages([page], (20, 40, 3))
    assert [line.text for line in lines] == ["SUBTOTAL 44.04"]
