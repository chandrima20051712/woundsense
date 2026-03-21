"""
progress.py - Wound progression tracking endpoints.
Provides healing timeline and trend analysis.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models import database as db_models
from app.models.schemas import WoundProgressResponse

logger = logging.getLogger("woundsense.progress")
router = APIRouter()


@router.get("/wounds/{wound_id}/progress", response_model=WoundProgressResponse, tags=["Progress"])
def get_wound_progress(
    wound_id: str,
    db: Session = Depends(get_db)
):
    """
    Get complete wound healing timeline with statistics.

    Returns:
    - Wound metadata (patient, type, location)
    - All daily analyses (newest first)
    - Progression statistics (area trend, improvement %, etc.)
    """
    # Simply delegate to wounds endpoint (same functionality)
    # Could add additional caching or analytics here in future
    from app.routes.wounds import get_wound_progress as _get_wound_progress
    return _get_wound_progress(wound_id, db)
