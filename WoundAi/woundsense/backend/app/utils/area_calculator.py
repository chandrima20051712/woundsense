"""
area_calculator.py — Convert wound mask pixel area to cm² using scale factor.
"""

import cv2
import numpy as np
import logging
from typing import Tuple, Optional

logger = logging.getLogger("woundsense.area")


def calculate_wound_area(
    mask: np.ndarray,
    px_per_mm: float,
) -> Tuple[float, float, Optional[Tuple[float, float]]]:
    """
    Calculate wound area and dimensions from binary mask + scale factor.

    Args:
        mask:       Binary wound mask (uint8, 255=wound)
        px_per_mm:  Pixels per millimetre from coin calibration

    Returns:
        area_cm2:   Wound area in cm²
        perimeter_cm: Wound perimeter in cm
        dimensions: (length_cm, width_cm) of bounding ellipse, or None
    """
    if px_per_mm <= 0:
        logger.error("Invalid px_per_mm — defaulting to 15")
        px_per_mm = 15.0

    px_per_cm = px_per_mm * 10.0
    px_per_cm2 = px_per_cm ** 2

    # Count wound pixels
    wound_pixel_count = int(np.sum(mask > 0))
    area_cm2 = wound_pixel_count / px_per_cm2

    # Perimeter from largest contour
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    perimeter_cm = 0.0
    dimensions = None

    if contours:
        largest = max(contours, key=cv2.contourArea)
        perimeter_px = cv2.arcLength(largest, True)
        perimeter_cm = perimeter_px / px_per_cm

        # Fit ellipse for length × width
        if len(largest) >= 5:
            try:
                ellipse = cv2.fitEllipse(largest)
                _, (minor, major), _ = ellipse
                length_cm = major / px_per_cm
                width_cm = minor / px_per_cm
                dimensions = (round(length_cm, 1), round(width_cm, 1))
            except cv2.error:
                pass

    logger.info(
        f"Area: {area_cm2:.2f}cm² | Perimeter: {perimeter_cm:.1f}cm | "
        f"Dims: {dimensions} | Scale: {px_per_mm:.1f}px/mm"
    )

    return round(area_cm2, 2), round(perimeter_cm, 1), dimensions


def compute_precision_mm(px_per_mm: float, coin_detected: bool) -> float:
    """
    Estimate measurement precision in mm based on calibration quality.
    With coin: ±4.8mm. Without coin (fallback scale): ±12mm.
    """
    if coin_detected:
        # Precision limited by HoughCircles radius accuracy (~2px at 15px/mm)
        return round(2.0 / px_per_mm, 1)
    return 12.0
