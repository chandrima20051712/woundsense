"""health.py — Liveness and readiness probes for Docker/Railway."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    model_mode: str
    version: str = "1.0.0"


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health(request: Request):
    models = getattr(request.app.state, "models", None)
    mode = "demo" if (models is None or models.is_mock) else "onnx"
    return HealthResponse(status="ok", model_mode=mode)


@router.get("/ready", tags=["Health"])
async def ready(request: Request):
    models = getattr(request.app.state, "models", None)
    if models is None or models.unet is None:
        return {"ready": False, "reason": "models not loaded"}
    return {"ready": True}
