"""
Database connection and initialization.
"""

import logging
from typing import Optional
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global Supabase client
supabase: Optional[Client] = None


async def init_db() -> None:
    """Initialize database connection."""
    global supabase

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        logger.error(
            "Supabase URL or Service Key not configured. Database will not be initialized."
        )
        supabase = None
        return

    try:
        # At this point, SUPABASE_URL and SUPABASE_SERVICE_KEY are known to be str
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

        # Test connection
        supabase.table("batch_jobs").select("job_id").limit(1).execute()
        logger.info("Database connection established successfully")

    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


def get_db() -> Client:
    """Get database client instance."""
    if supabase is None:
        raise RuntimeError("Database not initialized")
    return supabase
