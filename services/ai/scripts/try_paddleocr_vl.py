#!/usr/bin/env python
"""Run PaddleOCR-VL on a sample receipt so you can see the live read.

Usage::

    python scripts/try_paddleocr_vl.py
    python scripts/try_paddleocr_vl.py path/to/receipt.jpg

The first run downloads the layout + VLM weights (a few GB) and on CPU can
take several minutes. Later runs reuse the cache.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

SAMPLE = REPO_ROOT / "data" / "samples" / "receipt_grocery_us.png"


def _write_sample(path: Path) -> Path:
    """Draw the documented synthetic grocery receipt if it is missing."""
    path.parent.mkdir(parents=True, exist_ok=True)
    image = np.full((1100, 700, 3), 250, dtype=np.uint8)
    y = 70
    cv2.putText(
        image, "GREENFIELD MARKET", (70, y), cv2.FONT_HERSHEY_SIMPLEX, 1.15, (20, 20, 20), 3
    )
    y += 50
    cv2.putText(image, "412 Oak Street", (70, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (40, 40, 40), 2)
    y += 36
    cv2.putText(
        image, "Springfield, IL 62704", (70, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (40, 40, 40), 2
    )
    y += 50
    cv2.putText(
        image, "2026-03-12  14:22", (70, y), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (40, 40, 40), 2
    )
    y += 70
    rows = (
        ("Organic Milk 1gal", "4.50"),
        ("Sourdough Bread", "3.25"),
        ("Free Range Eggs", "5.75"),
    )
    for name, price in rows:
        cv2.putText(image, name, (70, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2)
        cv2.putText(image, price, (520, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (20, 20, 20), 2)
        y += 48
    y += 30
    cv2.putText(image, "SUBTOTAL", (70, y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (20, 20, 20), 2)
    cv2.putText(image, "13.50", (520, y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (20, 20, 20), 2)
    y += 48
    cv2.putText(image, "TAX 8%", (70, y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (20, 20, 20), 2)
    cv2.putText(image, "1.08", (520, y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (20, 20, 20), 2)
    y += 48
    cv2.putText(image, "TOTAL", (70, y), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (10, 10, 10), 3)
    cv2.putText(image, "14.58", (500, y), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (10, 10, 10), 3)
    y += 80
    cv2.putText(
        image, "VISA ************4321", (70, y), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (40, 40, 40), 2
    )
    if not cv2.imwrite(str(path), image):
        raise SystemExit(f"Could not write sample receipt to {path}")
    return path


def _load_bgr(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise SystemExit(f"Could not read image: {path}")
    return image


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "image",
        nargs="?",
        type=Path,
        help="Receipt image. Defaults to the synthetic grocery sample.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=300.0,
        help="Seconds to wait for the first (model-download) run. Default 300.",
    )
    args = parser.parse_args()

    from app.core.config import Settings
    from app.ocr.base import OCRRequest
    from app.ocr.providers.paddleocr_vl import PaddleOCRVLProvider

    image_path = args.image or SAMPLE
    if not image_path.exists():
        if args.image is not None:
            raise SystemExit(f"Image not found: {image_path}")
        print(f"Writing sample receipt to {image_path}")
        _write_sample(image_path)

    settings = Settings(
        _env_file=str(REPO_ROOT / ".env") if (REPO_ROOT / ".env").exists() else None,
        ocr_provider="paddleocr_vl",
        paddleocr_vl_device="cpu",
        log_level="INFO",
    )
    provider = PaddleOCRVLProvider(settings)
    ready, detail = provider.health_check()
    if not ready:
        print(detail or "PaddleOCR-VL is not installed.", file=sys.stderr)
        print(
            "In the Python 3.12 venv run:\n"
            "  pip install paddlepaddle==3.3.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/\n"
            '  pip install -U "paddleocr[doc-parser]"',
            file=sys.stderr,
        )
        return 1

    print(f"Running PaddleOCR-VL on {image_path} (timeout {args.timeout:.0f}s)...")
    result = provider.extract(OCRRequest(image=_load_bgr(image_path), timeout_seconds=args.timeout))
    print()
    print(f"model: {result.model}")
    print(f"lines: {len(result.lines)}")
    blocks = result.provider_metadata.get("blocks") or []
    if blocks:
        print("layout:", ", ".join(sorted({str(block.get("label")) for block in blocks})))
    print()
    print(result.text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
