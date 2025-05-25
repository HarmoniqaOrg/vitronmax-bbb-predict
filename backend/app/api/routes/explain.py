"""
AI-powered explanation endpoints using OpenAI.
"""

import logging
import json
from typing import AsyncGenerator
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

from app.models.schemas import ExplainRequest
from app.core.config import settings
from app.ml.predictor import BBBPredictor

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize OpenAI client
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def get_predictor() -> BBBPredictor:
    """Dependency to get ML predictor instance."""
    from app.main import app

    return app.state.predictor


async def generate_explanation_stream(
    smiles: str, prediction_result: dict, context: str = None
) -> AsyncGenerator[str, None]:
    """Generate streaming AI explanation for BBB prediction."""

    # Prepare system prompt
    system_prompt = """You are a computational chemist and AI expert specializing in blood-brain barrier (BBB) permeability prediction. 

Your role is to explain BBB permeability predictions in a clear, scientific manner that is accessible to both researchers and clinicians.

Focus on:
1. Molecular structure features that influence BBB permeability
2. How the prediction model works
3. Key factors in the decision (molecular weight, lipophilicity, polar surface area, etc.)
4. Confidence and limitations of the prediction
5. Practical implications for drug development

Be concise but informative. Use technical terms appropriately but explain them when necessary."""

    # Prepare user message
    user_message = f"""
    Please explain the BBB permeability prediction for this molecule:
    
    SMILES: {smiles}
    Prediction: {prediction_result.get('prediction_class', 'unknown')}
    Probability: {prediction_result.get('bbb_probability', 0.0):.3f}
    Confidence: {prediction_result.get('confidence_score', 0.0):.3f}
    
    Additional context: {context or 'None provided'}
    
    Explain why this molecule received this prediction and what structural features are most relevant.
    """

    try:
        # Create OpenAI streaming completion
        stream = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            stream=True,
            temperature=0.3,
            max_tokens=1000,
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                yield f"data: {json.dumps({'content': content})}\n\n"

        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        error_msg = "Sorry, I encountered an error while generating the explanation. Please try again."
        yield f"data: {json.dumps({'error': error_msg})}\n\n"


@router.post("/explain")
async def explain_prediction(
    request: ExplainRequest, predictor: BBBPredictor = Depends(get_predictor)
) -> StreamingResponse:
    """
    Generate AI-powered explanation for BBB permeability prediction.

    Returns a streaming response with the explanation content.
    """

    try:
        # Check if OpenAI API key is configured
        if not settings.OPENAI_API_KEY:
            raise HTTPException(
                status_code=500, 
                detail="OpenAI API key not configured. Please set OPENAI_API_KEY environment variable."
            )
        
        # If no prediction result provided, generate one
        if not request.prediction_result:
            probability, pred_class, confidence, fingerprint = predictor.predict_single(
                request.smiles
            )

            prediction_result = {
                "bbb_probability": probability,
                "prediction_class": pred_class,
                "confidence_score": confidence,
            }
        else:
            prediction_result = request.prediction_result

        logger.info(f"Generating explanation for SMILES: {request.smiles}")

        # Generate streaming explanation
        return StreamingResponse(
            generate_explanation_stream(
                request.smiles, prediction_result, request.context
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        )

    except ValueError as e:
        logger.warning(f"Invalid input for explanation: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"Explanation generation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to generate explanation")


@router.get("/explain/sample")
async def get_sample_explanation() -> dict:
    """Get a sample explanation for demonstration purposes."""

    sample_explanation = {
        "smiles": "CC(C)Cc1ccc(C(C)C(=O)O)cc1",
        "explanation": """
        This molecule (ibuprofen) shows moderate BBB permeability potential based on several key features:

        **Molecular Properties:**
        - Molecular weight: ~206 Da (favorable for BBB crossing)
        - LogP: ~3.9 (good lipophilicity for membrane penetration)
        - Polar surface area: ~37 Ų (within favorable range)

        **Structural Features:**
        - Aromatic ring provides rigidity and lipophilicity
        - Carboxylic acid group may limit permeability due to ionization at physiological pH
        - Branched aliphatic chains contribute to lipophilicity

        **Prediction Confidence:**
        The model shows moderate confidence due to competing factors - favorable lipophilicity 
        versus potential ionization of the carboxylic acid group.

        **Clinical Relevance:**
        Ibuprofen does cross the BBB to some extent, which aligns with this prediction, 
        though its primary therapeutic targets are in peripheral tissues.
        """,
        "confidence": 0.72,
        "prediction": "permeable",
    }

    return sample_explanation
