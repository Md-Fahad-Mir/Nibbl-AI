"""PaddleOCR-VL provider.

Tesseract treats a receipt as one uniform text block. That is why stylised
logo type, mixed font sizes, and the wide gap between a label and its amount
are the first things it drops or glues together.

PaddleOCR-VL is a two-stage document parser: layout analysis labels every
region (title, text, table, image, seal, header, footer, ...) and a 0.9B VLM
reads each crop. The VLM returns the printed characters, including the
spaces the register used to align columns. Image / logo blocks are OCR'd
explicitly so a store mark is not discarded as decoration.

This provider only *reads*. Downstream extraction, arithmetic validation and
review routing stay unchanged -- the same contract as ``openai_vision``.

The ``paddleocr`` extra is optional. The rest of the suite stays importable
on hosts that have not installed PaddlePaddle.
"""

from __future__ import annotations

import re
import threading
import time
from typing import Any

import cv2
import numpy as np

from app.core.config import Settings
from app.core.exceptions import ErrorCode, OCRError, OCRTimeoutError, ProviderUnavailableError
from app.core.logging import get_logger
from app.ocr.base import OCRProvider, OCRRequest
from app.ocr.factory import register_provider
from app.schemas.ocr import OCRBox, OCRLine, OCRPage, OCRResult, TextOrientation

#: Layout labels that never carry receipt text even when the VLM returns a
#: caption. Charts and formulas are out of scope for this product.
_SKIP_LABELS = frozenset({"chart", "formula", "footnote"})

#: HTML table cells become spaces; row breaks become newlines.
_HTML_ROW = re.compile(r"</(?:tr|p|div|h[1-6])>", re.IGNORECASE)
_HTML_BR = re.compile(r"<br\s*/?>", re.IGNORECASE)
_HTML_TAG = re.compile(r"<[^>]+>")
_HTML_SPACE = re.compile(r"[ \t]+")

logger = get_logger(__name__)


