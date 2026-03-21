"""
tissue_classifier.py — HSV-based tissue classification within wound mask.
Classifies wound bed pixels into:
  • Granulation tissue (red/pink) — healthy healing
  • Slough (yellow/cream)         — needs debridement
  • Necrotic tissue (dark/black)  — critical debridement needed
  • Epithelialisation (pale pink) — near-healed

TIME Framework scoring (Wound Bed Preparation 2002):
  T — Tissue: non-viable tissue present
  I — Infection/Inflammation
  M — Moisture imbalance
  E — Edge/Epithelial advancement
"""

import cv2
import numpy as np
import logging
from typing import Dict, Tuple
from dataclasses import dataclass

logger = logging.getLogger("woundsense.tissue")


@dataclass
class TissueResult:
    tissue_ratios: Dict[str, int]    # percentages summing to 100
    time_scores: Dict[str, float]    # 0.0–1.0 for each TIME dimension
    recommendations: list
    wound_condition: str             # summary label


# HSV thresholds calibrated on wound atlas images (PHC ambient lighting)
TISSUE_THRESHOLDS = {
    "granulation": {
        "h_range": [(0, 20), (160, 180)],
        "s_min": 80, "s_max": 255,
        "v_min": 80, "v_max": 255,
    },
    "slough": {
        "h_range": [(15, 45)],
        "s_min": 20, "s_max": 200,
        "v_min": 120, "v_max": 255,
    },
    "necrotic": {
        "h_range": [(0, 180)],
        "s_min": 0,  "s_max": 255,
        "v_min": 0,  "v_max": 80,   # raised from 50 to catch more dark tissue
    },
    "epithelial": {
        "h_range": [(140, 175)],
        "s_min": 10, "s_max": 60,
        "v_min": 160, "v_max": 255,
    },
}


def classify_wound_pixels(
    image_bgr: np.ndarray,
    mask: np.ndarray,
) -> Dict[str, int]:
    """
    Classify wound-bed pixels using HSV colour thresholds.

    Returns dict of tissue type → percentage (sum ≤ 100; remainder = "other")
    """
    # Extract pixels inside wound mask
    wound_pixels_bgr = image_bgr[mask > 0]

    if len(wound_pixels_bgr) == 0:
        return {"granulation": 33, "slough": 33, "necrotic": 34, "epithelial": 0}

    # Convert to HSV
    wound_block = wound_pixels_bgr.reshape(1, -1, 3)
    hsv_block = cv2.cvtColor(wound_block, cv2.COLOR_BGR2HSV)
    hsv = hsv_block[0]  # (N, 3)
    h, s, v = hsv[:, 0], hsv[:, 1], hsv[:, 2]
    n = len(h)

    counts = {}
    for tissue, thresh in TISSUE_THRESHOLDS.items():
        h_mask = np.zeros(n, dtype=bool)
        for h_lo, h_hi in thresh["h_range"]:
            h_mask |= (h >= h_lo) & (h <= h_hi)

        pixel_mask = (
            h_mask
            & (s >= thresh["s_min"]) & (s <= thresh["s_max"])
            & (v >= thresh["v_min"]) & (v <= thresh["v_max"])
        )
        counts[tissue] = int(pixel_mask.sum())

    total_classified = sum(counts.values()) or 1
    ratios = {t: round(c / n * 100) for t, c in counts.items()}

    # Ensure sum ≤ 100 (rounding artefacts)
    total = sum(ratios.values())
    if total > 100:
        # Reduce largest category proportionally
        biggest = max(ratios, key=ratios.get)
        ratios[biggest] -= total - 100

    logger.info(f"Tissue ratios: {ratios}")
    return ratios


def score_time(tissue_ratios: Dict[str, int], image_bgr: np.ndarray, mask: np.ndarray) -> Dict[str, float]:
    """
    Compute TIME framework scores from tissue ratios + image features.

    T (Tissue viability):  proportion of necrotic + slough tissue
    I (Infection):         perilesional erythema heuristic (outer ring analysis)
    M (Moisture):          wound surface reflectance / exudate estimate
    E (Edge):              regularity of wound contour
    """
    gran = tissue_ratios.get("granulation", 0)
    slough = tissue_ratios.get("slough", 0)
    necrotic = tissue_ratios.get("necrotic", 0)
    epithelial = tissue_ratios.get("epithelial", 0)

    # T score: higher = worse tissue (more non-viable)
    # T score: more sensitive to necrotic and slough tissue
    t_score = min(1.0, (slough * 0.7 + necrotic * 1.2) / 100)
    t_score = max(t_score, min(0.8, necrotic / 30))  # boost if significant necrotic

    # I score: detect perilesional erythema (outer 15% of wound bounding box)
    i_score = _score_infection(image_bgr, mask)

    # M score: surface gloss proxy (high V channel variance = wet/exudate)
    m_score = _score_moisture(image_bgr, mask)

    # E score: contour irregularity (fractal-ish complexity)
    e_score = _score_edge(mask)

    scores = {
        "T": round(t_score, 2),
        "I": round(i_score, 2),
        "M": round(m_score, 2),
        "E": round(e_score, 2),
    }
    logger.info(f"TIME scores: {scores}")
    return scores


