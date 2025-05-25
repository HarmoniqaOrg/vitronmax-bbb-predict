"""
Pydantic models for request/response schemas.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, validator
import re


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

    @validator("smiles")
    def validate_smiles(cls, v):
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
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    fingerprint_features: Optional[List[int]] = None
    processing_time_ms: float


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


class BatchStatusResponse(BaseModel):
    """Batch job status response."""

    job_id: str
    status: JobStatus
    created_at: datetime
    updated_at: datetime
    total_molecules: int
    processed_molecules: int
    failed_molecules: int
    progress_percentage: float
    estimated_completion_time: Optional[datetime]
    error_message: Optional[str]


class ExplainRequest(BaseModel):
    """AI explanation request."""

    smiles: str
    prediction_result: Optional[Dict[str, Any]] = None
    context: Optional[str] = Field(
        None, description="Additional context for explanation"
    )

    @validator("smiles")
    def validate_smiles(cls, v):
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
