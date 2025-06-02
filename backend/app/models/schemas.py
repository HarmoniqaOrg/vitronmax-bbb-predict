"""
Pydantic models for request/response schemas.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import re

from pydantic import BaseModel, Field, field_validator


class JobStatus(str, Enum):
    """Batch job status enumeration."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class PredictionRequest(BaseModel):
    """Single molecule prediction request."""

    smiles: str = Field(..., description="SMILES string of the molecule")
    molecule_name: Optional[str] = Field(None, description="Optional molecule name")

    @field_validator("smiles", mode="before")
    @classmethod
    def validate_smiles(cls, v: str) -> str:
        """Basic SMILES validation."""
        if not v or len(v.strip()) == 0:
            raise ValueError("SMILES string cannot be empty")

        # Basic SMILES pattern check
        if not re.match(r"^[A-Za-z0-9@+\-\[\]()=#\.\\\/\s]+$", v):
            raise ValueError("Invalid characters in SMILES string")

        return v.strip()


class PredictionResponse(BaseModel):
    """Single molecule prediction response."""

    smiles: str
    molecule_name: Optional[str]
    bbb_probability: float = Field(..., ge=0.0, le=1.0)
    prediction_class: str  # "permeable" or "non_permeable"
    prediction_certainty: float = Field(..., ge=0.0, le=1.0)
    applicability_score: Optional[float] = Field(
        None,
        description="Tanimoto similarity to the most similar molecule in the training set",
        ge=0.0,
        le=1.0,
    )
    fingerprint_features: Optional[List[int]] = None
    processing_time_ms: float

    # Detailed molecular properties
    mw: Optional[float] = Field(None, description="Molecular Weight")
    logp: Optional[float] = Field(
        None, description="LogP (octanol-water partition coefficient)"
    )
    tpsa: Optional[float] = Field(None, description="Topological Polar Surface Area")
    rot_bonds: Optional[int] = Field(None, description="Number of Rotatable Bonds")
    h_acceptors: Optional[int] = Field(None, description="Number of H-bond Acceptors")
    h_donors: Optional[int] = Field(None, description="Number of H-bond Donors")
    frac_csp3: Optional[float] = Field(
        None, description="Fraction of sp3 hybridized carbons"
    )
    molar_refractivity: Optional[float] = Field(None, description="Molar Refractivity")
    log_s_esol: Optional[float] = Field(
        None, description="ESOL LogS (aqueous solubility)"
    )
    gi_absorption: Optional[str] = Field(None, description="GI Absorption (High/Low)")
    lipinski_passes: Optional[bool] = Field(
        None, description="Passes Lipinski's Rule of Five"
    )
    pains_alerts: Optional[int] = Field(None, description="Number of PAINS alerts")
    brenk_alerts: Optional[int] = Field(None, description="Number of Brenk alerts")
    heavy_atoms: Optional[int] = Field(None, description="Number of Heavy Atoms")
    mol_formula: Optional[str] = Field(None, description="Molecular Formula")
    exact_mw: Optional[float] = Field(None, description="Exact Molecular Weight")
    formal_charge: Optional[int] = Field(None, description="Formal Charge")
    num_rings: Optional[int] = Field(None, description="Number of Rings")


class BatchPredictionRequest(BaseModel):
    """Batch prediction job creation request."""

    job_name: Optional[str] = Field(None, description="Optional job name")
    notify_email: Optional[str] = Field(
        None, description="Email for completion notification"
    )


class BatchJobResponse(BaseModel):
    """Batch job creation response."""

    job_id: str
    status: JobStatus
    created_at: datetime
    estimated_completion_time: Optional[datetime]
    total_molecules: int
    job_name: Optional[str] = None  # User-provided name for the job
    detail: Optional[str] = None  # Added for messages


class BatchStatusResponse(BaseModel):
    """Batch job status response."""

    job_id: str
    job_name: Optional[str] = None  # Added
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    total_molecules: int
    processed_molecules: int
    failed_molecules: int
    progress_percentage: float
    estimated_completion_time: Optional[datetime]
    results_file_path: Optional[str] = None  # Added
    error_message: Optional[str]


class ExplainRequest(BaseModel):
    """AI explanation request."""

    smiles: str
    prediction_result: Optional[Dict[str, Any]] = None
    context: Optional[str] = Field(
        None, description="Additional context for explanation"
    )

    @field_validator("smiles", mode="before")
    @classmethod
    def validate_smiles(cls, v: str) -> str:
        """Basic SMILES validation."""
        if not v or len(v.strip()) == 0:
            raise ValueError("SMILES string cannot be empty")
        return v.strip()


class MoleculeData(BaseModel):
    """Molecule data for database storage."""

    smiles: str
    molecule_name: Optional[str]
    bbb_probability: float
    prediction_class: str
    confidence_score: float
    fingerprint_hash: str
    created_at: datetime


class ErrorResponse(BaseModel):
    """Standard error response."""

    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