@register_provider("paddleocr_vl")
class PaddleOCRVLProvider(OCRProvider):
    """Local document VLM via the official PaddleOCR-VL pipeline."""

    name = "paddleocr_vl"

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pipeline: Any = None
        self._lock = threading.Lock()
        self._init_lock = threading.Lock()

    # ------------------------------------------------------------- plumbing
    def _engine_class(self) -> Any:
        """Import ``PaddleOCRVL`` lazily so the package stays importable."""
        try:
            from paddleocr import PaddleOCRVL
        except ImportError as exc:
            raise ProviderUnavailableError(
                "paddleocr is not installed. Install paddlepaddle and "
                "`pip install 'paddleocr[doc-parser]'`, then set OCR_PROVIDER=paddleocr_vl.",
                details={"provider": self.name},
            ) from exc
        return PaddleOCRVL

    def _pipeline_instance(self) -> Any:
        """Build the pipeline once. Construction downloads models on first use."""
        if self._pipeline is not None:
            return self._pipeline
        with self._init_lock:
            if self._pipeline is not None:
                return self._pipeline
            return self._build_pipeline()

    def _build_pipeline(self) -> Any:
        kwargs: dict[str, Any] = {
            "pipeline_version": self._settings.paddleocr_vl_pipeline_version,
            "use_layout_detection": self._settings.paddleocr_vl_use_layout_detection,
            "use_ocr_for_image_block": self._settings.paddleocr_vl_use_ocr_for_image_block,
            "use_seal_recognition": self._settings.paddleocr_vl_use_seal_recognition,
            "use_doc_orientation_classify": (
                self._settings.paddleocr_vl_use_doc_orientation_classify
            ),
            "use_doc_unwarping": self._settings.paddleocr_vl_use_doc_unwarping,
            # Receipt headers and item counts are load-bearing. The pipeline
            # default drops header/footer/number from Markdown; we read
            # parsing_res_list ourselves and still clear this so nothing is
            # silently discarded upstream.
            "markdown_ignore_labels": [],
        }
        if self._settings.paddleocr_vl_device:
            kwargs["device"] = self._settings.paddleocr_vl_device
        if self._settings.paddleocr_vl_engine:
            kwargs["engine"] = self._settings.paddleocr_vl_engine
        if self._settings.paddleocr_vl_vl_rec_backend:
            kwargs["vl_rec_backend"] = self._settings.paddleocr_vl_vl_rec_backend
        if self._settings.paddleocr_vl_vl_rec_server_url:
            kwargs["vl_rec_server_url"] = self._settings.paddleocr_vl_vl_rec_server_url
        if self._settings.paddleocr_vl_vl_rec_api_model_name:
            kwargs["vl_rec_api_model_name"] = self._settings.paddleocr_vl_vl_rec_api_model_name
        api_key = self._settings.paddleocr_vl_vl_rec_api_key.get_secret_value()
        if api_key:
            kwargs["vl_rec_api_key"] = api_key

        try:
            self._pipeline = self._engine_class()(**kwargs)
        except ProviderUnavailableError:
            raise
        except Exception as exc:
            raise ProviderUnavailableError(
                "PaddleOCR-VL pipeline failed to initialise.",
                details={"provider": self.name, "error_type": type(exc).__name__},
            ) from exc
        return self._pipeline

    # --------------------------------------------------------------- public
    def health_check(self) -> tuple[bool, str | None]:
        try:
            self._engine_class()
        except ProviderUnavailableError as exc:
            return False, exc.message
        return True, None

    def warmup(self) -> None:
        """Load layout + VLM weights so the first receipt is not a 3-minute wait."""
        self._pipeline_instance()

    def describe(self) -> dict[str, Any]:
        return {
            "provider": self.name,
            "model": self._model_id(),
            "pipeline_version": self._settings.paddleocr_vl_pipeline_version,
            "device": self._settings.paddleocr_vl_device or "auto",
            "use_ocr_for_image_block": self._settings.paddleocr_vl_use_ocr_for_image_block,
            "use_seal_recognition": self._settings.paddleocr_vl_use_seal_recognition,
            "use_layout_detection": self._settings.paddleocr_vl_use_layout_detection,
            "max_long_edge": self._settings.paddleocr_vl_max_long_edge,
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

        lines, ocr_pages, block_meta = _normalise_pages(pages, image.shape)
        result = OCRResult(
            text="\n".join(line.text for line in lines),
            lines=lines,
            pages=tuple(ocr_pages),
            provider=self.name,
            model=self._model_id(),
            languages=request.languages,
            provider_metadata={
                "pipeline_version": self._settings.paddleocr_vl_pipeline_version,
                "blocks": block_meta,
            },
        )
        if result.is_empty:
            raise OCRError(
                "OCR produced no readable text.",
                code=ErrorCode.OCR_EMPTY_RESULT,
                details={"provider": self.name},
            )
        return result

    # -------------------------------------------------------------- helpers
    def _model_id(self) -> str:
        return f"paddleocr-vl-{self._settings.paddleocr_vl_pipeline_version}"

    def _predict(self, image: np.ndarray, timeout_seconds: float) -> list[Any]:
        """Run the pipeline under a lock, aborting after ``timeout_seconds``.

        Weights are loaded *before* the timer starts. Counting the 0.9B load
        against the same budget as inference made the first CPU request time
        out at 300s even though a warmed run of the sample receipt finishes
        in about three minutes.

        PaddleX's ``predict`` has no native timeout. A daemon thread plus
        ``join`` is the same shape as pytesseract's own timeout: the worker
        may keep running after we raise, but the request is not held open.
        """
        pipeline = self._pipeline_instance()
        box: dict[str, Any] = {}
        height, width = image.shape[:2]
        started = time.perf_counter()
        logger.info(
            "paddleocr_vl_predict_start",
            width=width,
            height=height,
            timeout_seconds=timeout_seconds,
        )

        def _run() -> None:
            try:
                box["value"] = pipeline.predict(image)
            except Exception as exc:
                box["error"] = exc

        worker = threading.Thread(target=_run, daemon=True, name="paddleocr-vl-predict")
        with self._lock:
            worker.start()
            worker.join(timeout_seconds)
        if worker.is_alive():
            raise OCRTimeoutError(
                "OCR timed out.",
                details={
                    "provider": self.name,
                    "timeout_seconds": timeout_seconds,
                },
            )
        if "error" in box:
            raise box["error"]
        logger.info(
            "paddleocr_vl_predict_done",
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


def _limit_long_edge(image: np.ndarray, max_long_edge: int) -> np.ndarray:
    """Downscale so the VLM is not asked to read a 12MP phone photo crop-by-crop."""
    if max_long_edge <= 0:
        return image
    height, width = image.shape[:2]
    long_edge = max(height, width)
    if long_edge <= max_long_edge:
        return image
    scale = max_long_edge / long_edge
    return cv2.resize(
        image,
        (max(1, int(width * scale)), max(1, int(height * scale))),
        interpolation=cv2.INTER_AREA,
    )


def _to_bgr(image: np.ndarray) -> np.ndarray:
    """Give the VLM a 3-channel image; grayscale logos still keep their glyphs."""
    if image.ndim == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    if image.ndim == 3 and image.shape[2] == 4:
        return cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
    return np.ascontiguousarray(image)


def _normalise_pages(
    pages: list[Any], image_shape: tuple[int, ...]
) -> tuple[tuple[OCRLine, ...], list[OCRPage], list[dict[str, Any]]]:
    """Turn native PaddleOCR-VL pages into the unified OCR schema."""
    height = int(image_shape[0]) if image_shape else 0
    width = int(image_shape[1]) if len(image_shape) > 1 else 0
    lines: list[OCRLine] = []
    ocr_pages: list[OCRPage] = []
    block_meta: list[dict[str, Any]] = []

    if not pages:
        return (), [], []

    for page_index, page in enumerate(pages):
        payload = _page_payload(page)
        page_width = _as_int(payload.get("width"), width)
        page_height = _as_int(payload.get("height"), height)
        page_lines: list[OCRLine] = []
        for block in _blocks(payload):
            label = str(block.get("block_label") or block.get("label") or "text").lower()
            if label in _SKIP_LABELS:
                continue
            content = block.get("block_content", block.get("content", ""))
            bbox = _box(block.get("block_bbox", block.get("bbox")), page=page_index)
            start = len(lines)
            for text in _content_lines(content):
                line = OCRLine(text=text, confidence=None, bbox=bbox, page=page_index)
                lines.append(line)
                page_lines.append(line)
            if len(lines) > start:
                block_meta.append(
                    {
                        "label": label,
                        "line_start": start,
                        "line_end": len(lines),
                    }
                )
        ocr_pages.append(
            OCRPage(
                page_number=page_index,
                width=page_width or None,
                height=page_height or None,
                orientation=TextOrientation.ROTATE_0,
                lines=tuple(page_lines),
            )
        )

    return tuple(lines), ocr_pages, block_meta


def _page_payload(page: Any) -> dict[str, Any]:
    """Accept a dict, a PaddleX Result, or an object with parsing_res_list."""
    payload: dict[str, Any] | None = None
    if isinstance(page, dict):
        payload = page
    else:
        json_attr = getattr(page, "json", None)
        if callable(json_attr):
            raw = json_attr()
            if isinstance(raw, dict):
                payload = raw
        elif isinstance(json_attr, dict):
            payload = json_attr
        elif getattr(page, "parsing_res_list", None) is not None:
            payload = {"parsing_res_list": page.parsing_res_list}
    if payload is None:
        raise OCRError(
            "OCR engine returned an unrecognised page payload.",
            details={"provider": "paddleocr_vl", "payload_type": type(page).__name__},
        )
    # PaddleX wraps the page as {"res": {...actual fields...}}.
    inner = payload.get("res")
    if "parsing_res_list" not in payload and isinstance(inner, dict):
        return inner
    return payload


def _blocks(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw = payload.get("parsing_res_list") or payload.get("parsing_res") or ()
    blocks = [block for item in raw if (block := _block_dict(item)) is not None]
    if blocks:
        return blocks
    markdown = payload.get("markdown")
    if isinstance(markdown, dict):
        text = markdown.get("markdown_texts") or markdown.get("markdown_text") or ""
        if text:
            return [{"block_label": "text", "block_content": str(text), "block_bbox": None}]
    return []


def _block_dict(item: object) -> dict[str, Any] | None:
    """Normalise a PaddleX block object or an already-plain dict."""
    if isinstance(item, dict):
        return item
    label = getattr(item, "label", None) or getattr(item, "block_label", None)
    content = getattr(item, "content", None)
    if content is None:
        content = getattr(item, "block_content", None)
    bbox = getattr(item, "bbox", None)
    if bbox is None:
        bbox = getattr(item, "block_bbox", None)
    if label is None and content is None:
        return None
    return {
        "block_label": label or "text",
        "block_content": "" if content is None else content,
        "block_bbox": bbox,
    }


def _content_lines(content: object) -> list[str]:
    """Split a block into receipt lines without collapsing inter-word spaces.

    The VLM already reconstructed the printed spacing. Collapsing it here
    would undo the reason this provider exists.
    """
    text = "" if content is None else str(content)
    if not text.strip():
        return []
    if "<" in text and ">" in text:
        text = _HTML_BR.sub("\n", text)
        text = _HTML_ROW.sub("\n", text)
        text = _HTML_TAG.sub(" ", text)
        text = _HTML_SPACE.sub(" ", text)
    lines: list[str] = []
    for raw in text.replace("\r\n", "\n").split("\n"):
        # Keep internal spaces; trim only the edges so a blank pad is not a line.
        cleaned = raw.strip()
        if cleaned:
            lines.append(cleaned)
    return lines


def _box(raw: object, *, page: int) -> OCRBox | None:
    """Accept ``[x1, y1, x2, y2]``, a quad, or a polygon; never invent a box."""
    if raw is None:
        return None
    try:
        coords = np.asarray(raw, dtype=float).reshape(-1)
    except (TypeError, ValueError):
        return None
    if coords.size < 4:
        return None
    xs = coords[0::2]
    ys = coords[1::2]
    x1, y1 = int(np.floor(xs.min())), int(np.floor(ys.min()))
    x2, y2 = int(np.ceil(xs.max())), int(np.ceil(ys.max()))
    return OCRBox(
        x=max(0, x1),
        y=max(0, y1),
        width=max(0, x2 - x1),
        height=max(0, y2 - y1),
        page=page,
    )


def _as_int(value: object, default: int) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
