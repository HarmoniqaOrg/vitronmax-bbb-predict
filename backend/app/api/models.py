from typing import List, Optional
from pydantic import BaseModel, Field


class SmilesInput(BaseModel):
    smiles: str = Field(description="SMILES string of the molecule")


class PdbOutput(BaseModel):
    pdb_string: str = Field(description="Molecule structure in PDB format")
    smiles_input: str = Field(description="Original SMILES string provided")


# --- Models for existing prediction endpoints (assuming structure) ---
class SinglePredictionRequest(BaseModel):
    smiles: str = Field(description="SMILES string of the molecule")
    molecule_name: Optional[str] = Field(
        default=None, description="Optional name for the molecule"
    )


class SinglePredictionResponse(BaseModel):
    smiles: str
    molecule_name: Optional[str] = None
    status: str = Field(
        description="Processing status for this molecule (e.g., success, error_invalid_smiles)"
    )

    # BBB Prediction specific
    bbb_probability: Optional[float] = None
    bbb_class: Optional[str] = None
    bbb_confidence: Optional[float] = None

    # Physicochemical properties
    mw: Optional[float] = Field(default=None, description="Molecular Weight (g/mol)")
    logp: Optional[float] = Field(
        default=None, description="Octanol-water partition coefficient (Crippen LogP)"
    )
    tpsa: Optional[float] = Field(
        default=None, description="Topological Polar Surface Area (Å²)"
    )
    rot_bonds: Optional[int] = Field(
        default=None, description="Number of Rotatable Bonds"
    )
    h_acceptors: Optional[int] = Field(
        default=None, description="Number of H-bond Acceptors"
    )
    h_donors: Optional[int] = Field(default=None, description="Number of H-bond Donors")
    frac_csp3: Optional[float] = Field(
        default=None, description="Fraction of sp3 hybridized carbons"
    )
    molar_refractivity: Optional[float] = Field(
        default=None, description="Molar Refractivity (Crippen MR)"
    )
    log_s_esol: Optional[float] = Field(
        default=None, description="Estimated aqueous solubility (ESOL model LogS)"
    )

    # Drug-likeness & ADME
    gi_absorption: Optional[str] = Field(
        default=None, description="Predicted Gastrointestinal Absorption (High/Low)"
    )
    lipinski_passes: Optional[bool] = Field(
        default=None, description="Passes Lipinski's Rule of Five"
    )

    # Structural Alerts
    pains_alerts: Optional[int] = Field(
        default=None, description="Number of PAINS alerts"
    )
    brenk_alerts: Optional[int] = Field(
        default=None, description="Number of Brenk alerts"
    )

    # Audit and timing
    processing_time_ms: Optional[float] = None
    model_version: Optional[str] = None


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
