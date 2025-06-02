"""
Single molecule prediction endpoints.
"""

import logging
import time
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from app.api.models import SinglePredictionRequest, SinglePredictionResponse
from app.ml.predictor import BBBPredictor
from app.core.database import get_db
from app.core.config import settings  # For default model_version

logger = logging.getLogger(__name__)
router = APIRouter()


def get_predictor() -> BBBPredictor:
    """Dependency to get ML predictor instance."""
    from app.main import app

    # Ensure predictor is of the correct type for Mypy
    assert isinstance(app.state.predictor, BBBPredictor)
    return app.state.predictor


@router.post("/predict", response_model=SinglePredictionResponse)
async def predict_molecule_data(
    request: SinglePredictionRequest,
    predictor: BBBPredictor = Depends(get_predictor),
    db: Any = Depends(get_db),
) -> SinglePredictionResponse:
    """
    Predict BBB permeability and calculate molecular properties for a single molecule.

    - **smiles**: SMILES string of the molecule
    - **molecule_name**: Optional name for the molecule

    Returns a comprehensive data profile including BBB prediction, physicochemical properties, and alerts.
    """
    start_time = time.time()

    try:
        logger.info(
            f"Processing single molecule prediction for SMILES: {request.smiles}"
        )

        # Get comprehensive data from the predictor
        prediction_data = await predictor.predict_smiles_data(request.smiles)

        # Add molecule_name from request and processing time
        prediction_data["molecule_name"] = request.molecule_name
        # Ensure input_smiles from predictor output is used, or override if needed (already there)
        # prediction_data["input_smiles"] = request.smiles # Already set by predict_smiles_data

        processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        prediction_data["processing_time_ms"] = processing_time

        # If prediction was successful, try to save to DB
        if prediction_data.get("status") == "success":
            try:
                item_to_insert = {
                    "id": uuid.uuid4(),
                    "smiles": prediction_data.get("smiles"),
                    "molecule_name": request.molecule_name,
                    "bbb_probability": prediction_data.get("bbb_probability"),
                    "prediction_class": prediction_data.get(
                        "prediction_class"
                    ),  # Corrected key
                    "prediction_certainty": prediction_data.get("prediction_certainty"),
                    "applicability_score": prediction_data.get("applicability_score"),
                    "fingerprint_hash": prediction_data.get(
                        "fingerprint_hash"
                    ),  # Assuming this is part of predictor output
                    "model_version": prediction_data.get(
                        "model_version", settings.MODEL_VERSION
                    ),
                    "molecular_weight": prediction_data.get("mw"),
                    "log_p": prediction_data.get("logp"),
                    "tpsa": prediction_data.get("tpsa"),
                    "num_rotatable_bonds": prediction_data.get("rot_bonds"),
                    "num_h_acceptors": prediction_data.get("h_acceptors"),
                    "num_h_donors": prediction_data.get("h_donors"),
                    "fraction_csp3": prediction_data.get("frac_csp3"),
                    "molar_refractivity": prediction_data.get("molar_refractivity"),
                    "log_s_esol": prediction_data.get("log_s_esol"),
                    "gi_absorption": prediction_data.get("gi_absorption"),
                    "lipinski_rule_of_five_passes": prediction_data.get(
                        "lipinski_passes"
                    ),
                    "pains_alert_count": prediction_data.get("pains_alerts"),
                    "brenk_alert_count": prediction_data.get("brenk_alerts"),
                    "num_heavy_atoms": prediction_data.get("num_heavy_atoms"),
                    "molecular_formula": prediction_data.get("molecular_formula"),
                    "created_at": datetime.utcnow().isoformat(),
                }
                db_response = (
                    db.table("single_prediction_item").insert(item_to_insert).execute()
                )
                if hasattr(db_response, "error") and db_response.error:
                    logger.error(
                        f"Failed to save single prediction to DB for SMILES {request.smiles}: {db_response.error}"
                    )
                else:
                    logger.info(
                        f"Successfully saved single prediction to DB for SMILES {request.smiles}"
                    )
            except Exception as db_exc:
                logger.error(
                    f"Exception saving single prediction to DB for SMILES {request.smiles}: {db_exc}",
                    exc_info=True,
                )

        # Ensure 'bbb_class' is populated for the response model from 'prediction_class'
        if "prediction_class" in prediction_data:
            prediction_data["bbb_class"] = prediction_data["prediction_class"]
        logger.debug(
            f"Final prediction_data before SinglePredictionResponse: {prediction_data}"
        )

        # Create response using all fields from prediction_data
        # Pydantic will validate against SinglePredictionResponse model
        response = SinglePredictionResponse(**prediction_data)

        logger.info(
            f"Single molecule processing completed in {processing_time:.2f}ms for SMILES: {request.smiles}, status: {response.status}"
        )

        # Handle cases where prediction itself failed (e.g. invalid SMILES)
        if response.status != "success":
            # For client-side errors like invalid SMILES, a 400 might be more appropriate.
            # For model errors or other internal issues, 500 is fine.
            # The status from predict_smiles_data can guide this.
            if (
                response.status == "error_invalid_smiles"
                or response.status == "error_parsing_smiles"
                or response.status == "error_empty_smiles"
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"Error processing SMILES '{request.smiles}': {response.status}",
                )
            # else, it's an internal server error, which will be caught by the generic exception handler below
            # or we can explicitly raise a 500 here if needed.

        return response

    except (
        ValueError
    ) as e:  # Should be less frequent if predict_smiles_data handles SMILES errors
        logger.warning(f"Invalid input for prediction: {e} - SMILES: {request.smiles}")
        raise HTTPException(status_code=400, detail=str(e))

    except HTTPException:  # Re-raise HTTP exceptions from above
        raise
    except Exception as e:
        logger.error(
            f"Single molecule prediction failed for SMILES {request.smiles}: {e}",
            exc_info=True,
        )
        # Construct a response indicating server-side failure but still using the model structure
        # This helps if the client expects this structure even for errors not caught by predict_smiles_data's status.
        # However, a generic 500 might be simpler if the frontend handles it.
        # For now, let it fall through to the global exception handler or FastAPI's default 500.
        raise HTTPException(
            status_code=500, detail="Prediction failed due to an internal server error."
        )


@router.get("/model/info")
async def get_model_info(
    predictor: BBBPredictor = Depends(get_predictor),
) -> Dict[str, Any]:
    """Get information about the loaded ML model."""
    try:
        if not predictor.is_loaded:
            raise HTTPException(status_code=503, detail="Model not loaded")

        feature_importance = predictor.get_feature_importance(top_n=10)

        return {
            "model_type": "RandomForestClassifier",
            "fingerprint_type": "Morgan",
            "fingerprint_radius": 2,
            "fingerprint_bits": 2048,
            "n_estimators": getattr(predictor.model, "n_estimators", "unknown"),
            "top_features": feature_importance,
            "is_loaded": predictor.is_loaded,
        }

    except Exception as e:
        logger.error(f"Failed to get model info: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve model information"
        )
