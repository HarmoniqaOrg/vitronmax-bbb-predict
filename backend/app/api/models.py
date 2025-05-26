from typing import List, Optional
from pydantic import BaseModel, Field


class SmilesInput(BaseModel):
    smiles: str = Field(
        ...,
        example="CC(=O)Oc1ccccc1C(=O)O",
        description="SMILES string of the molecule",
    )


class PdbOutput(BaseModel):
    pdb_string: str = Field(..., description="Molecule structure in PDB format")
    smiles_input: str = Field(..., description="Original SMILES string provided")


# --- Models for existing prediction endpoints (assuming structure) ---
class PredictionRequest(BaseModel):
    smiles: str = Field(
        ...,
        example="CC(=O)Oc1ccccc1C(=O)O",
        description="SMILES string of the molecule",
    )
    molecule_name: Optional[str] = Field(
        None, example="Aspirin", description="Optional name for the molecule"
    )


class PredictionResponse(BaseModel):
    smiles: str
    molecule_name: Optional[str] = None
    bbb_probability: float
    prediction_class: str
    confidence_score: float
    # processing_time_ms: float # Assuming this might be added by the endpoint logic, not part of core response model
    fingerprint: Optional[List[int]] = None  # Or appropriate type for fingerprint


class BatchPredictionItem(BaseModel):
    smiles: str
    molecule_name: Optional[str] = None


class BatchPredictionRequest(BaseModel):
    molecules: List[BatchPredictionItem]
    # common_settings: Optional[dict] = None # Example if you have common settings


class BatchPredictionResponse(BaseModel):
    job_id: str
    message: str = "Batch prediction job started"
    # estimated_completion_time: Optional[str] = None


class BatchJobPredictionResult(BaseModel):
    smiles: str
    molecule_name: Optional[str] = None
    bbb_probability: float
    prediction_class: str
    confidence_score: float
    error: Optional[str] = None  # If an error occurred for this specific molecule


class BatchJobStatus(BaseModel):
    job_id: str
    status: str  # e.g., "PENDING", "PROCESSING", "COMPLETED", "FAILED"
    created_at: str  # ISO format string
    updated_at: str  # ISO format string
    total_molecules: int
    processed_molecules: int
    results: Optional[List[BatchJobPredictionResult]] = None
    error_message: Optional[str] = None  # If the whole job failed
