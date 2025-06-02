"""
Batch processing endpoints for CSV uploads and job management.
"""

import logging
import uuid
import pandas as pd
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import unicodedata
import asyncio
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


async def _execute_batch_insert_items(
    db: Any,
    job_id: str,
    items_batch: List[Dict[str, Any]],
    logger_instance: logging.Logger,
) -> bool:
    """Helper function to batch insert items into batch_prediction_items."""
    if not items_batch:
        return True
    try:
        logger_instance.info(
            f"Job {job_id}: Attempting to batch insert {len(items_batch)} items into batch_prediction_items."
        )
        # Supabase client's insert method accepts a list of dicts for bulk inserts.
        # Run the synchronous db call in a separate thread to avoid blocking the event loop
        response = await asyncio.to_thread(
            db.table("batch_prediction_items").insert(items_batch).execute
        )

        # Check PostgREST response structure for success
        # Assuming a successful insert returns data (list of inserted rows)
        if (
            hasattr(response, "data")
            and response.data
            and isinstance(response.data, list)
        ):
            logger_instance.info(
                f"Job {job_id}: Successfully batch inserted {len(response.data)} items."
            )
            return True
        elif hasattr(response, "error") and response.error:
            # Log detailed PostgREST error if available
            err_code = getattr(response.error, "code", "N/A")
            err_message = getattr(response.error, "message", "N/A")
            err_details = getattr(response.error, "details", "N/A")
            err_hint = getattr(response.error, "hint", "N/A")
            logger_instance.error(
                f"Job {job_id}: Batch insert failed. DB Error: Code {err_code}, Message: {err_message}, Details: {err_details}, Hint: {err_hint}"
            )
            return False
        else:
            logger_instance.error(
                f"Job {job_id}: Batch insert failed with unexpected response structure. Response: {response}"
            )
            return False
    except Exception as e_batch_insert:
        logger_instance.error(
            f"Job {job_id}: Exception during batch insert: {e_batch_insert}",
            exc_info=True,
        )
        return False


def _update_job_progress_in_db(
    db: Any, job_id: str, processed_count: int, failed_count: int, total_molecules: int
) -> None:
    """Helper function to update job progress in the database."""
    if total_molecules == 0:
        current_progress_percentage = 0.0
    else:
        current_progress_percentage = (
            (processed_count + failed_count) / total_molecules
        ) * 100

    update_payload = {
        "processed_molecules": processed_count,
        "failed_molecules": failed_count,
        "progress_percentage": round(current_progress_percentage, 2),
        "updated_at": datetime.utcnow().isoformat(),
    }
    try:
        db.table("batch_jobs").update(update_payload).eq("job_id", job_id).execute()
        logger.info(
            f"Job {job_id}: Progress updated - Processed: {processed_count}, Failed: {failed_count}, "
            f"Total Handled: {processed_count + failed_count}/{total_molecules}, "
            f"Percentage: {current_progress_percentage:.2f}%"
        )
    except Exception as e_progress_update:
        logger.error(
            f"Job {job_id}: Failed to update progress in DB: {e_progress_update}",
            exc_info=True,
        )


def get_predictor() -> BBBPredictor:
    """Dependency to get ML predictor instance."""
    from app.main import app

    # Ensure predictor is of the correct type for Mypy
    assert isinstance(app.state.predictor, BBBPredictor)
    return app.state.predictor


