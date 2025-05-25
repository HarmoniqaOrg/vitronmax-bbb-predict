"""
Batch processing endpoints for CSV uploads and job management.
"""

import logging
import uuid
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
import io

from app.models.schemas import (
    BatchPredictionRequest,
    BatchJobResponse,
    BatchStatusResponse,
    JobStatus,
)
from app.ml.predictor import BBBPredictor
from app.core.database import get_db
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


def get_predictor() -> BBBPredictor:
    """Dependency to get ML predictor instance."""
    from app.main import app

    return app.state.predictor


async def process_batch_job(
    job_id: str, smiles_data: List[Dict[str, Any]], predictor: BBBPredictor
) -> None:
    """Background task to process batch prediction job."""
    db = get_db()
    failed_count = 0
    processed_count = 0

    try:
        logger.info(f"Starting batch job {job_id} with {len(smiles_data)} molecules")

        # Update job status to processing
        db.table("batch_jobs").update(
            {
                "status": JobStatus.PROCESSING.value,
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("job_id", job_id).execute()

        results = []

        for i, item in enumerate(smiles_data):
            try:
                smiles = item["smiles"]
                molecule_name = item.get("molecule_name", "")

                logger.info(f"Processing molecule {i + 1}/{len(smiles_data)}: {smiles}")

                # Make prediction
                probability, pred_class, confidence, fingerprint = (
                    predictor.predict_single(smiles)
                )
                fp_hash = predictor.calculate_fingerprint_hash(fingerprint)

                result = {
                    "smiles": smiles,
                    "molecule_name": molecule_name,
                    "bbb_probability": probability,
                    "prediction_class": pred_class,
                    "confidence_score": confidence,
                    "fingerprint_hash": fp_hash,
                }
                results.append(result)
                processed_count += 1

            except Exception as e:
                logger.warning(
                    f"Failed to process molecule {item.get('smiles', 'unknown')} in job {job_id}: {e}"
                )
                failed_count += 1
                results.append(
                    {
                        "smiles": item.get("smiles", ""),
                        "molecule_name": item.get("molecule_name", ""),
                        "bbb_probability": 0.0,
                        "prediction_class": "error",
                        "confidence_score": 0.0,
                        "error": str(e),
                    }
                )

            # Update progress every 10 molecules or on completion
            if (i + 1) % 10 == 0 or (i + 1) == len(smiles_data):
                progress = ((i + 1) / len(smiles_data)) * 100
                try:
                    db.table("batch_jobs").update(
                        {
                            "processed_molecules": processed_count,
                            "failed_molecules": failed_count,
                            "progress_percentage": progress,
                            "updated_at": datetime.utcnow().isoformat(),
                        }
                    ).eq("job_id", job_id).execute()
                    logger.info(
                        f"Job {job_id}: {i + 1}/{len(smiles_data)} molecules processed ({progress:.1f}%)"
                    )
                except Exception as e_progress:
                    logger.error(
                        f"Failed to update progress for job {job_id}: {e_progress}"
                    )

        # Store results and update job status
        results_df = pd.DataFrame(results)
        csv_content = results_df.to_csv(index=False)

        # Upload results to storage
        file_name = f"batch_results_{job_id}.csv"
        try:
            db.storage.from_(settings.STORAGE_BUCKET_NAME).upload(
                file_name, csv_content.encode()
            )
            logger.info(f"Results for job {job_id} uploaded to storage: {file_name}")
        except Exception as e_storage:
            logger.error(
                f"Failed to upload results to storage for job {job_id}: {e_storage}"
            )
            file_name = None  # Continue without storage upload if it fails

        # Update job as completed
        try:
            db.table("batch_jobs").update(
                {
                    "status": JobStatus.COMPLETED.value,
                    "processed_molecules": processed_count,
                    "failed_molecules": failed_count,
                    "progress_percentage": 100.0,
                    "results_file_path": file_name,  # Might be None if upload failed
                    "completed_at": datetime.utcnow().isoformat(),
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("job_id", job_id).execute()
            logger.info(
                f"Batch job {job_id} completed successfully with {processed_count} processed and {failed_count} failed molecules."
            )
        except Exception as e_complete:
            logger.error(
                f"Failed to update job completion status for job {job_id}: {e_complete}"
            )

    except Exception as e_job:
        logger.error(f"Batch job {job_id} failed critically: {e_job}", exc_info=True)
        try:
            db.table("batch_jobs").update(
                {
                    "status": JobStatus.FAILED.value,
                    "error_message": str(e_job),
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("job_id", job_id).execute()
        except Exception as e_fail_update:
            logger.error(
                f"Failed to update job {job_id} status to FAILED in DB: {e_fail_update}"
            )


@router.get("/batch_jobs", response_model=List[BatchStatusResponse])
async def get_all_batch_jobs() -> List[BatchStatusResponse]:
    """Get all batch jobs, ordered by creation date (newest first)."""
    db = get_db()

    try:
        response = (
            db.table("batch_jobs")
            .select("*")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )

        jobs = []
        for job_data in response.data:
            jobs.append(
                BatchStatusResponse(
                    job_id=job_data["job_id"],
                    job_name=job_data.get("job_name"),
                    status=JobStatus(job_data["status"]),
                    created_at=datetime.fromisoformat(job_data["created_at"]),
                    updated_at=datetime.fromisoformat(job_data["updated_at"]),
                    total_molecules=job_data["total_molecules"],
                    processed_molecules=job_data.get("processed_molecules", 0),
                    failed_molecules=job_data.get("failed_molecules", 0),
                    progress_percentage=job_data.get("progress_percentage", 0.0),
                    estimated_completion_time=(
                        datetime.fromisoformat(job_data["estimated_completion_time"])
                        if job_data.get("estimated_completion_time")
                        else None
                    ),
                    results_file_path=job_data.get("results_file_path"),
                    error_message=job_data.get("error_message"),
                )
            )

        return jobs

    except Exception as e:
        logger.error(f"Failed to get batch jobs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve batch jobs")


@router.post("/batch_predict_csv", response_model=BatchJobResponse)
async def batch_predict_csv(
    request: BatchPredictionRequest = Depends(),  # For job_name
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = Depends(),
    predictor: BBBPredictor = Depends(get_predictor),
    db: Any = Depends(get_db),
) -> BatchJobResponse:
    """Accepts CSV file for batch BBB permeability prediction."""
    try:
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode()))

        # Validate required columns
        if "smiles" not in df.columns:
            raise HTTPException(
                status_code=400, detail="CSV must contain 'smiles' column"
            )

        # Validate batch size
        if len(df) > settings.MAX_BATCH_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Batch size exceeds maximum of {settings.MAX_BATCH_SIZE}",
            )

        # Clean and prepare data
        df = df.dropna(subset=["smiles"])
        df["molecule_name"] = df.get("molecule_name", pd.Series(dtype="object")).fillna(
            ""
        )  # Ensure column exists even if not in CSV

        smiles_data = df[["smiles", "molecule_name"]].to_dict("records")

        if not smiles_data:
            raise HTTPException(status_code=400, detail="No valid SMILES found in CSV")

        # Create batch job
        job_id = str(uuid.uuid4())
        estimated_completion = datetime.utcnow() + timedelta(
            seconds=len(smiles_data) * settings.ESTIMATED_TIME_PER_MOLECULE
        )

        job_data = {
            "job_id": job_id,
            "job_name": (
                request.job_name
                if request.job_name
                else f"Batch Job {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
            ),
            "status": JobStatus.PENDING.value,
            "total_molecules": len(smiles_data),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "estimated_completion_time": estimated_completion.isoformat(),
        }

        db.table("batch_jobs").insert(job_data).execute()

        # Start background processing
        background_tasks.add_task(process_batch_job, job_id, smiles_data, predictor)

        logger.info(f"Created batch job {job_id} with {len(smiles_data)} molecules")

        return BatchJobResponse(
            job_id=job_id,
            status=JobStatus.PENDING,
            message="Batch job created successfully",
            estimated_completion_time=estimated_completion,
            total_molecules=len(smiles_data),
        )
    except HTTPException:  # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error creating batch job: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error creating batch job: {e}")


@router.get("/batch_status/{job_id}", response_model=BatchStatusResponse)
async def get_batch_status(
    job_id: str, db: Any = Depends(get_db)
) -> BatchStatusResponse:
    """Get status of a specific batch job."""
    try:
        response = (
            db.table("batch_jobs")
            .select("*")
            .eq("job_id", job_id)
            .maybe_single()
            .execute()
        )
        job_data = response.data

        if not job_data:
            raise HTTPException(status_code=404, detail="Batch job not found")

        return BatchStatusResponse(
            job_id=job_data["job_id"],
            job_name=job_data.get("job_name"),
            status=JobStatus(job_data["status"]),
            created_at=datetime.fromisoformat(job_data["created_at"]),
            updated_at=datetime.fromisoformat(job_data["updated_at"]),
            total_molecules=job_data["total_molecules"],
            processed_molecules=job_data.get("processed_molecules", 0),
            failed_molecules=job_data.get("failed_molecules", 0),
            progress_percentage=job_data.get("progress_percentage", 0.0),
            results_file_path=job_data.get("results_file_path"),
            estimated_completion_time=(
                datetime.fromisoformat(job_data["estimated_completion_time"])
                if job_data.get("estimated_completion_time")
                else None
            ),
            error_message=job_data.get("error_message"),
        )
    except HTTPException:  # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error fetching status for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching job status: {e}")


@router.get("/download_batch_results/{job_id}")
async def download_batch_results(job_id: str, db: Any = Depends(get_db)):
    """Download results CSV for a completed batch job."""
    try:
        response = (
            db.table("batch_jobs")
            .select("status, results_file_path")
            .eq("job_id", job_id)
            .maybe_single()
            .execute()
        )
        job_data = response.data

        if not job_data:
            raise HTTPException(status_code=404, detail="Batch job not found")

        if JobStatus(job_data["status"]) != JobStatus.COMPLETED:
            raise HTTPException(
                status_code=400, detail="Job not completed. Results not available."
            )

        file_path = job_data.get("results_file_path")
        if not file_path:
            raise HTTPException(
                status_code=404, detail="Results file path not found for this job."
            )

        # Download results file from storage
        storage_response = db.storage.from_(settings.STORAGE_BUCKET_NAME).download(
            file_path
        )

        return StreamingResponse(
            io.BytesIO(storage_response),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=batch_results_{job_id}.csv"
            },
        )
    except HTTPException:  # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error downloading results for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error downloading results: {e}")
