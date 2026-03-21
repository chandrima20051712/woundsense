"""
Database connection and session management for WoundSense.
Uses SQLite for offline-capable PHC deployments.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Database URL from config (default: SQLite at woundsense.db)
DATABASE_URL = settings.DATABASE_URL if hasattr(settings, 'DATABASE_URL') else "sqlite:///./woundsense.db"

# For SQLite, add check_same_thread=False to allow concurrent access
connect_args = {}
if DATABASE_URL.startswith("sqlite://"):
    connect_args = {"check_same_thread": False}

# Create SQLAlchemy engine
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG if hasattr(settings, 'DEBUG') else False
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()


def get_db():
    """
    Dependency injection for FastAPI routes.
    Yields a database session for each request.

    Usage in routes:
        @router.get("/path")
        def get_something(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
