"""PP-OCRv5 provider.

PaddleOCR-VL's 0.9B reader is accurate on receipts and unusable on CPU: a
phone photo is minutes of per-crop inference. PP-OCRv5 is the same Paddle
stack without the VLM — detection plus recognition in a few seconds.

This provider only *reads*. Downstream extraction is unchanged.
"""

from __future__ import annotations

import threading
import time
from typing import Any

import numpy as np

from app.core.config import Settings
from app.core.exceptions import ErrorCode, OCRError, OCRTimeoutError, ProviderUnavailableError
from app.core.logging import get_logger
from app.ocr.base import OCRProvider, OCRRequest
from app.ocr.factory import register_provider
from app.ocr.providers.paddleocr_vl import _box, _limit_long_edge, _to_bgr
from app.schemas.ocr import OCRLine, OCRPage, OCRResult, TextOrientation

logger = get_logger(__name__)

_LANG = {
    "eng": "en",
    "en": "en",
    "chi_sim": "ch",
    "ch": "ch",
    "chinese_cht": "chinese_cht",
    "jpn": "japan",
    "japan": "japan",
    "kor": "korean",
    "korean": "korean",
    "fra": "fr",
    "fr": "fr",
    "deu": "german",
    "german": "german",
    "spa": "es",
    "es": "es",
    "ara": "ar",
    "ar": "ar",
    "hin": "hi",
    "hi": "hi",
}


@register_provider("paddleocr")
class PaddleOCRProvider(OCRProvider):
    """Local recognition via PP-OCRv5 (no vision-language model)."""

    name = "paddleocr"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pipeline: Any = None
        self._lock = threading.Lock()
        self._init_lock = threading.Lock()

    def _engine_class(self) -> Any:
        import os

        os.environ.setdefault("FLAGS_use_mkldnn", "0")
        os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
        try:
            import paddle

            paddle.set_flags({"FLAGS_use_mkldnn": False})
        except Exception:
            pass
        try:
            from paddleocr import PaddleOCR
        except ImportError as exc:
            raise ProviderUnavailableError(
                "paddleocr is not installed. Install paddlepaddle and paddleocr, "
                "then set OCR_PROVIDER=paddleocr.",
                details={"provider": self.name},
            ) from exc
        return PaddleOCR

    def _pipeline_instance(self) -> Any:
        if self._pipeline is not None:
            return self._pipeline
        with self._init_lock:
            if self._pipeline is not None:
                return self._pipeline
            return self._build_pipeline()

    def _lang(self) -> str:
        code = (self._settings.ocr_languages or ("eng",))[0].strip().lower()
        return _LANG.get(code, "en")

    def _build_pipeline(self) -> Any:
        kwargs: dict[str, Any] = {
            "lang": self._lang(),
            "ocr_version": self._settings.paddleocr_ocr_version,
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
            "enable_mkldnn": False,
            "text_detection_model_name": "PP-OCRv5_mobile_det",
        }
        device = self._settings.paddleocr_device or self._settings.paddleocr_vl_device
        if device:
            kwargs["device"] = device
        try:
            self._pipeline = self._engine_class()(**kwargs)
        except ProviderUnavailableError:
            raise
        except Exception as exc:
            raise ProviderUnavailableError(
                "PaddleOCR pipeline failed to initialise.",
                details={"provider": self.name, "error_type": type(exc).__name__},
            ) from exc
        return self._pipeline

    def health_check(self) -> tuple[bool, str | None]:
        try:
            self._engine_class()
        except ProviderUnavailableError as exc:
            return False, exc.message
        return True, None

    def warmup(self) -> None:
        self._pipeline_instance()

    def describe(self) -> dict[str, Any]:
        return {
            "provider": self.name,
            "model": self._settings.paddleocr_ocr_version,
            "lang": self._lang(),
            "device": self._settings.paddleocr_device
            or self._settings.paddleocr_vl_device
            or "auto",
        }

    def extract(self, request: OCRRequest) -> OCRResult:
        image = _limit_long_edge(
            _to_bgr(request.image),
            self._settings.paddleocr_vl_max_long_edge,
        )
        try:
            pages = self._predict(image, request.timeout_seconds)
        except OCRTimeoutError:
            raise
        except ProviderUnavailableError:
            raise
        except Exception as exc:
            raise OCRError(
                "OCR engine failed.",
                details={"provider": self.name, "error_type": type(exc).__name__},
            ) from exc

        lines, ocr_pages = _normalise_pages(pages, image.shape)
        result = OCRResult(
            text="\n".join(line.text for line in lines),
            lines=lines,
            pages=tuple(ocr_pages),
            provider=self.name,
            model=self._settings.paddleocr_ocr_version,
            languages=request.languages,
        )
        if result.is_empty:
            raise OCRError(
                "OCR produced no readable text.",
                code=ErrorCode.OCR_EMPTY_RESULT,
                details={"provider": self.name},
            )
        return result

    def _predict(self, image: np.ndarray, timeout_seconds: float) -> list[Any]:
        pipeline = self._pipeline_instance()
        box: dict[str, Any] = {}
        height, width = image.shape[:2]
        started = time.perf_counter()
        logger.info(
            "paddleocr_predict_start",
            width=width,
            height=height,
            timeout_seconds=timeout_seconds,
        )

        def _run() -> None:
            try:
                box["value"] = pipeline.predict(image)
            except Exception as exc:
                box["error"] = exc

        worker = threading.Thread(target=_run, daemon=True, name="paddleocr-predict")
        with self._lock:
            worker.start()
            worker.join(timeout_seconds)
        if worker.is_alive():
            raise OCRTimeoutError(
                "OCR timed out.",
                details={"provider": self.name, "timeout_seconds": timeout_seconds},
            )
        if "error" in box:
            raise box["error"]
        logger.info(
            "paddleocr_predict_done",
            width=width,
            height=height,
            duration_ms=round((time.perf_counter() - started) * 1000, 1),
        )
        value = box.get("value")
        if value is None:
            return []
        if isinstance(value, list):
            return value
        return [value]


