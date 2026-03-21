"""
analyze_with_tracking.py - Tracked wound analysis endpoint.
Combines ML analysis with automatic database storage for wound progression.
"""

import io
import base64
import time
import logging
from datetime import datetime, date
from typing import Optional

import cv2
import numpy as np
from fastapi import APIRouter, File, UploadFile, Request, HTTPException, Form
from fastapi.responses import JSONResponse
from PIL import Image
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models import database as db_models
from app.models.schemas import DailyAnalysisResponse
from app.utils.coin_detector import detect_coin, draw_coin_overlay
from app.utils.wound_segmenter import segment_wound, overlay_mask
from app.utils.tissue_classifier import (
    classify_wound_pixels,
    score_time,
    generate_recommendations,
)
from app.utils.area_calculator import calculate_wound_area, compute_precision_mm

logger = logging.getLogger("woundsense.analyze_tracked")
router = APIRouter()

MAX_IMAGE_BYTES = 15 * 1024 * 1024  # 15MB
MAX_DIM = 2048


@router.post("/test-upload", tags=["Debug"])
async def test_upload(photo: UploadFile = File(...), wound_id: str = Form(...)):
    """Simple debug endpoint to verify form/file parsing works."""
    print(f"✅ TEST ENDPOINT HIT: wound_id={wound_id}, filename={photo.filename}", flush=True)
    return {"status": "ok", "wound_id": wound_id, "filename": photo.filename}


def _load_image(upload: UploadFile) -> np.ndarray:
    """Read uploaded file → BGR numpy array."""
    raw = upload.file.read()
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image too large (max 15MB)")
    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Could not decode image — ensure JPEG/PNG format")
    # Downsample if very large
    h, w = img.shape[:2]
    if max(h, w) > MAX_DIM:
        scale = MAX_DIM / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))
    return img


