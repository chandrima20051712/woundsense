"""schemas.py — Pydantic models for API request/response validation."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class TissueRatios(BaseModel):
    granulation: int = Field(..., ge=0, le=100, description="% healthy red tissue")
    slough: int = Field(..., ge=0, le=100, description="% yellow fibrinous tissue")
    necrotic: int = Field(..., ge=0, le=100, description="% dark non-viable tissue")
    epithelial: int = Field(0, ge=0, le=100, description="% epithelialising tissue")


class TimeScores(BaseModel):
    T: float = Field(..., ge=0, le=1, description="Tissue viability score (1=critical)")
    I: float = Field(..., ge=0, le=1, description="Infection/inflammation score")
    M: float = Field(..., ge=0, le=1, description="Moisture imbalance score")
    E: float = Field(..., ge=0, le=1, description="Edge irregularity score")


class AnalysisResponse(BaseModel):
    wound_area_cm2: float = Field(..., description="Wound surface area in cm²")
    wound_perimeter_cm: float = Field(..., description="Wound perimeter in cm")
    wound_dimensions_cm: Optional[List[float]] = Field(
        None, description="[length, width] in cm from fitted ellipse"
    )
    precision_mm: float = Field(..., description="Measurement precision in mm (±)")
    coin_detected: bool = Field(..., description="Whether reference coin was found")

    time_scores: Dict[str, float] = Field(..., description="TIME framework scores 0–1")
    tissue_ratios: Dict[str, int] = Field(..., description="Tissue type percentages")
    wound_condition: str = Field(..., description="Summary condition label")
    recommendations: List[str] = Field(..., description="Nurse-facing action items")

    masked_image: str = Field(..., description="Base64 JPEG of wound overlay")
    inference_ms: float = Field(..., description="Server-side inference time in ms")
    model_mode: str = Field(..., description="'onnx' or 'demo'")

    class Config:
        json_schema_extra = {
            "example": {
                "wound_area_cm2": 12.4,
                "wound_perimeter_cm": 14.2,
                "wound_dimensions_cm": [4.8, 3.2],
                "precision_mm": 4.8,
                "coin_detected": True,
                "time_scores": {"T": 0.8, "I": 0.2, "M": 0.7, "E": 0.6},
                "tissue_ratios": {
                    "granulation": 45, "slough": 30, "necrotic": 25, "epithelial": 0
                },
                "wound_condition": "Moderate — Review Required",
                "recommendations": [
                    "Debride necrotic tissue — enzymatic or autolytic debridement",
                    "Remove slough — consider hydrogel or hydrocolloid dressing",
                    "Moisture balanced — continue current dressing regimen",
                ],
                "masked_image": "<base64_jpeg>",
                "inference_ms": 1840.5,
                "model_mode": "onnx",
            }
        }


class AnalysisError(BaseModel):
    error: str
    detail: Optional[str] = None


# ==================== PATIENT & WOUND TRACKING ====================


class PatientCreate(BaseModel):
    """Request to create a new patient."""
    name: str = Field(..., min_length=1, max_length=255, description="Patient full name")
    phone: str = Field(..., pattern=r"^\d{10}$", description="10-digit phone number (Indian format)")
    gender: Optional[str] = Field(None, description="M/F/Other")
    age: Optional[float] = Field(None, ge=0, le=150, description="Age in years")


class PatientResponse(BaseModel):
    """Patient record with wound history."""
    id: str
    name: str
    phone: str
    gender: Optional[str]
    age: Optional[float]
    created_at: str
    wounds_count: int = 0  # Number of wounds for this patient

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Sunitha Kumar",
                "phone": "9876543210",
                "gender": "F",
                "age": 58.0,
                "created_at": "2025-03-15T10:30:00",
                "wounds_count": 2,
            }
        }


class WoundCreate(BaseModel):
    """Request to create a new wound for a patient."""
    patient_id: str = Field(..., description="UUID of patient")
    wound_type: str = Field(..., description="e.g., 'diabetic', 'pressure', 'surgical'")
    location: str = Field(..., description="e.g., 'left foot', 'right heel'")
    status: Optional[str] = Field("open", description="'open', 'closed', 'infected'")


class WoundResponse(BaseModel):
    """Wound record."""
    id: str
    patient_id: str
    wound_type: str
    location: str
    status: str
    created_at: str
    closed_at: Optional[str] = None
    analyses_count: int = 0  # Number of daily analyses

    class Config:
        json_schema_extra = {
            "example": {
                "id": "660e8401-e29b-41d4-a716-446655440001",
                "patient_id": "550e8400-e29b-41d4-a716-446655440000",
                "wound_type": "diabetic",
                "location": "left foot",
                "status": "open",
                "created_at": "2025-03-15T10:30:00",
                "closed_at": None,
                "analyses_count": 5,
            }
        }


class DailyAnalysisResponse(BaseModel):
    """Daily wound analysis with tracking metadata."""
    id: str
    wound_id: str
    date: str  # YYYY-MM-DD
    wound_area_cm2: float
    wound_perimeter_cm: Optional[float]
    wound_dimensions_cm: Optional[List[float]] = None
    precision_mm: float
    coin_detected: bool
    time_scores: Dict[str, float]
    tissue_ratios: Dict[str, int]
    wound_condition: str
    recommendations: List[str]
    masked_image: str  # Base64 JPEG
    inference_ms: float
    model_mode: str
    created_at: str

    class Config:
        json_schema_extra = {
            "example": {
                "id": "770e8402-e29b-41d4-a716-446655440002",
                "wound_id": "660e8401-e29b-41d4-a716-446655440001",
                "date": "2025-03-19",
                "wound_area_cm2": 12.4,
                "wound_perimeter_cm": 14.2,
                "wound_dimensions_cm": [4.8, 3.2],
                "precision_mm": 4.8,
                "coin_detected": True,
                "time_scores": {"T": 0.8, "I": 0.2, "M": 0.7, "E": 0.6},
                "tissue_ratios": {"granulation": 45, "slough": 30, "necrotic": 25, "epithelial": 0},
                "wound_condition": "Moderate",
                "recommendations": ["Debride necrotic tissue", "Monitor for infection"],
                "masked_image": "<base64_jpeg>",
                "inference_ms": 1840.5,
                "model_mode": "onnx",
                "created_at": "2025-03-19T15:45:00",
            }
        }


class ProgressStatistics(BaseModel):
    """Wound progression statistics."""
    total_days: int = Field(..., description="Days since wound created")
    photos_count: int = Field(..., description="Total daily analyses")
    initial_area_cm2: float = Field(..., description="First recorded area")
    final_area_cm2: float = Field(..., description="Most recent area")
    area_change_cm2: float = Field(..., description="Absolute change (negative=improvement)")
    area_change_percent: float = Field(..., description="Percentage change")
    area_trend: str = Field(..., description="'improving', 'stable', or 'worsening'")
    avg_tissue_health: float = Field(..., description="Average granulation %")


class WoundProgressResponse(BaseModel):
    """Complete wound progression data for timeline view."""
    wound_id: str
    patient_name: str
    patient_phone: str
    wound_type: str
    location: str
    status: str
    created_at: str
    analyses: List[DailyAnalysisResponse] = Field(default_factory=list, description="Daily analyses, newest first")
    statistics: Optional[ProgressStatistics] = None

    class Config:
        json_schema_extra = {
            "example": {
                "wound_id": "660e8401-e29b-41d4-a716-446655440001",
                "patient_name": "Sunitha Kumar",
                "patient_phone": "9876543210",
                "wound_type": "diabetic",
                "location": "left foot",
                "status": "open",
                "created_at": "2025-03-01T10:00:00",
                "analyses": [
                    {
                        "date": "2025-03-19",
                        "wound_area_cm2": 10.2,
                    }
                ],
                "statistics": {
                    "total_days": 18,
                    "photos_count": 15,
                    "initial_area_cm2": 15.0,
                    "final_area_cm2": 10.2,
                    "area_change_cm2": -4.8,
                    "area_change_percent": -32.0,
                    "area_trend": "improving",
                    "avg_tissue_health": 52.0,
                }
            }
        }
