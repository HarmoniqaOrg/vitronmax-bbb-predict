"""
Application configuration settings.
"""

from typing import List, Optional
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Project root path
    # Project root path. Prioritize APP_PROJECT_ROOT env var, then fall back to relative path.
    # This allows overriding for containerized environments.
    APP_PROJECT_ROOT_ENV: Optional[str] = None

    @property
    def PROJECT_ROOT(self) -> Path:
        if self.APP_PROJECT_ROOT_ENV:
            return Path(self.APP_PROJECT_ROOT_ENV)
        return Path(__file__).resolve().parent.parent.parent.parent

    # App settings
    APP_NAME: str = "VitronMax"
    ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_STR: str = "/api/v1"

    # CORS settings
    # Store the raw string from the .env file, to be parsed by the property below.
    ALLOWED_ORIGINS_STR: str = (
        "http://localhost:3000,https://vitronmax.fly.dev,http://localhost:8081"
    )

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """
        Returns a list of allowed origins, parsed from ALLOWED_ORIGINS_STR.
        Ensures that empty strings resulting from trailing commas or multiple commas are excluded.
        """
        if isinstance(self.ALLOWED_ORIGINS_STR, str):
            return [
                origin.strip()
                for origin in self.ALLOWED_ORIGINS_STR.split(",")
                if origin.strip()
            ]
        # If ALLOWED_ORIGINS_STR is not a string (e.g. None or already a list somehow),
        # return an empty list or handle as an error, depending on desired strictness.
        return []

    # Database and Storage settings
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_KEY: Optional[str] = None
    STORAGE_BUCKET_NAME: str = "vitronmax-storage"

    # OpenAI settings
    OPENAI_API_KEY: Optional[str] = None
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