def _img_to_base64(img: np.ndarray, format: str = "JPEG", quality: int = 92) -> str:
    """Convert numpy array to base64 JPEG string."""
    if len(img.shape) == 2:  # Grayscale
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:  # RGBA
        img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
    elif img.shape[2] != 3:  # Unknown
        raise ValueError(f"Image shape {img.shape} not supported")

    success, buffer = cv2.imencode(f".{format.lower()}", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not success:
        raise ValueError("Failed to encode image")
    return base64.b64encode(buffer).decode("utf-8")


@router.post("/analyze/tracked", tags=["Analysis"])
async def analyze_wound_tracked(
    request: Request,
    photo: UploadFile = File(...),
    wound_id: str = Form(...),
    analysis_date: Optional[str] = Form(None),  # YYYY-MM-DD; defaults to today
):
    """
    Analyze wound photo AND save to patient wound history.

    - **photo**: Wound photo file (JPEG/PNG)
    - **wound_id**: UUID of wound to track
    - **analysis_date**: Optional date for analysis (defaults to today)

    Returns full daily analysis with wound_id and date.
    Overwrites if same wound + date exists (daily update pattern).
    """
    print(f"🔵 [TRACKED ANALYSIS START] Received request for wound_id={wound_id}", flush=True)
    print(f"📋 Form data: wound_id={wound_id}, photo={photo.filename}, analysis_date={analysis_date}", flush=True)
    inference_start = time.time()

    try:
        # Parse analysis date
        if not analysis_date:
            analysis_date = date.today().isoformat()
        else:
            try:
                analysis_date = datetime.strptime(analysis_date, "%Y-%m-%d").date().isoformat()
            except ValueError:
                raise HTTPException(400, "Date must be YYYY-MM-DD format")

        # 1️⃣ Get DB session and validate wound
        db: Session = next(get_db())
        wound = db.query(db_models.Wound).filter(
            db_models.Wound.id == wound_id
        ).first()

        if not wound:
            print(f"❌ Wound not found: {wound_id}", flush=True)
            raise HTTPException(status_code=404, detail=f"Wound {wound_id} not found")

        print(f"✅ Found wound: {wound.location}", flush=True)

        # 2️⃣ Load and process image
        img = _load_image(photo)
        print(f"✅ Image loaded: {img.shape}", flush=True)
        h, w = img.shape[:2]

        # 3️⃣ Coin detection for calibration
        coin_roi, px_per_mm = detect_coin(img)
        coin_detected = coin_roi is not None

        if coin_detected:
            coin_center, _, coin_radius = coin_roi
        else:
            coin_radius = None

        # 4️⃣ Wound segmentation (ONNX or mock)
        models = request.app.state.models
        wound_mask = segment_wound(models.unet, img)

        # 5️⃣ Tissue classification
        tissue_ratios = classify_wound_pixels(img, wound_mask)
        time_scores = score_time(tissue_ratios, img, wound_mask)

        # 6️⃣ Area calculation
        area_cm2, perimeter_cm, dimensions = calculate_wound_area(wound_mask, px_per_mm)

        # 7️⃣ Generate recommendations
        recommendations, wound_condition = generate_recommendations(
            tissue_ratios=tissue_ratios,
            time_scores=time_scores,
            wound_area_cm2=area_cm2
        )

        # 8️⃣ Create visualizations (overlays)
        coin_overlay = draw_coin_overlay(img, coin_roi) if coin_detected else img
        masked_overlay = overlay_mask(coin_overlay, wound_mask)

        # 9️⃣ Encode images for storage
        photo_base64 = _img_to_base64(coin_overlay)
        masked_base64 = _img_to_base64(masked_overlay)

        inference_time = (time.time() - inference_start) * 1000  # ms

        # 1️⃣1️⃣ Save to database
        try:
            # Try to replace existing daily analysis for this wound+date
            existing = db.query(db_models.DailyAnalysis).filter(
                db_models.DailyAnalysis.wound_id == wound_id,
                db_models.DailyAnalysis.date == datetime.strptime(analysis_date, "%Y-%m-%d").date()
            ).first()

            if existing:
                # Update existing record
                existing.photo_base64 = photo_base64
                existing.wound_area_cm2 = area_cm2
                existing.wound_perimeter_cm = perimeter_cm
                existing.wound_dimensions_cm = dimensions
                existing.precision_mm = compute_precision_mm(px_per_mm, coin_detected)
                existing.coin_detected = coin_detected
                existing.time_scores = time_scores
                existing.tissue_ratios = tissue_ratios
                existing.wound_condition = wound_condition
                existing.recommendations = recommendations
                existing.masked_image_base64 = masked_base64
                existing.inference_ms = inference_time
                existing.model_mode = "onnx" if hasattr(models, 'unet') and models.unet else "demo"
                db.commit()
                logger.info(f"✏️ Updated daily analysis: {wound_id} for {analysis_date}")
            else:
                # Create new record
                daily_analysis = db_models.DailyAnalysis(
                    wound_id=wound_id,
                    date=datetime.strptime(analysis_date, "%Y-%m-%d").date(),
                    photo_base64=photo_base64,
                    wound_area_cm2=area_cm2,
                    wound_perimeter_cm=perimeter_cm,
                    wound_dimensions_cm=dimensions,
                    precision_mm=compute_precision_mm(px_per_mm, coin_detected),
                    coin_detected=coin_detected,
                    time_scores=time_scores,
                    tissue_ratios=tissue_ratios,
                    wound_condition=wound_condition,
                    recommendations=recommendations,
                    masked_image_base64=masked_base64,
                    inference_ms=inference_time,
                    model_mode="onnx" if hasattr(models, 'unet') and models.unet else "demo",
                )
                db.add(daily_analysis)
                db.commit()
                db.refresh(daily_analysis)
                logger.info(f"✅ Saved tracked analysis: {wound_id} for {analysis_date}")

            # Fetch the saved analysis
            saved_analysis = db.query(db_models.DailyAnalysis).filter(
                db_models.DailyAnalysis.wound_id == wound_id,
                db_models.DailyAnalysis.date == datetime.strptime(analysis_date, "%Y-%m-%d").date()
            ).first()

            print(f"✅ [SUCCESS] Analysis saved and retrieved: {saved_analysis.id}", flush=True)

            return DailyAnalysisResponse(
                id=saved_analysis.id,
                wound_id=saved_analysis.wound_id,
                date=saved_analysis.date.isoformat(),
                wound_area_cm2=saved_analysis.wound_area_cm2,
                wound_perimeter_cm=saved_analysis.wound_perimeter_cm,
                wound_dimensions_cm=saved_analysis.wound_dimensions_cm,
                precision_mm=saved_analysis.precision_mm,
                coin_detected=saved_analysis.coin_detected,
                time_scores=saved_analysis.time_scores,
                tissue_ratios=saved_analysis.tissue_ratios,
                wound_condition=saved_analysis.wound_condition,
                recommendations=saved_analysis.recommendations,
                masked_image=saved_analysis.masked_image_base64,
                inference_ms=saved_analysis.inference_ms,
                model_mode=saved_analysis.model_mode,
                created_at=saved_analysis.created_at.isoformat(),
            )

        except IntegrityError as e:
            db.rollback()
            print(f"❌ Database error: {e}", flush=True)
            logger.error(f"❌ Database error: {e}")
            raise HTTPException(500, "Failed to save analysis to database")

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR in tracked analysis: {type(e).__name__}: {e}", flush=True)
        import traceback
        print(traceback.format_exc(), flush=True)
        logger.error(f"❌ Error in tracked analysis: {e}", exc_info=True)
        raise HTTPException(500, f"Inference failed: {str(e)}")
