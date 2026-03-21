"""
SQLAlchemy ORM models for WoundSense patient and wound tracking.
Models: Patient, Wound, DailyAnalysis
"""

from datetime import datetime, date
from sqlalchemy import Column, String, Float, Boolean, DateTime, Date, JSON, ForeignKey, Enum, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.database import Base


class Patient(Base):
    """PHC patient record."""
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=False, index=True)
    gender = Column(String(20), nullable=True)  # "M", "F", "Other"
    age = Column(Float, nullable=True)  # years
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship: one patient → many wounds
    wounds = relationship("Wound", back_populates="patient", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Patient(id={self.id}, name={self.name}, phone={self.phone})>"


class Wound(Base):
    """Individual wound tracked for a patient."""
    __tablename__ = "wounds"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False, index=True)
    wound_type = Column(String(100), nullable=True)  # "diabetic", "pressure", "surgical", "burn", etc.
    location = Column(String(100), nullable=True)  # "foot", "leg", "arm", "heel", etc.
    status = Column(String(50), default="open", nullable=False)  # "open", "closed", "infected"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)  # When wound was marked as healed
    phc_notes = Column(JSON, default={}, nullable=True)  # Custom PHC notes, patient info

    # Relationship: one wound → many daily analyses
    daily_analyses = relationship("DailyAnalysis", back_populates="wound", cascade="all, delete-orphan")
    patient = relationship("Patient", back_populates="wounds")

    def __repr__(self):
        return f"<Wound(id={self.id}, patient_id={self.patient_id}, type={self.wound_type}, location={self.location})>"


class DailyAnalysis(Base):
    """Daily wound analysis record (one per wound per date)."""
    __tablename__ = "daily_analyses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wound_id = Column(String(36), ForeignKey("wounds.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)  # YYYY-MM-DD analysis date
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Photo (Base64 JPEG)
    photo_base64 = Column(Text, nullable=False)  # Full photo stored as Base64

    # Wound measurements
    wound_area_cm2 = Column(Float, nullable=False)
    wound_perimeter_cm = Column(Float, nullable=True)
    wound_dimensions_cm = Column(JSON, nullable=True)  # [length, width]
    precision_mm = Column(Float, nullable=False)  # ±mm measurement precision

    # Coin detection
    coin_detected = Column(Boolean, default=True, nullable=False)

    # TIME framework scores (0-1 range)
    time_scores = Column(JSON, nullable=False)  # {T, I, M, E} scores
    #   T: Tissue viability (0=healthy, 1=critical)
    #   I: Infection/inflammation (0=none, 1=severe)
    #   M: Moisture imbalance (0=balanced, 1=imbalanced)
    #   E: Edge irregularity (0=regular, 1=irregular)

    # Tissue composition
    tissue_ratios = Column(JSON, nullable=False)  # {granulation, slough, necrotic, epithelial} %
    #   granulation: healthy red tissue
    #   slough: yellow fibrinous tissue
    #   necrotic: dark non-viable tissue
    #   epithelial: pale pink new skin

    # Wound condition classification
    wound_condition = Column(String(100), nullable=False)  # "Healthy", "Moderate", "Critical"
    recommendations = Column(JSON, nullable=False)  # List of nursing actions

    # Segmentation mask
    masked_image_base64 = Column(Text, nullable=False)  # Binary mask as Base64 JPEG

    # Inference metadata
    inference_ms = Column(Float, nullable=False)  # Server-side inference time
    model_mode = Column(String(20), default="onnx", nullable=False)  # "onnx" or "demo"

    # Relationship
    wound = relationship("Wound", back_populates="daily_analyses")

    # Unique constraint: one analysis per wound per date
    __table_args__ = (
        UniqueConstraint("wound_id", "date", name="uq_wound_date"),
    )

    def __repr__(self):
        return f"<DailyAnalysis(wound_id={self.wound_id}, date={self.date}, area={self.wound_area_cm2}cm2)>"
