"""
Configuration settings loaded from environment variables.
Copy .env.example → .env and fill in values for each PHC server.
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False

    # CORS
    ALLOWED_ORIGINS: List[str] = ["*"]  # Restrict in production

    # ML Models — absolute path for Docker
    MODEL_DIR: str = "/app/models"
    UNET_MODEL_PATH: str = "/app/models/wound_unet.onnx"
    TISSUE_CLASSIFIER_PATH: str = "/app/models/tissue_classifier.pkl"

    # Inference
    INFERENCE_IMG_SIZE: int = 512       # UNet input resolution
    COIN_DIAMETER_MM: float = 25.0      # Indian 2.5cm ₹1 coin
    COIN_HOUGH_DP: float = 1.2
    COIN_HOUGH_MIN_DIST: int = 100
    COIN_HOUGH_PARAM1: int = 50
    COIN_HOUGH_PARAM2: int = 30
    COIN_MIN_RADIUS: int = 30
    COIN_MAX_RADIUS: int = 120

    # Database — SQLite for offline PHC deployments
    DATABASE_URL: str = "sqlite:///./woundsense.db"

    # Redis cache (optional — gracefully degrades if absent)
    REDIS_URL: str = "redis://redis:6379"
    CACHE_TTL_SECONDS: int = 300

    # PDF report
    PHC_LOGO_PATH: str = "/app/assets/tnhealth_logo.png"

    # Security
    API_KEY: str = ""  # Set in production; empty = open (intranet PHC use)

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()