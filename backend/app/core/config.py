
"""
Application configuration settings.
"""

import os
from typing import Optional
from pydantic import BaseSettings

class Settings(BaseSettings):
    # API Configuration
    OPENAI_API_KEY: str
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
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Global settings instance
settings = Settings()
