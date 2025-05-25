"""
Application configuration settings.
"""

from typing import List, Optional
from pydantic import AnyHttpUrl, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # App settings
    APP_NAME: str = "VitronMax"
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_STR: str = "/api/v1"

    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://vitronmax.fly.dev"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        """Parse CORS origins from environment variable."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # Database and Storage settings
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    STORAGE_BUCKET_NAME: str = "vitronmax-storage"

    # OpenAI settings
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"

    # Model settings
    MODEL_PATH: str = "models/default_model.joblib"
    MODEL_VERSION: str = "v1.0"
    FP_NBITS: int = 2048
    FP_RADIUS: int = 2

    # Batch processing limits
    MAX_BATCH_SIZE: int = 10000
    MAX_FILE_SIZE_MB: int = 50
    ESTIMATED_TIME_PER_MOLECULE: float = 0.1

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )


# Global settings instance
settings = Settings()
