"""
wounds.py - Wound management endpoints.
Handles wound lifecycle and daily analysis retrieval.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models import database as db_models
from app.models.schemas import WoundCreate, WoundResponse, DailyAnalysisResponse, WoundProgressResponse, ProgressStatistics

logger = logging.getLogger("woundsense.wounds")
router = APIRouter()


@router.post("/wounds", response_model=WoundResponse, tags=["Wounds"])
def create_wound(
    wound: WoundCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new wound for a patient.

    - **patient_id**: Patient UUID
    - **wound_type**: e.g., 'diabetic', 'pressure', 'surgical', 'burn'
    - **location**: e.g., 'left foot', 'right heel'
    - **status**: 'open' (default), 'closed', 'infected'
    """
    # Verify patient exists
    patient = db.query(db_models.Patient).filter(
        db_models.Patient.id == wound.patient_id
    ).first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Create wound
    db_wound = db_models.Wound(
        patient_id=wound.patient_id,
        wound_type=wound.wound_type,
        location=wound.location,
        status=wound.status or "open",
    )
    db.add(db_wound)
    db.commit()
    db.refresh(db_wound)

    logger.info(f"✅ Wound created: {db_wound.id} for patient {wound.patient_id}")
    return WoundResponse(
        id=db_wound.id,
        patient_id=db_wound.patient_id,
        wound_type=db_wound.wound_type,
        location=db_wound.location,
        status=db_wound.status,
        created_at=db_wound.created_at.isoformat(),
        closed_at=None,
        analyses_count=0,
    )


@router.get("/wounds/{wound_id}", response_model=WoundProgressResponse, tags=["Wounds"])
def get_wound_progress(
    wound_id: str,
    db: Session = Depends(get_db)
):
    """
    Get wound with all daily analyses (newest first) and progression statistics.
    """
    wound = db.query(db_models.Wound).filter(
        db_models.Wound.id == wound_id
    ).first()

    if not wound:
        raise HTTPException(status_code=404, detail="Wound not found")

    # Get patient name
    patient = db.query(db_models.Patient).filter(
        db_models.Patient.id == wound.patient_id
    ).first()

    # Fetch daily analyses (newest first)
    analyses = db.query(db_models.DailyAnalysis).filter(
        db_models.DailyAnalysis.wound_id == wound_id
    ).order_by(desc(db_models.DailyAnalysis.date)).all()

    # Build daily analysis responses
    analyses_response = [
        DailyAnalysisResponse(
            id=a.id,
            wound_id=a.wound_id,
            date=a.date.isoformat(),
            wound_area_cm2=a.wound_area_cm2,
            wound_perimeter_cm=a.wound_perimeter_cm,
            wound_dimensions_cm=a.wound_dimensions_cm,
            precision_mm=a.precision_mm,
            coin_detected=a.coin_detected,
            time_scores=a.time_scores,
            tissue_ratios=a.tissue_ratios,
            wound_condition=a.wound_condition,
            recommendations=a.recommendations,
            masked_image=a.masked_image_base64,
            inference_ms=a.inference_ms,
            model_mode=a.model_mode,
            created_at=a.created_at.isoformat(),
        )
        for a in analyses
    ]

    # Calculate statistics if analyses exist
    statistics = None
    if analyses:
        oldest = analyses[-1]  # Last in newest-first list
        newest = analyses[0]   # First in newest-first list
        days_diff = (newest.date - oldest.date).days
        area_change = newest.wound_area_cm2 - oldest.wound_area_cm2
        area_change_percent = (area_change / oldest.wound_area_cm2 * 100) if oldest.wound_area_cm2 > 0 else 0

        # Determine trend
        if area_change < -0.5:  # Improvement threshold
            trend = "improving"
        elif area_change > 0.5:  # Worsening threshold
            trend = "worsening"
        else:
            trend = "stable"

        # Calculate average tissue health (granulation %)
        avg_granulation = sum(a.tissue_ratios.get("granulation", 0) for a in analyses) / len(analyses) if analyses else 0

        statistics = ProgressStatistics(
            total_days=days_diff,
            photos_count=len(analyses),
            initial_area_cm2=oldest.wound_area_cm2,
            final_area_cm2=newest.wound_area_cm2,
            area_change_cm2=area_change,
            area_change_percent=area_change_percent,
            area_trend=trend,
            avg_tissue_health=avg_granulation,
        )

    return WoundProgressResponse(
        wound_id=wound.id,
        patient_name=patient.name if patient else "Unknown",
        patient_phone=patient.phone if patient else "",
        wound_type=wound.wound_type,
        location=wound.location,
        status=wound.status,
        created_at=wound.created_at.isoformat(),
        analyses=analyses_response,
        statistics=statistics,
    )


@router.put("/wounds/{wound_id}/close", response_model=WoundResponse, tags=["Wounds"])
def close_wound(
    wound_id: str,
    db: Session = Depends(get_db)
):
    """
    Mark a wound as closed (healed).
    """
    wound = db.query(db_models.Wound).filter(
        db_models.Wound.id == wound_id
    ).first()

    if not wound:
        raise HTTPException(status_code=404, detail="Wound not found")

    wound.status = "closed"
    wound.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(wound)

    logger.info(f"✅ Wound closed: {wound_id}")
    return WoundResponse(
        id=wound.id,
        patient_id=wound.patient_id,
        wound_type=wound.wound_type,
        location=wound.location,
        status=wound.status,
        created_at=wound.created_at.isoformat(),
        closed_at=wound.closed_at.isoformat() if wound.closed_at else None,
        analyses_count=len(wound.daily_analyses),
    )


@router.get("/wounds/{wound_id}/daily/{date}", response_model=DailyAnalysisResponse, tags=["Wounds"])
def get_daily_analysis(
    wound_id: str,
    date: str,  # Format: YYYY-MM-DD
    db: Session = Depends(get_db)
):
    """
    Get specific day's analysis for a wound.

    - **wound_id**: Wound UUID
    - **date**: Analysis date in YYYY-MM-DD format
    """
    # Parse date
    try:
        from datetime import datetime
        analysis_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must be in YYYY-MM-DD format")

    analysis = db.query(db_models.DailyAnalysis).filter(
        db_models.DailyAnalysis.wound_id == wound_id,
        db_models.DailyAnalysis.date == analysis_date
    ).first()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found for this date")

    return DailyAnalysisResponse(
        id=analysis.id,
        wound_id=analysis.wound_id,
        date=analysis.date.isoformat(),
        wound_area_cm2=analysis.wound_area_cm2,
        wound_perimeter_cm=analysis.wound_perimeter_cm,
        wound_dimensions_cm=analysis.wound_dimensions_cm,
        precision_mm=analysis.precision_mm,
        coin_detected=analysis.coin_detected,
        time_scores=analysis.time_scores,
        tissue_ratios=analysis.tissue_ratios,
        wound_condition=analysis.wound_condition,
        recommendations=analysis.recommendations,
        masked_image=analysis.masked_image_base64,
        inference_ms=analysis.inference_ms,
        model_mode=analysis.model_mode,
        created_at=analysis.created_at.isoformat(),
    )
