"""
WoundSense API — FastAPI backend for wound analysis at Tamil Nadu PHCs
Research context:
  - UNet baseline: 89% Dice, Jupyter-only [Ronneberger 2015]
  - WoundAmbit: 92% Dice, lab prototype [arXiv 2025]
  - WoundSense: First production-deployed wound AI for rural India
"""

import time
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes import analyze, health, report, patients, wounds, analyze_with_tracking, progress
from app.core.config import settings
from app.core.model_loader import ModelLoader
from app.core.database import engine
from app.models.database import Base

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("woundsense")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup, release on shutdown."""
    logger.info("🚀 WoundSense starting — loading ML models...")
    start = time.time()

    # Initialize database tables
    logger.info("📊 Creating database tables...")
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database initialized")

    app.state.models = ModelLoader()
    app.state.models.load_all()
    elapsed = time.time() - start
    logger.info(f"✅ Models loaded in {elapsed:.2f}s — ready for PHC deployment")
    yield
    logger.info("🛑 WoundSense shutting down — releasing models")
    app.state.models.unload()


app = FastAPI(
    title="WoundSense API",
    description=(
        "Production wound analysis AI for 78,000 Tamil Nadu Primary Health Centres. "
        "Provides TIME classification, wound area measurement, and tissue segmentation "
        "from a single smartphone photograph. Tracks patient wounds over time."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow React Native app and PHC dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    # Log incoming requests to trace form parsing issues
    if "/analyze/tracked" in request.url.path:
        print(f"📥 INCOMING REQUEST: {request.method} {request.url.path}")
        print(f"   Content-Type: {request.headers.get('content-type')}")

    start = time.time()
    try:
        response = await call_next(request)
    except Exception as e:
        print(f"❌ MIDDLEWARE ERROR: {type(e).__name__}: {e}")
        import traceback
        print(traceback.format_exc())
        raise

    process_time = (time.time() - start) * 1000
    response.headers["X-Process-Time-Ms"] = f"{process_time:.1f}"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"🔴 GLOBAL EXCEPTION: {type(exc).__name__}: {exc}")
    import traceback
    print(traceback.format_exc())
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# Register routers (order matters for docs)
app.include_router(analyze.router, prefix="/api/v1", tags=["Analysis"])
app.include_router(analyze_with_tracking.router, prefix="/api/v1", tags=["Analysis"])
app.include_router(report.router, prefix="/api/v1", tags=["Report"])
app.include_router(patients.router, prefix="/api/v1", tags=["Patients"])
app.include_router(wounds.router, prefix="/api/v1", tags=["Wounds"])
app.include_router(progress.router, prefix="/api/v1", tags=["Progress"])
app.include_router(health.router, tags=["Health"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "WoundSense",
        "version": "1.0.0",
        "status": "operational",
        "phcs_supported": 78000,
        "docs": "/docs",
        "features": {
            "wound_analysis": "Single photo → wound metrics, TIME framework, tissue classification",
            "patient_tracking": "Track wounds per patient with daily progression",
            "offline_capable": True,
            "database": "SQLite for persistent patient/wound history",
        }
    }
