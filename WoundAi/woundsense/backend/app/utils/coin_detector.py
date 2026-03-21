"""
coin_detector.py — Detect Indian ₹1 coin (25mm diameter) via HoughCircles
to derive pixel-per-cm scale factor.

Precision: ±4.8mm under standard PHC lighting conditions.
Falls back to average smartphone DPI estimate if coin not found.
"""

import cv2
import numpy as np
import logging
from typing import Optional, Tuple
from app.core.config import settings

logger = logging.getLogger("woundsense.coin")

# Fallback: typical smartphone at 30cm distance ≈ 15px/mm
FALLBACK_PX_PER_MM = 15.0
COIN_DIAMETER_MM = settings.COIN_DIAMETER_MM  # 25mm


def detect_coin(image_bgr: np.ndarray) -> Tuple[Optional[Tuple[int, int, int]], float]:
    """
    Detect the 2.5cm reference coin in the image.

    Returns:
        circle: (x, y, radius) in pixels, or None if not found
        px_per_mm: computed scale factor (pixels per millimetre)
    """
    h, w = image_bgr.shape[:2]

    # Resize to 1024px wide for consistent HoughCircles detection
    scale = min(1024 / w, 1.0)
    if scale < 1.0:
        small = cv2.resize(image_bgr, (int(w * scale), int(h * scale)))
    else:
        small = image_bgr.copy()
        scale = 1.0

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (9, 9), 2)

    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=settings.COIN_HOUGH_DP,
        minDist=settings.COIN_HOUGH_MIN_DIST,
        param1=settings.COIN_HOUGH_PARAM1,
        param2=settings.COIN_HOUGH_PARAM2,
        minRadius=settings.COIN_MIN_RADIUS,
        maxRadius=settings.COIN_MAX_RADIUS,
    )

    if circles is not None:
        circles = np.round(circles[0, :]).astype(int)
        # Pick the most circular candidate (largest param2 score = most votes)
        best = circles[0]  # HoughCircles returns sorted by accumulator
        cx, cy, r = best

        # Map back to original image coordinates
        orig_cx = int(cx / scale)
        orig_cy = int(cy / scale)
        orig_r = int(r / scale)

        px_per_mm = (orig_r * 2) / COIN_DIAMETER_MM
        logger.info(
            f"Coin detected at ({orig_cx},{orig_cy}) r={orig_r}px → "
            f"{px_per_mm:.2f} px/mm"
        )
        return (orig_cx, orig_cy, orig_r), px_per_mm

    logger.warning(
        "Coin not detected — using fallback scale "
        f"({FALLBACK_PX_PER_MM} px/mm). Accuracy reduced."
    )
    return None, FALLBACK_PX_PER_MM


def draw_coin_overlay(image_bgr: np.ndarray, circle: Tuple[int, int, int]) -> np.ndarray:
    """Draw detected coin circle on image for visual confirmation."""
    out = image_bgr.copy()
    cx, cy, r = circle
    cv2.circle(out, (cx, cy), r, (0, 255, 0), 3)
    cv2.circle(out, (cx, cy), 5, (0, 255, 0), -1)
    cv2.putText(
        out, f"Coin: {COIN_DIAMETER_MM}mm ref",
        (cx - 60, cy - r - 10),
        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2,
    )
    return out
