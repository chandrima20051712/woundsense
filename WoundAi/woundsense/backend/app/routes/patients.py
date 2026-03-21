"""
patients.py - Patient management endpoints.
Handles patient CRUD operations and wound listings.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models import database as db_models
from app.models.schemas import PatientCreate, PatientResponse, WoundResponse

logger = logging.getLogger("woundsense.patients")
router = APIRouter()


@router.post("/patients", response_model=PatientResponse, tags=["Patients"])
def create_patient(
    patient: PatientCreate,
    db: Session = Depends(get_db)
):
    """
    Create a new patient record.

    - **name**: Full name of patient
    - **phone**: 10-digit phone number (unique)
    - **gender**: M/F/Other
    - **age**: Age in years
    """
    # Check if phone already exists
    existing = db.query(db_models.Patient).filter(
        db_models.Patient.phone == patient.phone
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Patient with phone {patient.phone} already exists (ID: {existing.id})"
        )

    # Create new patient
    db_patient = db_models.Patient(
        name=patient.name,
        phone=patient.phone,
        gender=patient.gender,
        age=patient.age,
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)

    logger.info(f"✅ Patient created: {db_patient.id} - {patient.name}")
    return PatientResponse(
        id=db_patient.id,
        name=db_patient.name,
        phone=db_patient.phone,
        gender=db_patient.gender,
        age=db_patient.age,
        created_at=db_patient.created_at.isoformat(),
        wounds_count=len(db_patient.wounds),
    )


@router.get("/patients", response_model=list[PatientResponse], tags=["Patients"])
def list_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    List all patients with pagination.

    - **skip**: Number of records to skip (default: 0)
    - **limit**: Max records to return (default: 100, max: 500)
    """
    patients = db.query(db_models.Patient).order_by(
        desc(db_models.Patient.created_at)
    ).offset(skip).limit(limit).all()

    return [
        PatientResponse(
            id=p.id,
            name=p.name,
            phone=p.phone,
            gender=p.gender,
            age=p.age,
            created_at=p.created_at.isoformat(),
            wounds_count=len(p.wounds),
        )
        for p in patients
    ]


@router.get("/patients/{patient_id}", response_model=PatientResponse, tags=["Patients"])
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db)
):
    """
    Get patient details by ID.
    """
    patient = db.query(db_models.Patient).filter(
        db_models.Patient.id == patient_id
    ).first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return PatientResponse(
        id=patient.id,
        name=patient.name,
        phone=patient.phone,
        gender=patient.gender,
        age=patient.age,
        created_at=patient.created_at.isoformat(),
        wounds_count=len(patient.wounds),
    )


@router.get(
    "/patients/{patient_id}/wounds",
    response_model=list[WoundResponse],
    tags=["Patients"]
)
def get_patient_wounds(
    patient_id: str,
    status: str = Query(None, description="Filter by status: 'open', 'closed', 'infected'"),
    db: Session = Depends(get_db)
):
    """
    Get all wounds for a patient (optionally filtered by status).

    - **patient_id**: Patient UUID
    - **status**: Optional wound status filter
    """
    patient = db.query(db_models.Patient).filter(
        db_models.Patient.id == patient_id
    ).first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    query = db.query(db_models.Wound).filter(
        db_models.Wound.patient_id == patient_id
    )

    if status:
        query = query.filter(db_models.Wound.status == status)

    wounds = query.order_by(desc(db_models.Wound.created_at)).all()

    return [
        WoundResponse(
            id=w.id,
            patient_id=w.patient_id,
            wound_type=w.wound_type,
            location=w.location,
            status=w.status,
            created_at=w.created_at.isoformat(),
            closed_at=w.closed_at.isoformat() if w.closed_at else None,
            analyses_count=len(w.daily_analyses),
        )
        for w in wounds
    ]