def _page_payload(page: Any) -> dict[str, Any]:
    if isinstance(page, dict):
        payload = page
    else:
        json_attr = getattr(page, "json", None)
        if callable(json_attr):
            raw = json_attr()
            payload = raw if isinstance(raw, dict) else {}
        elif isinstance(json_attr, dict):
            payload = json_attr
        else:
            payload = {}
    inner = payload.get("res")
    if isinstance(inner, dict) and "rec_texts" not in payload:
        return inner
    return payload


def _normalise_pages(
    pages: list[Any], image_shape: tuple[int, ...]
) -> tuple[tuple[OCRLine, ...], list[OCRPage]]:
    height = int(image_shape[0]) if image_shape else 0
    width = int(image_shape[1]) if len(image_shape) > 1 else 0
    lines: list[OCRLine] = []
    ocr_pages: list[OCRPage] = []
    if not pages:
        return (), []

    for page_index, page in enumerate(pages):
        payload = _page_payload(page)
        texts = list(payload.get("rec_texts") or ())
        scores = list(payload.get("rec_scores") or ())
        polys = list(payload.get("rec_polys") or payload.get("rec_boxes") or ())
        page_lines: list[OCRLine] = []
        for index, text in enumerate(texts):
            cleaned = str(text).strip() if text is not None else ""
            if not cleaned:
                continue
            score = scores[index] if index < len(scores) else None
            confidence = None if score is None else float(score)
            poly = polys[index] if index < len(polys) else None
            line = OCRLine(
                text=cleaned,
                confidence=confidence,
                bbox=_box(poly, page=page_index),
                page=page_index,
            )
            page_lines.append(line)
        page_lines.sort(
            key=lambda line: (
                line.bbox.y if line.bbox is not None else 0,
                line.bbox.x if line.bbox is not None else 0,
            )
        )
        lines.extend(page_lines)
        ocr_pages.append(
            OCRPage(
                page_number=page_index,
                width=width or None,
                height=height or None,
                orientation=TextOrientation.ROTATE_0,
                lines=tuple(page_lines),
            )
        )
    return tuple(lines), ocr_pages
