"""
Batch processing endpoints for CSV uploads and job management.
"""

import logging
import uuid
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import unicodedata
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
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

    # Ensure predictor is of the correct type for Mypy
    assert isinstance(app.state.predictor, BBBPredictor)
    return app.state.predictor


async def process_batch_job(
    job_id: str, smiles_data: List[Dict[str, Any]], predictor: BBBPredictor
) -> None:
    """Background task to process batch prediction job."""
    db = get_db()
    total_molecules = len(smiles_data)
    processed_count = 0  # Successfully predicted molecules
    failed_count = 0  # Molecules that failed prediction or had invalid input

    final_results_for_csv: List[Dict[str, Any]] = []

    try:
        logger.info(f"Starting batch job {job_id} with {total_molecules} molecules")

        # Update job status to processing
        db.table("batch_jobs").update(
            {
                "status": JobStatus.PROCESSING.value,
                "updated_at": datetime.utcnow().isoformat(),
            }
        ).eq("job_id", job_id).execute()

        valid_input_items: List[Dict[str, Any]] = []
        smiles_for_predictor_call: List[str] = []

        # Step 1: Pre-process input, separate valid SMILES for predictor, handle initially invalid ones
        for item_data in smiles_data:
            s = item_data.get("smiles")
            molecule_name = item_data.get("molecule_name", "")

            if isinstance(s, str) and s.strip():
                valid_input_items.append(item_data)
                smiles_for_predictor_call.append(s)
            else:
                # Handle SMILES that are invalid before even calling the predictor
                error_res = {
                    "input_smiles": s if isinstance(s, str) else "INVALID_INPUT_TYPE",
                    "molecule_name": molecule_name,
                    "status": "error_invalid_input_smiles",
                    "bbb_probability": None,
                    "bbb_class": None,
                    "bbb_confidence": None,
                    "mw": None,
                    "logp": None,
                    "tpsa": None,
                    "rot_bonds": None,
                    "h_acceptors": None,
                    "h_donors": None,
                    "frac_csp3": None,
                    "molar_refractivity": None,
                    "log_s_esol": None,
                    "gi_absorption": None,
                    "lipinski_passes": None,
                    "pains_alerts": None,
                    "brenk_alerts": None,
                    "error": "Invalid or empty SMILES string provided in input.",
                }
                final_results_for_csv.append(error_res)
                failed_count += 1

        logger.info(
            f"Job {job_id}: Found {len(smiles_for_predictor_call)} valid SMILES to process, {failed_count} initially invalid items."
        )

        # Step 2: Call predictor.predict_batch with valid SMILES strings
        if smiles_for_predictor_call:
            logger.info(
                f"Job {job_id}: Calling predictor.predict_batch for {len(smiles_for_predictor_call)} SMILES strings."
            )
            results_from_batch_predict: List[Dict[str, Any]] = (
                await predictor.predict_batch(smiles_for_predictor_call)
            )
            logger.info(
                f"Job {job_id}: Received {len(results_from_batch_predict)} results from predictor.predict_batch."
            )

            # Step 3: Merge predictor results with original data (molecule_name) and count success/failure
            if len(results_from_batch_predict) == len(valid_input_items):
                for i, res_dict in enumerate(results_from_batch_predict):
                    original_item = valid_input_items[i]
                    # Add molecule_name from the original input item
                    res_dict["molecule_name"] = original_item.get("molecule_name", "")
                    # 'input_smiles' is already in res_dict from predict_smiles_data

                    final_results_for_csv.append(res_dict)
                    if res_dict.get("status") == "success":
                        processed_count += 1
                    else:
                        failed_count += 1
                        # Ensure 'error' field exists if not set by predictor for non-success status
                        if "error" not in res_dict:
                            res_dict["error"] = res_dict.get(
                                "status", "prediction_error"
                            )
            else:
                # This is an unexpected internal error if counts don't match
                logger.error(
                    f"Job {job_id}: Mismatch in result count from predictor. Expected {len(valid_input_items)}, Got {len(results_from_batch_predict)}. Marking remaining as failed."
                )
                # Account for the discrepancy in failed_count for accurate job summary
                # This part might need more robust handling depending on how critical the mismatch is.
                # For now, we assume the job will be marked as failed later if storage fails or if this error is severe.
                # Add placeholder errors for items that didn't get a result
                num_missing_results = len(valid_input_items) - len(
                    results_from_batch_predict
                )
                failed_count += num_missing_results  # Add to overall failed count
                for i in range(len(results_from_batch_predict), len(valid_input_items)):
                    missing_item_data = valid_input_items[i]
                    error_res = {
                        "input_smiles": missing_item_data.get(
                            "smiles", "UNKNOWN_SMILES_ERROR"
                        ),
                        "molecule_name": missing_item_data.get("molecule_name", ""),
                        "status": "error_missing_predictor_result",
                        "error": "Predictor did not return a result for this item.",
                        # Populate other fields with None or default error values
                        "bbb_probability": None,
                        "bbb_class": None,
                        "bbb_confidence": None,
                        "mw": None,
                        "logp": None,
                        "tpsa": None,
                        "rot_bonds": None,
                        "h_acceptors": None,
                        "h_donors": None,
                        "frac_csp3": None,
                        "molar_refractivity": None,
                        "log_s_esol": None,
                        "gi_absorption": None,
                        "lipinski_passes": None,
                        "pains_alerts": None,
                        "brenk_alerts": None,
                    }
                    final_results_for_csv.append(error_res)

        logger.info(
            f"Job {job_id}: All items processed. Successfully predicted: {processed_count}. Total failed (input or prediction): {failed_count}."
        )

        # Step 4: Update DB progress (once, after all processing)
        try:
            db.table("batch_jobs").update(
                {
                    "processed_molecules": processed_count,  # Number successfully predicted
                    "failed_molecules": failed_count,  # Number failed or invalid input
                    "progress_percentage": 100.0,
                    "updated_at": datetime.utcnow().isoformat(),
                }
            ).eq("job_id", job_id).execute()
            logger.info(f"Job {job_id}: Progress updated to 100%.")
        except Exception as e_progress:
            logger.error(
                f"Failed to update job progress for job {job_id}: {e_progress}"
            )

        # Step 5: Store results to CSV and upload
        results_df = pd.DataFrame(final_results_for_csv)
        # Ensure 'input_smiles' is the first column if it exists, then 'molecule_name'
        cols = list(results_df.columns)
        preferred_order = ["input_smiles", "molecule_name"]
        for col_name in reversed(preferred_order):
            if col_name in cols:
                cols.insert(0, cols.pop(cols.index(col_name)))
        results_df = results_df.loc[:, cols]

        csv_content = results_df.to_csv(index=False)

        results_file_storage_path: Optional[str] = f"batch_results_{job_id}.csv"
        storage_upload_successful = False  # Flag to track success
        storage_error_details = ""
        try:
            # The FileOptions TypedDict expects upsert: bool. However, a runtime error
            # "Header value must be str or bytes, not <class 'bool'>" occurs.
            # Testing with upsert: "true" (str) to see if it resolves the issue.
            # The storage library should handle str("true").lower() correctly.
            file_options: Dict[str, str] = {
                "cache_control": "3600",
                "upsert": "true",
            }

            db.storage.from_(settings.STORAGE_BUCKET_NAME).upload(
                path=results_file_storage_path,
                file=csv_content.encode(),
                file_options=file_options,
            )
            logger.info(
                f"Results for job {job_id} uploaded to storage: {results_file_storage_path}"
            )
            storage_upload_successful = True  # Mark as successful
        except Exception as e_storage:
            logger.error(
                f"Failed to upload results to storage for job {job_id}: {e_storage}"
            )
            storage_error_details = str(e_storage)
            # results_file_storage_path remains the intended path, but we know it failed.
            # The error_message will indicate this.

        # Update job status based on storage upload success
        final_status = (
            JobStatus.COMPLETED.value
            if storage_upload_successful
            else JobStatus.FAILED.value
        )
        final_results_path = (
            results_file_storage_path if storage_upload_successful else None
        )
        final_error_message = (
            None
            if storage_upload_successful
            else f"Failed to upload results to storage: {storage_error_details}"
        )

        try:
            update_payload: Dict[str, Any] = {
                "status": final_status,
                "processed_molecules": processed_count,
                "failed_molecules": failed_count,
                "progress_percentage": 100.0,
                "results_file_path": final_results_path,
                "completed_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            if final_error_message:
                update_payload["error_message"] = final_error_message

            db.table("batch_jobs").update(update_payload).eq("job_id", job_id).execute()

            if storage_upload_successful:
                logger.info(
                    f"Batch job {job_id} completed successfully with {processed_count} processed and {failed_count} failed molecules."
                )
            else:
                logger.error(
                    f"Batch job {job_id} marked as FAILED due to storage upload error. {processed_count} processed, {failed_count} failed."
                )
        except Exception as e_complete:
            logger.error(
                f"Failed to update job final status for job {job_id}: {e_complete}"
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


@router.get("/", response_model=List[BatchStatusResponse])
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
            # Define the format string for strptime
            iso_format_with_offset = "%Y-%m-%dT%H:%M:%S.%f%z"

            # Preprocess created_at timestamp string
            created_at_str = job_data["created_at"]
            if len(created_at_str) > 6 and created_at_str[-3] == ":":
                created_at_str = created_at_str[:-3] + created_at_str[-2:]
            parsed_created_at = datetime.strptime(
                created_at_str, iso_format_with_offset
            )

            # Preprocess updated_at timestamp string
            updated_at_str = job_data["updated_at"]
            if len(updated_at_str) > 6 and updated_at_str[-3] == ":":
                updated_at_str = updated_at_str[:-3] + updated_at_str[-2:]
            parsed_updated_at = datetime.strptime(
                updated_at_str, iso_format_with_offset
            )

            # Preprocess estimated_completion_time timestamp string
            parsed_estimated_completion_time = None
            estimated_completion_time_str = job_data.get("estimated_completion_time")
            if estimated_completion_time_str:
                if (
                    len(estimated_completion_time_str) > 6
                    and estimated_completion_time_str[-3] == ":"
                ):
                    estimated_completion_time_str = (
                        estimated_completion_time_str[:-3]
                        + estimated_completion_time_str[-2:]
                    )
                # Ensure the string is not empty before parsing
                if estimated_completion_time_str:
                    parsed_estimated_completion_time = datetime.strptime(
                        estimated_completion_time_str, iso_format_with_offset
                    )

            jobs.append(
                BatchStatusResponse(
                    job_id=job_data["job_id"],
                    job_name=job_data.get("job_name"),
                    status=JobStatus(job_data["status"]),
                    created_at=parsed_created_at,
                    updated_at=parsed_updated_at,
                    total_molecules=job_data["total_molecules"],
                    processed_molecules=job_data.get("processed_molecules", 0),
                    failed_molecules=job_data.get("failed_molecules", 0),
                    progress_percentage=job_data.get("progress_percentage", 0.0),
                    estimated_completion_time=parsed_estimated_completion_time,
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
    background_tasks: BackgroundTasks,
    request: BatchPredictionRequest = Depends(),  # For job_name
    file: UploadFile = File(...),
    predictor: BBBPredictor = Depends(get_predictor),
    db: Any = Depends(get_db),
) -> BatchJobResponse:
    """Accepts CSV file for batch BBB permeability prediction."""
    job_id = str(uuid.uuid4())
    job_name = (
        request.job_name or f"Batch Job {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
    )
    logger.info(
        f"Received batch predict request for job_name: '{job_name}', assigned job_id: {job_id}"
    )

    contents = await file.read()
    logger.info(f"Job {job_id}: Read {len(contents)} bytes from uploaded file.")

    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        try:
            # Try with utf-8-sig first to handle potential BOM
            contents_decoded = contents.decode("utf-8-sig")
            df = pd.read_csv(io.StringIO(contents_decoded))
            logger.info(
                f"Job {job_id}: Successfully decoded CSV as utf-8-sig and parsed."
            )
        except UnicodeDecodeError:
            logger.warning(
                f"Job {job_id}: Failed to decode CSV as utf-8-sig. Trying default pandas decoding from bytes."
            )
            df = pd.read_csv(io.BytesIO(contents))
            logger.info(
                f"Job {job_id}: Parsed CSV with pandas default byte stream decoding."
            )
        except Exception as e:
            logger.error(f"Job {job_id}: Failed to parse CSV. Error: {e}")
            raise HTTPException(
                status_code=400, detail=f"Failed to parse CSV file. Error: {e}"
            )

        if df.empty:
            logger.error(
                f"Job {job_id}: CSV file is empty or resulted in an empty DataFrame."
            )
            raise HTTPException(
                status_code=400, detail="CSV file is empty or unreadable."
            )

        original_columns = list(df.columns)
        logger.info(
            f"Job {job_id}: CSV parsed. Shape: {df.shape}. Columns (original): {original_columns}"
        )

        # Robust column name normalization
        normalized_columns = []
        for col in original_columns:
            try:
                normalized_col = unicodedata.normalize("NFKC", str(col)).strip().lower()
                normalized_columns.append(normalized_col)
            except Exception as e:
                logger.warning(
                    f"Job {job_id}: Could not normalize column name '{col}'. Error: {e}. Using basic lowercasing."
                )
                normalized_columns.append(str(col).strip().lower())

        df.columns = pd.Index(normalized_columns)  # Converted to pd.Index
        logger.info(
            f"Job {job_id}: Columns after full normalization: {df.columns.tolist()}"
        )

        if "smiles" not in df.columns:
            error_detail_msg = (
                f"CSV must contain a 'smiles' column (case-insensitive). "
                f"After normalization, found columns: {df.columns.tolist()}. "
                f"Original columns were: {original_columns}."
            )
            logger.error(f"Job {job_id}: {error_detail_msg}")
            raise HTTPException(
                status_code=400,
                detail=error_detail_msg,
            )

        # Handle molecule_name: use 'compound_name' as fallback, then empty string
        if "molecule_name" in df.columns:
            df["molecule_name"] = df["molecule_name"].astype(str).fillna("")
        elif "compound_name" in df.columns:
            df["molecule_name"] = df["compound_name"].astype(str).fillna("")
            logger.info(
                f"Job {job_id}: Using 'compound_name' column as 'molecule_name'."
            )
        else:
            df["molecule_name"] = ""  # Assign a default Series of empty strings
            logger.info(
                f"Job {job_id}: 'molecule_name' and 'compound_name' not found. Using empty strings for molecule names."
            )

        smiles_data_list: List[Dict[str, Any]] = []
        for _, row in df.iterrows():
            item_data: Dict[str, Any] = {}
            raw_smiles_field = str(
                row.get("smiles", "")
            )  # Get the raw content of the SMILES column

            # Check if the problematic pattern ',""' exists,
            # which indicates a combined SMILES string and description.
            if ',""' in raw_smiles_field:
                # Split the string at the first occurrence of ',\""'
                # The first part should be the SMILES string.
                parts = raw_smiles_field.split(',""', 1)
                actual_smiles = parts[0]
            else:
                # If the pattern isn't found, assume the field is already just the SMILES string
                # or can be cleaned directly.
                actual_smiles = raw_smiles_field

            # Remove any leading/trailing whitespace and then any surrounding quotes
            # from the determined SMILES string.
            item_data["smiles"] = actual_smiles.strip().strip('"')

            if "molecule_name" in row:
                item_data["molecule_name"] = str(row.get("molecule_name", ""))

            smiles_data_list.append(item_data)

        total_molecules = len(smiles_data_list)
        logger.info(
            f"Job {job_id}: Extracted {total_molecules} records for processing."
        )

        if not smiles_data_list:
            raise HTTPException(status_code=400, detail="No valid SMILES found in CSV")

        logger.info(
            f"Job {job_id}: Extracted {total_molecules} records for processing."
        )

        # Estimate completion time (very rough estimate)
        estimated_completion = datetime.utcnow() + timedelta(
            seconds=total_molecules * settings.ESTIMATED_TIME_PER_MOLECULE
        )

        job_data = {
            "job_id": job_id,
            "job_name": job_name,
            "status": JobStatus.PENDING.value,
            "total_molecules": total_molecules,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "estimated_completion_time": estimated_completion.isoformat(),
        }

        db.table("batch_jobs").insert(job_data).execute()

        # Pass the full list of SMILES data to a single background task
        logger.info(
            f"Job {job_id}: About to add task. Length of smiles_data being passed: {len(smiles_data_list)}"
        )
        background_tasks.add_task(
            process_batch_job,
            job_id,
            smiles_data_list,
            predictor,  # Pass full smiles_data
        )

        created_at = datetime.utcnow()
        logger.info(f"Created batch job {job_id} with {total_molecules} molecules")

        return BatchJobResponse(
            job_id=job_id,
            status=JobStatus.PENDING,
            created_at=created_at,
            estimated_completion_time=estimated_completion,
            total_molecules=total_molecules,
            detail="Batch job created and queued for processing.",
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

        # Apply datetime parsing fix for fields from Supabase
        datetime_fields_to_parse = [
            "created_at",
            "updated_at",
            "estimated_completion_time",
            "completed_at",
        ]
        for field_name in datetime_fields_to_parse:
            dt_str = job_data.get(field_name)
            if isinstance(dt_str, str):
                # Remove colon from timezone offset if present (e.g., +00:00 -> +0000)
                # Check if the string is long enough and has a colon at the third to last position
                if len(dt_str) > 5 and dt_str[-3] == ":":
                    dt_str = dt_str[:-3] + dt_str[-2:]
                try:
                    # Parse the datetime string using strptime
                    job_data[field_name] = datetime.strptime(
                        dt_str, "%Y-%m-%dT%H:%M:%S.%f%z"
                    )
                except ValueError as e_parse:
                    logger.error(
                        f"Error parsing datetime string '{dt_str}' for field '{field_name}' in job {job_id}: {e_parse}. Allowing Pydantic to attempt parsing."
                    )
                    # If strptime fails, we let Pydantic try. If Pydantic also fails, it will raise its own validation error.
                    pass  # Let Pydantic handle it if our specific parsing fails

        return BatchStatusResponse(**job_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching status for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching job status: {e}")


@router.get("/download_batch_results/{job_id}")
async def download_batch_results(
    job_id: str, db: Any = Depends(get_db)
) -> StreamingResponse:
    logger.info(
        f"[BATCH_DOWNLOAD] Attempting to download results for job_id: {job_id} at /api/v1/batch_jobs/download_batch_results/{job_id}"
    )
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