def _score_infection(image_bgr: np.ndarray, mask: np.ndarray) -> float:
    """Perilesional erythema proxy: redness in 10px dilation ring around wound."""
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21))
    dilated = cv2.dilate(mask, kernel)
    ring = cv2.subtract(dilated, mask)

    if ring.sum() == 0:
        return 0.1

    ring_pixels = image_bgr[ring > 0]
    hsv = cv2.cvtColor(ring_pixels.reshape(1, -1, 3), cv2.COLOR_BGR2HSV)[0]

    # Erythema: reddish hue AND high saturation AND not too dark
    # Thresholds tuned to distinguish true erythema from normal skin/blood
    red_mask = (
        ((hsv[:, 0] <= 8) | (hsv[:, 0] >= 172)) &   # very tight hue range (true red only)
        (hsv[:, 1] > 140) &                          # high saturation (exclude skin tones)
        (hsv[:, 2] > 100) &                          # brighter pixels only
        (hsv[:, 2] < 240)                            # exclude overexposed areas
    )

    red_ratio = float(red_mask.mean())

    # Scoring bands — requires >20% strongly red pixels to score high
    if red_ratio < 0.10:
        return 0.1   # normal skin
    elif red_ratio < 0.20:
        return 0.25  # mild redness
    elif red_ratio < 0.35:
        return 0.50  # moderate inflammation
    elif red_ratio < 0.50:
        return 0.75  # significant erythema
    else:
        return 0.95  # severe erythema


def _score_moisture(image_bgr: np.ndarray, mask: np.ndarray) -> float:
    """Moisture proxy: V-channel (brightness) variance within wound bed."""
    if mask.sum() == 0:
        return 0.3
    wound_pixels = image_bgr[mask > 0]
    hsv = cv2.cvtColor(wound_pixels.reshape(1, -1, 3), cv2.COLOR_BGR2HSV)[0]
    v_std = float(np.std(hsv[:, 2])) / 128.0  # normalise 0–1 range
    return min(1.0, v_std * 1.5)


def _score_edge(mask: np.ndarray) -> float:
    """Edge regularity: compare contour perimeter² / area (isoperimetric ratio)."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return 0.5
    c = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(c)
    perimeter = cv2.arcLength(c, True)
    if area < 1:
        return 0.5
    # Circle = 4π ≈ 12.57. Higher ratio = more irregular = worse edge
    ratio = perimeter ** 2 / area
    # Normalise: circle=12.57, irregular wound ~60–200
    score = min(1.0, max(0.0, (ratio - 12.57) / 150))
    return round(score, 2)


def generate_recommendations(
    tissue_ratios: Dict[str, int],
    time_scores: Dict[str, float],
    wound_area_cm2: float,
) -> Tuple[list, str]:
    """
    Generate nurse-facing clinical recommendations based on TIME scores.
    Guidelines align with WBP 2002 and NICE wound care pathway.
    """
    recs = []
    necrotic = tissue_ratios.get("necrotic", 0)
    slough = tissue_ratios.get("slough", 0)
    gran = tissue_ratios.get("granulation", 0)

    # Tissue
    if necrotic > 20:
        recs.append("⚠️ Debride necrotic tissue urgently — refer to wound care specialist")
    elif necrotic > 5:
        recs.append("Debride necrotic tissue — enzymatic or autolytic debridement")
    if slough > 30:
        recs.append("Remove slough — consider hydrogel or hydrocolloid dressing")

    # Infection
    if time_scores["I"] > 0.6:
        recs.append("🔴 Signs of perilesional inflammation — swab wound, consider antibiotics")
    elif time_scores["I"] > 0.35:
        recs.append("Monitor for infection — increased dressing frequency recommended")

    # Moisture
    if time_scores["M"] > 0.7:
        recs.append("Excess moisture/exudate detected — use absorbent foam dressing")
    elif time_scores["M"] < 0.2:
        recs.append("Wound appears dry — apply moisture-retaining dressing (hydrogel)")
    else:
        recs.append("Moisture balanced — continue current dressing regimen")

    # Edge
    if time_scores["E"] > 0.6:
        recs.append("Irregular wound edges — assess for undermining; consider skin graft referral")

    # Area-based
    if wound_area_cm2 > 25:
        recs.append("Large wound (>25cm²) — daily review; consider compression therapy if leg ulcer")

    # Positive
    if gran > 50 and time_scores["I"] < 0.3:
        recs.append("✅ Good granulation — wound healing well; maintain current care")

    if not recs:
        recs.append("✅ Wound appears stable — continue standard dressing protocol")

    # Overall condition label
    if necrotic > 20 or time_scores["I"] > 0.6:
        condition = "Critical — Immediate Attention"
    elif necrotic > 5 or slough > 30 or time_scores["I"] > 0.35:
        condition = "Moderate — Review Required"
    elif gran > 50:
        condition = "Healing — Continue Care"
    else:
        condition = "Stable — Monitor"

    return recs, condition
