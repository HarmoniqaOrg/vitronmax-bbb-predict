from pydantic import BaseModel


class PlatformStatisticsResponse(BaseModel):
    total_predictions: int
    total_batch_jobs: int
    avg_batch_processing_time_seconds: float
    overall_batch_success_rate_percentage: float