async def process_batch_job(
    job_id: str,
    # job_name is used for logging within process_batch_job, but the filename for batch_predictions comes from original_filename
    job_name: str,  # This is the sanitized job_name from batch_predict_csv
    original_filename: str,  # This is the sanitized original_filename from batch_predict_csv
    smiles_data: List[Dict[str, Any]],
    predictor: BBBPredictor,
    db: Any,
) -> None:
    """Background task to process batch prediction job."""
    total_molecules = len(smiles_data)
    UPDATE_DB_INTERVAL = (
        250  # Update progress every N items (Increased from 50, previously 10)
    )
    BATCH_INSERT_SIZE = 100  # Insert 100 records into batch_prediction_items at a time
    items_for_db_batch: List[Dict[str, Any]] = []
    processed_count = 0  # Successfully predicted molecules
    failed_count = 0  # Molecules that failed prediction or had invalid input

    final_results_for_csv: List[Dict[str, Any]] = []

    try:
        logger.info(
            f"Job {job_id}: Starting background processing for job_name: '{job_name}'"
        )

        # Create a record in batch_predictions to link items
        batch_prediction_data = {
            "id": job_id,  # This is the job_id from batch_jobs
            "filename": original_filename,
            "status": JobStatus.PROCESSING.value,
            "created_at": datetime.utcnow().isoformat(),
            "total_molecules": total_molecules,
            "processed_molecules": 0,
            "completed_at": None,  # Will be set upon completion
            "result_url": None,  # Will be set upon completion
            "error_message": None,  # Will be set if the whole batch prediction fails
        }
        try:
            logger.info(
                f"Job {job_id}: Attempting to insert record into batch_predictions: {batch_prediction_data}"
            )
            insert_bp_response = (
                db.table("batch_predictions").insert(batch_prediction_data).execute()
            )
            if not (hasattr(insert_bp_response, "data") and insert_bp_response.data):
                error_msg = f"Failed to insert record into batch_predictions. Response: {insert_bp_response}"
                logger.error(f"Job {job_id}: {error_msg}")
                db.table("batch_jobs").update(
                    {
                        "status": JobStatus.FAILED.value,
                        "error_message": error_msg,
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("job_id", job_id).execute()
                return  # Stop processing
            logger.info(
                f"Job {job_id}: Successfully inserted record into batch_predictions: {insert_bp_response.data}"
            )
        except Exception as e_bp:
            error_msg = f"Exception inserting into batch_predictions: {str(e_bp)}"
            logger.error(f"Job {job_id}: {error_msg}", exc_info=True)
            try:
                db.table("batch_jobs").update(
                    {
                        "status": JobStatus.FAILED.value,
                        "error_message": error_msg,
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).eq("job_id", job_id).execute()
            except Exception as e_update_job:
                logger.error(
                    f"Job {job_id}: Additionally failed to update batch_jobs to FAILED: {e_update_job}",
                    exc_info=True,
                )
            return  # Stop processing

        # Initialize job status in the database (or ensure it's already PENDING)
        # The main batch_jobs status is already PENDING, here we update for PROCESSING start for batch_predictions items
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
                    "smiles": s if isinstance(s, str) else "INVALID_INPUT_TYPE",
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
                # Periodic progress update for initially invalid SMILES
                if (
                    (processed_count + failed_count) % UPDATE_DB_INTERVAL == 0
                    and (processed_count + failed_count) > 0
                    and (processed_count + failed_count) < total_molecules
                ):
                    _update_job_progress_in_db(
                        db, job_id, processed_count, failed_count, total_molecules
                    )

                # Add error record for initially invalid SMILES to batch
                item_to_insert_error = {
                    "batch_id": job_id,
                    "smiles": s if isinstance(s, str) else "INVALID_INPUT_TYPE",
                    "row_number": len(
                        final_results_for_csv
                    ),  # or a more robust row counter if available
                    "probability": None,
                    "model_version": settings.MODEL_VERSION,  # Default model version
                    "molecular_weight": None,
                    "log_p": None,
                    "tpsa": None,
                    "num_rotatable_bonds": None,
                    "num_h_acceptors": None,
                    "num_h_donors": None,
                    "fraction_csp3": None,
                    "molar_refractivity": None,
                    "log_s_esol": None,
                    "gi_absorption": None,
                    "lipinski_rule_of_five_passes": None,
                    "pains_alert_count": None,
                    "brenk_alert_count": None,
                    "num_heavy_atoms": None,
                    "molecular_formula": None,  # Add this missing key
                    "prediction_certainty": None,
                    "applicability_score": None,
                    "error_message": error_res.get(
                        "error", "Invalid or empty SMILES string provided in input."
                    ),
                }
                items_for_db_batch.append(item_to_insert_error)

                if len(items_for_db_batch) >= BATCH_INSERT_SIZE:
                    logger.info(
                        f"Job {job_id}: Reached BATCH_INSERT_SIZE ({BATCH_INSERT_SIZE}) for initially invalid SMILES. Executing batch insert."
                    )
                    batch_insert_success = await _execute_batch_insert_items(
                        db, job_id, items_for_db_batch, logger
                    )
                    if batch_insert_success:
                        items_for_db_batch.clear()
                    else:
                        logger.error(
                            f"Job {job_id}: Batch insert failed for a chunk of initially invalid SMILES. Clearing batch to proceed. Some items may not be in DB."
                        )
                        items_for_db_batch.clear()  # Clear to avoid retrying same failed batch

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

                    # Periodic progress update after processing a prediction result
                    if (
                        (processed_count + failed_count) % UPDATE_DB_INTERVAL == 0
                        and (processed_count + failed_count) > 0
                        and (processed_count + failed_count) < total_molecules
                    ):
                        _update_job_progress_in_db(
                            db, job_id, processed_count, failed_count, total_molecules
                        )

                    # Prepare data for batch_prediction_items table
                    item_to_insert = {
                        "batch_id": job_id,
                        "smiles": res_dict.get("smiles"),
                        "row_number": i
                        + 1,  # Assuming 1-based for now, adjust if original row numbers are available
                        "probability": res_dict.get("bbb_probability"),
                        "prediction_certainty": res_dict.get("prediction_certainty"),
                        "applicability_score": res_dict.get("applicability_score"),
                        "model_version": res_dict.get(
                            "model_version", settings.MODEL_VERSION
                        ),
                        "molecular_weight": res_dict.get("mw"),
                        "log_p": res_dict.get("logp"),
                        "tpsa": res_dict.get("tpsa"),
                        "num_rotatable_bonds": res_dict.get("rot_bonds"),
                        "num_h_acceptors": res_dict.get("h_acceptors"),
                        "num_h_donors": res_dict.get("h_donors"),
                        "fraction_csp3": res_dict.get("frac_csp3"),
                        "molar_refractivity": res_dict.get("molar_refractivity"),
                        "log_s_esol": res_dict.get("log_s_esol"),
                        "gi_absorption": res_dict.get("gi_absorption"),
                        "lipinski_rule_of_five_passes": res_dict.get("lipinski_passes"),
                        "pains_alert_count": res_dict.get("pains_alerts"),
                        "brenk_alert_count": res_dict.get("brenk_alerts"),
                        "num_heavy_atoms": res_dict.get("heavy_atoms"),
                        "molecular_formula": res_dict.get("mol_formula"),
                        "error_message": (
                            res_dict.get("error")
                            if res_dict.get("status") != "success"
                            else None
                        ),
                    }
                    item_to_insert_cleaned = {
                        k: v for k, v in item_to_insert.items() if v is not None
                    }

                    # Add the cleaned prediction result (or error placeholder) to the batch
                    items_for_db_batch.append(item_to_insert_cleaned)

            else:
                # This is an unexpected internal error if counts don't match
                logger.error(
                    f"Job {job_id}: Mismatch in result count from predictor. Expected {len(valid_input_items)}, Got {len(results_from_batch_predict)}. Marking remaining as failed."
                )
                num_missing_results = len(valid_input_items) - len(
                    results_from_batch_predict
                )
                failed_count += num_missing_results
                for i in range(len(results_from_batch_predict), len(valid_input_items)):
                    missing_item_data = valid_input_items[i]
                    error_res_missing = {
                        "smiles": missing_item_data.get(
                            "smiles", "UNKNOWN_SMILES_ERROR"
                        ),
                        "molecule_name": missing_item_data.get("molecule_name", ""),
                        "status": "error_missing_predictor_result",
                        "error": "Predictor did not return a result for this item.",
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
                    final_results_for_csv.append(error_res_missing)
                    item_to_insert_missing_error = {
                        "batch_id": job_id,
                        "smiles": error_res_missing["smiles"],
                        "row_number": len(final_results_for_csv),
                        "probability": None,
                        "model_version": settings.MODEL_VERSION,
                        "error_message": error_res_missing["error"],
                        # Add other relevant None fields for consistency if schema expects them
                        "molecular_weight": None,
                        "log_p": None,
                        "tpsa": None,
                        "num_rotatable_bonds": None,
                        "num_h_acceptors": None,
                        "num_h_donors": None,
                        "fraction_csp3": None,
                        "molar_refractivity": None,
                        "log_s_esol": None,
                        "gi_absorption": None,
                        "lipinski_rule_of_five_passes": None,
                        "pains_alert_count": None,
                        "brenk_alert_count": None,
                        "num_heavy_atoms": None,
                        "molecular_formula": None,
                    }
                    items_for_db_batch.append(item_to_insert_missing_error)

            # Periodic progress update for batch_jobs table AND batch insert for batch_prediction_items
            # This block will now be triggered by UPDATE_DB_INTERVAL for batch_jobs update,
            # OR when items_for_db_batch is full, OR at the very end of processing all molecules.
            trigger_db_ops = False
            if (processed_count + failed_count) == total_molecules:
                trigger_db_ops = True  # End of all molecules
            elif (processed_count + failed_count) > 0 and (
                (processed_count + failed_count) % UPDATE_DB_INTERVAL == 0
            ):
                trigger_db_ops = True  # DB update interval for batch_jobs
            if len(items_for_db_batch) >= BATCH_INSERT_SIZE and items_for_db_batch:
                trigger_db_ops = True  # Batch for batch_prediction_items is full

            if trigger_db_ops:
                # Always update overall job progress if at interval or end
                if (
                    ((processed_count + failed_count) % UPDATE_DB_INTERVAL == 0)
                    and (processed_count + failed_count) > 0
                ) or ((processed_count + failed_count) == total_molecules):
                    _update_job_progress_in_db(
                        db, job_id, processed_count, failed_count, total_molecules
                    )

                # Execute batch insert if batch is full or it's the end of all processing and items exist
                if (len(items_for_db_batch) >= BATCH_INSERT_SIZE) or (
                    items_for_db_batch
                    and (processed_count + failed_count == total_molecules)
                ):
                    logger.info(
                        f"Job {job_id}: Triggering batch insert for {len(items_for_db_batch)} items. Processed+Failed: {processed_count + failed_count}, Total: {total_molecules}"
                    )
                    batch_insert_success = await _execute_batch_insert_items(
                        db, job_id, items_for_db_batch, logger
                    )
                    if batch_insert_success:
                        items_for_db_batch.clear()
                    else:
                        logger.error(
                            f"Job {job_id}: Batch insert failed. Clearing batch to proceed. Some items may not be in DB."
                        )
                        items_for_db_batch.clear()  # Clear to avoid retrying same failed batch

        # Final flush for any remaining items in the batch (after all loops)
        if items_for_db_batch:
            logger.info(
                f"Job {job_id}: Main processing loops finished. Flushing any remaining {len(items_for_db_batch)} items."
            )
            batch_insert_success = await _execute_batch_insert_items(
                db, job_id, items_for_db_batch, logger
            )
            if batch_insert_success:
                items_for_db_batch.clear()
            else:
                logger.error(
                    f"Job {job_id}: Final batch insert attempt (after main loop) failed. Some items may not be in DB."
                )
                # items_for_db_batch is cleared by _execute_batch_insert_items on failure or success already if it was attempted.

        # Ensure final progress update reflects the true end state.
        _update_job_progress_in_db(
            db, job_id, processed_count, failed_count, total_molecules
        )

        # Step 4: Store final results CSV and update job status to COMPLETED
        results_df = pd.DataFrame(final_results_for_csv)
        csv_buffer = io.StringIO()
        results_df.to_csv(csv_buffer, index=False)
        csv_content = csv_buffer.getvalue()
        csv_buffer.close()

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
                # Remove colon from timezone offset if present (e.g., +00:00 -> +0000)
                # Check if the string is long enough and has a colon at the third to last position
                if (
                    len(estimated_completion_time_str) > 5
                    and estimated_completion_time_str[-3] == ":"
                ):
                    estimated_completion_time_str = (
                        estimated_completion_time_str[:-3]
                        + estimated_completion_time_str[-2:]
                    )
                try:
                    # Parse the datetime string using strptime
                    parsed_estimated_completion_time = datetime.strptime(
                        estimated_completion_time_str, iso_format_with_offset
                    )
                except ValueError as e_parse:
                    logger.error(
                        f"Error parsing datetime string '{estimated_completion_time_str}' for field 'estimated_completion_time' in job {job_data['job_id']}: {e_parse}. Allowing Pydantic to attempt parsing."
                    )
                    # If strptime fails, we let Pydantic try. If Pydantic also fails, it will raise its own validation error.
                    pass  # Let Pydantic handle it if our specific parsing fails

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
    raw_job_name = (
        request.job_name or f"Batch Job {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
    )
    # Sanitize job_name
    try:
        # Normalize, encode to ASCII ignoring errors, decode back, replace spaces, limit length
        normalized_job_name = (
            unicodedata.normalize("NFKD", raw_job_name)
            .encode("ascii", "ignore")
            .decode("ascii")
        )
        job_name = re.sub(r"[^a-zA-Z0-9_\-. ]", "", normalized_job_name).strip()
        job_name = re.sub(r"\s+", "_", job_name)  # Replace spaces with underscores
        job_name = job_name[:200]  # Limit length
        if not job_name:  # Handle case where sanitization results in empty string
            job_name = f"Batch_Job_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    except Exception as e_sanitize_job_name:
        logger.warning(
            f"Could not sanitize job_name '{raw_job_name}', using default. Error: {e_sanitize_job_name}"
        )
        job_name = f"Batch_Job_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"

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

            # If the SMILES field itself contains a pattern like SMILES_string,"description"...
            # we want to extract just the SMILES_string part.
            # The pattern is: a comma, followed by a double quote. Space after comma is optional.

            # Try splitting by ',"' (comma directly followed by quote)
            if ',"' in raw_smiles_field:
                parts = raw_smiles_field.split(',"', 1)
                actual_smiles = parts[0].strip()
            # Else, try splitting by ', "' (comma, space, quote) - less likely but good to cover
            elif ', "' in raw_smiles_field:
                parts = raw_smiles_field.split(', "', 1)
                actual_smiles = parts[0].strip()
            else:
                actual_smiles = raw_smiles_field.strip()

            # Clean the extracted SMILES string
            # Remove any leading/trailing whitespace and then any surrounding quotes.
            item_data["smiles"] = actual_smiles.strip().strip('"')

            # Handle molecule_name, ensuring it's a string or None
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

        insert_response = db.table("batch_jobs").insert(job_data).execute()

        # Check for success: data attribute exists and is populated
        if hasattr(insert_response, "data") and insert_response.data:
            logger.info(
                f"Job {job_id}: Successfully inserted job record into batch_jobs: {insert_response.data}"
            )

            # Attempt to read back the record to confirm visibility
            try:
                read_back_response = (
                    db.table("batch_jobs")
                    .select("job_id")
                    .eq("job_id", job_id)
                    .limit(1)
                    .execute()
                )
                if hasattr(read_back_response, "data") and read_back_response.data:
                    logger.info(
                        f"Job {job_id}: Successfully read back job record from batch_jobs."
                    )
                else:
                    # This case is critical if it happens
                    error_detail = "Read-back after insert failed or returned no data."
                    if (
                        hasattr(read_back_response, "error")
                        and read_back_response.error
                    ):
                        error_detail += f" DB Error: {read_back_response.error.message if hasattr(read_back_response.error, 'message') else str(read_back_response.error)}"
                    logger.error(
                        f"Job {job_id}: {error_detail} Raw read_back_response: {read_back_response}"
                    )
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to confirm job record persistence after insert.",
                    )
            except Exception as e_read_back:
                logger.error(
                    f"Job {job_id}: Exception during read-back check: {e_read_back}",
                    exc_info=True,
                )
                raise HTTPException(
                    status_code=500,
                    detail=f"Error confirming job record persistence: {e_read_back}",
                )
        else:
            # It's an error if we don't have data or data is empty
            error_msg_for_user = "Insert operation failed."  # Default for HTTPException
            log_msg_parts = [
                f"Job {job_id}: Failed to insert job record into batch_jobs."
            ]

            # Try to get specific error from PostgrestAPIResponse structure
            if hasattr(insert_response, "error") and insert_response.error:
                pg_error = insert_response.error
                err_code = getattr(pg_error, "code", "N/A")
                # Use getattr for message as well, falling back to str(pg_error)
                err_msg = getattr(pg_error, "message", str(pg_error))
                log_msg_parts.append(
                    f"PostgREST Error Code: {err_code}, Message: {err_msg}."
                )
                error_msg_for_user = (
                    f"Database Error: {err_msg}"
                    if err_msg != str(pg_error)
                    else "Database error occurred."
                )
            # Check for a general message attribute (e.g., from ClientResponse)
            elif hasattr(insert_response, "message") and insert_response.message:
                err_msg = str(insert_response.message)
                log_msg_parts.append(f"Response Message: {err_msg}.")
                error_msg_for_user = f"Operation Error: {err_msg}"
            # Check if data attribute exists but is empty (and no .error was found)
            elif hasattr(insert_response, "data") and not insert_response.data:
                log_msg_parts.append(
                    "Insert operation returned no data and no explicit error attribute."
                )
                error_msg_for_user = "Database insert failed (no data returned)."
            # Fallback for other response types or if it's an unhandled structure
            else:
                log_msg_parts.append(
                    f"Unknown response structure. Raw response: {str(insert_response)}."
                )
                error_msg_for_user = (
                    "Insert failed with an unexpected response from the database."
                )

            log_msg_parts.append(f"Response type: {type(insert_response)}.")
            logger.error(" ".join(log_msg_parts))
            raise HTTPException(status_code=500, detail=error_msg_for_user)

        # Pass the full list of SMILES data to a single background task
        logger.info(
            f"Job {job_id}: About to add task. Length of smiles_data being passed: {len(smiles_data_list)}"
        )
        # Sanitize original_filename for the background task
        raw_original_filename = file.filename if file.filename else "unknown_file.csv"
        try:
            sanitized_original_filename = (
                unicodedata.normalize("NFKD", raw_original_filename)
                .encode("ascii", "ignore")
                .decode("ascii")
            )
            sanitized_original_filename = re.sub(
                r"[^a-zA-Z0-9_\-. ]", "", sanitized_original_filename
            ).strip()
            sanitized_original_filename = re.sub(
                r"\s+", "_", sanitized_original_filename
            )
            sanitized_original_filename = sanitized_original_filename[:255]
            if not sanitized_original_filename:
                sanitized_original_filename = (
                    f"file_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
                )
        except Exception as e_sanitize_filename:
            logger.warning(
                f"Job {job_id}: Could not sanitize original_filename '{raw_original_filename}', using default. Error: {e_sanitize_filename}"
            )
            sanitized_original_filename = (
                f"file_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            )

        # Schedule background task
        background_tasks.add_task(
            process_batch_job,
            job_id,
            job_name,  # This is the sanitized job_name
            sanitized_original_filename,  # Pass SANITIZED original filename
            smiles_data_list,
            predictor,
            db,
        )

        # Use the created_at from job_data for consistency in response
        created_at_str = str(job_data["created_at"])

        # 1. Normalize timezone colon: +HH:MM -> +HHMM
        if len(created_at_str) > 6 and created_at_str[-3] == ":":
            created_at_str = created_at_str[:-3] + created_at_str[-2:]

        # 2. Normalize 'Z' to '+0000'
        if created_at_str.endswith("Z"):
            created_at_str = created_at_str[:-1] + "+0000"

        # 3. If no timezone offset is present, assume UTC and append '+0000'
        # A timezone offset looks like [+-]HHMM (5 characters)
        tz_pattern = re.compile(r"[+-]\d{4}$")
        if not tz_pattern.search(created_at_str):
            created_at_str += "+0000"

        # 4. Separate the guaranteed timezone suffix (last 5 chars)
        tz_suffix = created_at_str[-5:]
        datetime_part_before_tz = created_at_str[:-5]

        # 5. Handle fractional seconds and determine final format string
        final_format_string = ""
        if "." in datetime_part_before_tz:
            main_dt_part, fractional_digits = datetime_part_before_tz.split(".", 1)
            # Ensure fractional seconds are 6 digits
            fractional_digits = fractional_digits[:6].ljust(6, "0")
            # Reconstruct the string with normalized fractional seconds and timezone
            processed_created_at_str = f"{main_dt_part}.{fractional_digits}{tz_suffix}"
            final_format_string = "%Y-%m-%dT%H:%M:%S.%f%z"
        else:
            # No fractional seconds
            processed_created_at_str = f"{datetime_part_before_tz}{tz_suffix}"
            final_format_string = "%Y-%m-%dT%H:%M:%S%z"

        created_at_for_response = datetime.strptime(
            processed_created_at_str, final_format_string
        )
        logger.info(
            f"Created batch job {job_id} with {total_molecules} molecules, record successfully inserted."
        )

        return BatchJobResponse(
            job_id=job_id,
            job_name=job_name,  # Also include job_name in response
            status=JobStatus.PENDING,
            created_at=created_at_for_response,
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
        logger.info(f"Job {job_id}: get_batch_status called.")
        query_start_time = datetime.utcnow()
        response = (
            db.table("batch_jobs")
            .select("*")
            .eq("job_id", job_id)
            .maybe_single()
            .execute()
        )
        query_end_time = datetime.utcnow()
        query_duration = (query_end_time - query_start_time).total_seconds()
        logger.info(
            f"Job {job_id}: Database query for status took {query_duration:.4f} seconds."
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
