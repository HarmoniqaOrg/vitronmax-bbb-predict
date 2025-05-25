
"""
Application configuration settings.
"""

from typing import List
from pydantic_settings import BaseSettings
from pydantic import validator


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # App settings
    APP_NAME: str = "VitronMax"
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_STR: str = "/api/v1"

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://vitronmax.fly.dev"]

    # Database and Storage settings
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    STORAGE_BUCKET_NAME: str = "vitronmax-storage"

    # OpenAI settings
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ML model settings
    MODEL_PATH: str = "models/bbb_rf_model.joblib"
    MODEL_VERSION: str = "v1.0"
    FP_RADIUS: int = 2
    FP_NBITS: int = 2048

    # Batch processing settings
    MAX_BATCH_SIZE: int = 10000
    BATCH_TIMEOUT_HOURS: int = 24
    ESTIMATED_TIME_PER_MOLECULE: float = 0.1  # seconds per molecule

    # File upload settings
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_FILE_EXTENSIONS: List[str] = [".csv", ".txt"]

    @validator("ALLOWED_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        """Parse CORS origins from environment variable."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()  # type: ignore[call-arg]
