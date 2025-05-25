"""
Application configuration settings.
"""

import os
from typing import Optional, List
from pydantic import field_validator
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
    
    # Application Settings
    LOG_LEVEL: str = "INFO"
    ENV: str = "development"
    
    # Batch processing limits
    MAX_BATCH_SIZE: int = 10000  # Increased from 1000 to 10000
    MAX_FILE_SIZE_MB: int = 50   # 50MB file size limit
    
    # Model settings
    MODEL_VERSION: str = "v1.0"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


# Global settings instance
settings = Settings()  # type: ignore[call-arg]
