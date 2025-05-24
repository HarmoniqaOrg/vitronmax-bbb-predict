
"""
Single molecule prediction endpoints.
"""

import logging
import time
from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import PredictionRequest, PredictionResponse
from app.ml.predictor import BBBPredictor
from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


def get_predictor() -> BBBPredictor:
    """Dependency to get ML predictor instance."""
    from app.main import app
    return app.state.predictor


@router.post("/predict_fp", response_model=PredictionResponse)
async def predict_fingerprint(
    request: PredictionRequest,
    predictor: BBBPredictor = Depends(get_predictor)
) -> PredictionResponse:
    """
    Predict BBB permeability for a single molecule using fingerprint analysis.
    
    - **smiles**: SMILES string of the molecule
    - **molecule_name**: Optional name for the molecule
    
    Returns probability, class prediction, and confidence score.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing prediction for SMILES: {request.smiles}")
        
        # Make prediction
        probability, pred_class, confidence, fingerprint = predictor.predict_single(
            request.smiles
        )
        
        processing_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        
        # Create response
        response = PredictionResponse(
            smiles=request.smiles,
            molecule_name=request.molecule_name,
            bbb_probability=probability,
            prediction_class=pred_class,
            confidence_score=confidence,
            fingerprint_features=fingerprint.tolist()[:10],  # First 10 features for brevity
            processing_time_ms=processing_time
        )
        
        logger.info(f"Prediction completed in {processing_time:.2f}ms")
        return response
        
    except ValueError as e:
        logger.warning(f"Invalid input for prediction: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Prediction failed")


@router.get("/model/info")
async def get_model_info(
    predictor: BBBPredictor = Depends(get_predictor)
) -> dict:
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
            "n_estimators": getattr(predictor.model, 'n_estimators', 'unknown'),
            "top_features": feature_importance,
            "is_loaded": predictor.is_loaded
        }
        
    except Exception as e:
        logger.error(f"Failed to get model info: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve model information")
