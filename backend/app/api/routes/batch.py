
"""
Batch processing endpoints for CSV uploads and job management.
"""

import logging
import uuid
import asyncio
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
import io

from app.models.schemas import (
    BatchPredictionRequest, BatchJobResponse, BatchStatusResponse, JobStatus
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
    job_id: str,
    smiles_data: List[Dict[str, Any]],
    predictor: BBBPredictor
) -> None:
    """Background task to process batch prediction job."""
    db = get_db()
    
    try:
        logger.info(f"Starting batch job {job_id} with {len(smiles_data)} molecules")
        
        # Update job status to processing
        db.table("batch_jobs").update({
            "status": JobStatus.PROCESSING.value,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("job_id", job_id).execute()
        
        results = []
        processed_count = 0
        
        for item in smiles_data:
            try:
                smiles = item["smiles"]
                molecule_name = item.get("molecule_name", "")
                
                # Make prediction
                probability, pred_class, confidence, fingerprint = predictor.predict_single(smiles)
                fp_hash = predictor.calculate_fingerprint_hash(fingerprint)
                
                result = {
                    "smiles": smiles,
                    "molecule_name": molecule_name,
                    "bbb_probability": probability,
                    "prediction_class": pred_class,
                    "confidence_score": confidence,
                    "fingerprint_hash": fp_hash
                }
                results.append(result)
                processed_count += 1
                
                # Update progress every 100 molecules
                if processed_count % 100 == 0:
                    progress = (processed_count / len(smiles_data)) * 100
                    db.table("batch_jobs").update({
                        "processed_molecules": processed_count,
                        "progress_percentage": progress,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("job_id", job_id).execute()
                
            except Exception as e:
                logger.warning(f"Failed to process molecule {item.get('smiles', 'unknown')}: {e}")
                results.append({
                    "smiles": item.get("smiles", ""),
                    "molecule_name": item.get("molecule_name", ""),
                    "bbb_probability": 0.0,
                    "prediction_class": "error",
                    "confidence_score": 0.0,
                    "error": str(e)
                })
        
        # Store results and update job status
        results_df = pd.DataFrame(results)
        csv_content = results_df.to_csv(index=False)
        
        # Upload results to storage
        file_name = f"batch_results_{job_id}.csv"
        storage_response = db.storage.from_(settings.STORAGE_BUCKET_NAME).upload(
            file_name, csv_content.encode()
        )
        
        # Update job as completed
        db.table("batch_jobs").update({
            "status": JobStatus.COMPLETED.value,
            "processed_molecules": len(results),
            "progress_percentage": 100.0,
            "results_file_path": file_name,
            "completed_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("job_id", job_id).execute()
        
        logger.info(f"Batch job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Batch job {job_id} failed: {e}", exc_info=True)
        
        # Update job as failed
        db.table("batch_jobs").update({
            "status": JobStatus.FAILED.value,
            "error_message": str(e),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("job_id", job_id).execute()


@router.post("/batch_predict_csv", response_model=BatchJobResponse)
async def batch_predict_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    job_name: str = None,
    notify_email: str = None,
    predictor: BBBPredictor = Depends(get_predictor)
) -> BatchJobResponse:
    """
    Upload CSV file for batch BBB permeability prediction.
    
    Expected CSV format:
    - Required column: 'smiles'
    - Optional column: 'molecule_name'
    
    Returns job ID for status tracking.
    """
    db = get_db()
    
    try:
        # Validate file
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
        # Read and validate CSV
        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large")
        
        df = pd.read_csv(io.StringIO(content.decode()))
        
        # Validate required columns
        if 'smiles' not in df.columns:
            raise HTTPException(status_code=400, detail="CSV must contain 'smiles' column")
        
        # Validate batch size
        if len(df) > settings.MAX_BATCH_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"Batch size exceeds maximum of {settings.MAX_BATCH_SIZE}"
            )
        
        # Clean and prepare data
        df = df.dropna(subset=['smiles'])
        df['molecule_name'] = df.get('molecule_name', '').fillna('')
        
        smiles_data = df[['smiles', 'molecule_name']].to_dict('records')
        
        # Create batch job
        job_id = str(uuid.uuid4())
        estimated_completion = datetime.utcnow() + timedelta(
            minutes=len(smiles_data) * 0.1  # Estimate 0.1 min per molecule
        )
        
        job_data = {
            "job_id": job_id,
            "job_name": job_name or f"Batch_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            "status": JobStatus.PENDING.value,
            "total_molecules": len(smiles_data),
            "processed_molecules": 0,
            "failed_molecules": 0,
            "progress_percentage": 0.0,
            "notify_email": notify_email,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "estimated_completion_time": estimated_completion.isoformat()
        }
        
        db.table("batch_jobs").insert(job_data).execute()
        
        # Start background processing
        background_tasks.add_task(process_batch_job, job_id, smiles_data, predictor)
        
        logger.info(f"Created batch job {job_id} with {len(smiles_data)} molecules")
        
        return BatchJobResponse(
            job_id=job_id,
            status=JobStatus.PENDING,
            created_at=datetime.utcnow(),
            estimated_completion_time=estimated_completion,
            total_molecules=len(smiles_data)
        )
        
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    except pd.errors.ParserError as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV format: {str(e)}")
    except Exception as e:
        logger.error(f"Batch upload failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process batch upload")


@router.get("/batch_status/{job_id}", response_model=BatchStatusResponse)
async def get_batch_status(job_id: str) -> BatchStatusResponse:
    """Get status of batch prediction job."""
    db = get_db()
    
    try:
        response = db.table("batch_jobs").select("*").eq("job_id", job_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job_data = response.data[0]
        
        return BatchStatusResponse(
            job_id=job_data["job_id"],
            status=JobStatus(job_data["status"]),
            created_at=datetime.fromisoformat(job_data["created_at"]),
            updated_at=datetime.fromisoformat(job_data["updated_at"]),
            total_molecules=job_data["total_molecules"],
            processed_molecules=job_data["processed_molecules"],
            failed_molecules=job_data["failed_molecules"],
            progress_percentage=job_data["progress_percentage"],
            estimated_completion_time=datetime.fromisoformat(
                job_data["estimated_completion_time"]
            ) if job_data.get("estimated_completion_time") else None,
            error_message=job_data.get("error_message")
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get batch status: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve job status")


@router.get("/download/{job_id}")
async def download_batch_results(job_id: str) -> StreamingResponse:
    """Download batch prediction results as CSV."""
    db = get_db()
    
    try:
        # Get job info
        response = db.table("batch_jobs").select("*").eq("job_id", job_id).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Job not found")
        
        job_data = response.data[0]
        
        if job_data["status"] != JobStatus.COMPLETED.value:
            raise HTTPException(status_code=400, detail="Job not completed yet")
        
        # Download results file
        file_path = job_data["results_file_path"]
        storage_response = db.storage.from_(settings.STORAGE_BUCKET_NAME).download(file_path)
        
        # Create streaming response
        def generate():
            yield storage_response
        
        return StreamingResponse(
            io.BytesIO(storage_response),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=results_{job_id}.csv"}
        )
        
    except Exception as e:
        logger.error(f"Download failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to download results")
