import logging
from fastapi import APIRouter, Depends
from typing import Any
from datetime import datetime

from app.core.database import get_db
from app.models.statistics import PlatformStatisticsResponse
from app.models.schemas import JobStatus  # Import JobStatus

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/platform-statistics", response_model=PlatformStatisticsResponse)
async def get_platform_statistics(
    db: Any = Depends(get_db),
) -> PlatformStatisticsResponse:
    logger.info("Fetching platform statistics")

    total_predictions = 0
    total_batch_jobs = 0
    total_processing_time_seconds = 0.0
    completed_job_count_for_avg_time = 0
    total_successful_molecules = 0
    total_molecules_in_completed_jobs = 0

    try:
        # Get total number of batch jobs
        count_response = (
            db.table("batch_jobs").select("job_id", count="exact").execute()
        )
        total_batch_jobs = (
            count_response.count if count_response.count is not None else 0
        )

        # Get all completed batch jobs for other stats
        completed_jobs_response = (
            db.table("batch_jobs")
            .select("total_molecules, failed_molecules, created_at, completed_at")
            .eq("status", JobStatus.COMPLETED.value)
            .execute()
        )

        if completed_jobs_response.data:
            for job in completed_jobs_response.data:
                if (
                    job.get("total_molecules") is not None
                    and job["total_molecules"] > 0
                ):
                    total_predictions += job["total_molecules"]
                    total_molecules_in_completed_jobs += job["total_molecules"]
                    successful_molecules_in_job = job["total_molecules"] - (
                        job.get("failed_molecules", 0) or 0
                    )
                    total_successful_molecules += successful_molecules_in_job

                created_at_str = job.get("created_at")
                completed_at_str = job.get("completed_at")

                if created_at_str and completed_at_str:
                    # Ensure correct parsing for timestamps which might have 'Z' or offset
                    # Python's fromisoformat handles 'Z' but might need adjustment for other offsets if not standard
                    # The Supabase client typically returns ISO 8601 strings that fromisoformat can handle.
                    try:
                        # Adjust for potential timezone format issues if necessary, as seen in batch.py
                        if created_at_str.endswith("+00:00"):
                            created_at_str = created_at_str.replace("+00:00", "Z")
                        if completed_at_str.endswith("+00:00"):
                            completed_at_str = completed_at_str.replace("+00:00", "Z")

                        # For parsing with %z, timezone offset should not have ':'
                        # Example: '2023-10-26T10:00:00.123456+0000'
                        # However, fromisoformat is generally more robust for standard ISO strings.
                        # Let's stick to fromisoformat and handle potential issues if they arise.
                        # A common format from Supabase includes a timezone offset like +00:00 or similar.
                        # datetime.fromisoformat can handle these if they are standard.
                        # If parsing issues arise, we might need strptime like in batch.py

                        # Simplified parsing assuming standard ISO format or 'Z' for UTC
                        # Prepare for strptime: remove colon from timezone offset if present
                        if (
                            isinstance(created_at_str, str)
                            and len(created_at_str) > 6
                            and created_at_str[-3] == ":"
                        ):
                            created_at_str = created_at_str[:-3] + created_at_str[-2:]
                        if (
                            isinstance(completed_at_str, str)
                            and len(completed_at_str) > 6
                            and completed_at_str[-3] == ":"
                        ):
                            completed_at_str = (
                                completed_at_str[:-3] + completed_at_str[-2:]
                            )

                        # Parse with strptime, supporting microseconds and timezone offset without colon
                        created_at = datetime.strptime(
                            created_at_str, "%Y-%m-%dT%H:%M:%S.%f%z"
                        )
                        completed_at = datetime.strptime(
                            completed_at_str, "%Y-%m-%dT%H:%M:%S.%f%z"
                        )

                        processing_time = completed_at - created_at
                        total_processing_time_seconds += processing_time.total_seconds()
                        completed_job_count_for_avg_time += 1
                    except ValueError as e_time:
                        logger.warning(
                            f"Could not parse timestamps for job to calculate processing time: {job.get('job_id', 'unknown_id')}, created='{created_at_str}', completed='{completed_at_str}'. Error: {e_time}"
                        )

        avg_batch_processing_time_seconds = (
            (total_processing_time_seconds / completed_job_count_for_avg_time)
            if completed_job_count_for_avg_time > 0
            else 0.0
        )

        overall_batch_success_rate_percentage = (
            (total_successful_molecules / total_molecules_in_completed_jobs) * 100
            if total_molecules_in_completed_jobs > 0
            else 0.0
        )

        return PlatformStatisticsResponse(
            total_predictions=total_predictions,
            total_batch_jobs=total_batch_jobs,
            avg_batch_processing_time_seconds=round(
                avg_batch_processing_time_seconds, 1
            ),
            overall_batch_success_rate_percentage=round(
                overall_batch_success_rate_percentage, 1
            ),
        )

    except Exception as e:
        logger.error(f"Error fetching platform statistics: {e}", exc_info=True)
        # Return default/error state or raise HTTPException
        return PlatformStatisticsResponse(
            total_predictions=0,
            total_batch_jobs=0,
            avg_batch_processing_time_seconds=0.0,
            overall_batch_success_rate_percentage=0.0,
        )
