"""
Configuration settings for VitronMax application.
"""

import os
from typing import List
from pydantic import BaseSettings, validator


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # App settings
    APP_NAME: str = "VitronMax"
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    # API settings
    API_V1_STR: str = "/api/v1"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://vitronmax.fly.dev"]

    # Database settings
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    STORAGE_BUCKET_NAME: str = "vitronmax-storage"

    # ML model settings
    MODEL_PATH: str = "models/bbb_rf_model.joblib"
    FP_RADIUS: int = 2
    FP_NBITS: int = 2048

    # OpenAI settings
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Batch processing settings
    MAX_BATCH_SIZE: int = 10000
    BATCH_TIMEOUT_HOURS: int = 24

    # File upload settings
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_FILE_EXTENSIONS: List[str] = [".csv", ".txt"]

    @validator("ALLOWED_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v):
        """Parse CORS origins from environment variable."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
