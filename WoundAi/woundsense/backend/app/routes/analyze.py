"""
analyze.py — POST /api/v1/analyze endpoint.

Full ML pipeline: photo → wound mask → tissue classification → TIME score → report.
Target: <2s end-to-end on Snapdragon 665 (Moto G32, ₹10k).
"""

import io
import base64
import time
import logging
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, File, UploadFile, Request, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image

from app.utils.coin_detector import detect_coin, draw_coin_overlay
from app.utils.wound_segmenter import segment_wound, overlay_mask
from app.utils.tissue_classifier import (
    classify_wound_pixels,
    score_time,
    generate_recommendations,
)
from app.utils.area_calculator import calculate_wound_area, compute_precision_mm
from app.models.schemas import AnalysisResponse, AnalysisError

logger = logging.getLogger("woundsense.analyze")
router = APIRouter()

MAX_IMAGE_BYTES = 15 * 1024 * 1024   # 15MB
MAX_DIM = 2048                          # Downsample huge images


def _load_image(upload: UploadFile) -> np.ndarray:
    """Read uploaded file → BGR numpy array."""
    raw = upload.file.read()
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large (max 15MB)")
    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Could not decode image — ensure JPEG/PNG format")
    # Downsample if very large (saves inference time on PHC phones)
    h, w = img.shape[:2]
    if max(h, w) > MAX_DIM:
        scale = MAX_DIM / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
    return img


def _encode_image_base64(image_bgr: np.ndarray) -> str:
    """Encode BGR image as base64 JPEG string."""
    _, buf = cv2.imencode(".jpg", image_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buf.tobytes()).decode("utf-8")


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    summary="Analyze wound photograph",
    description=(
        "Submit a wound photograph (+ optional coin reference). "
        "Returns wound area, tissue classification, TIME scores, and clinical recommendations. "
        "Target latency: <2s."
    ),
)
async def analyze_wound(
    request: Request,
    photo: UploadFile = File(..., description="Wound photograph (JPEG/PNG)"),
    coin_photo: Optional[UploadFile] = File(
        None,
        description="Separate coin reference photo (optional — can use same image)",
    ),
):
    t0 = time.monotonic()
    models = request.app.state.models

    # ── 1. Load images ────────────────────────────────────────────────────────
    try:
        wound_img = _load_image(photo)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Failed to read wound photo: {e}")

    # Use separate coin photo if provided, else detect in wound photo
    coin_img = wound_img
    if coin_photo and coin_photo.filename:
        try:
            coin_img = _load_image(coin_photo)
        except Exception:
            logger.warning("Could not load separate coin photo — using wound photo")

    # ── 2. Coin detection → scale ─────────────────────────────────────────────
    coin_circle, px_per_mm = detect_coin(coin_img)
    coin_detected = coin_circle is not None
    precision_mm = compute_precision_mm(px_per_mm, coin_detected)

    # ── 3. UNet wound segmentation ────────────────────────────────────────────
    mask = segment_wound(models.unet, wound_img)

    # Check we actually found a wound
    wound_pixel_fraction = np.sum(mask > 0) / mask.size
    if wound_pixel_fraction < 0.001:
        logger.warning("Wound mask is near-empty — image may not contain a wound")

    # ── 4. Area calculation ───────────────────────────────────────────────────
    area_cm2, perimeter_cm, dimensions = calculate_wound_area(mask, px_per_mm)

    # ── 5. Tissue classification ──────────────────────────────────────────────
    tissue_ratios = classify_wound_pixels(wound_img, mask)
    time_scores = score_time(tissue_ratios, wound_img, mask)
    recommendations, wound_condition = generate_recommendations(
        tissue_ratios, time_scores, area_cm2
    )

    # ── 6. Visualisation ──────────────────────────────────────────────────────
    vis = overlay_mask(wound_img, mask)
    if coin_detected:
        vis = draw_coin_overlay(vis, coin_circle)
    masked_image_b64 = _encode_image_base64(vis)

    elapsed_ms = (time.monotonic() - t0) * 1000
    logger.info(
        f"Analysis complete in {elapsed_ms:.0f}ms | "
        f"Area={area_cm2}cm² | Condition={wound_condition}"
    )

    return AnalysisResponse(
        wound_area_cm2=area_cm2,
        wound_perimeter_cm=perimeter_cm,
        wound_dimensions_cm=list(dimensions) if dimensions else None,
        precision_mm=precision_mm,
        coin_detected=coin_detected,
        time_scores=time_scores,
        tissue_ratios=tissue_ratios,
        wound_condition=wound_condition,
        recommendations=recommendations,
        masked_image=masked_image_b64,
        inference_ms=round(elapsed_ms, 1),
        model_mode="onnx" if not models.is_mock else "demo",
    )
