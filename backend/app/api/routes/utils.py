# backend/app/api/routes/utils.py
from fastapi import APIRouter, HTTPException, Body
from app.api.models import SmilesInput, PdbOutput
from app.ml.molecule_utils import smiles_to_pdb_string

router = APIRouter()


@router.post(
    "/smiles-to-pdb",
    response_model=PdbOutput,
    summary="Convert SMILES to PDB",
    description="Converts a SMILES string to a 3D structure in PDB format.",
)
async def convert_smiles_to_pdb(payload: SmilesInput = Body(...)) -> PdbOutput:
    """
    Receives a SMILES string and returns the molecule's structure in PDB format.
    - **smiles**: The SMILES string of the molecule.
    """
    pdb_data = smiles_to_pdb_string(payload.smiles)
    if pdb_data is None:
        raise HTTPException(
            status_code=400,
            detail=f"Could not convert SMILES string '{payload.smiles}' to PDB. Ensure it is a valid SMILES representing a molecule that can be embedded in 3D.",
        )
    return PdbOutput(pdb_string=pdb_data, smiles_input=payload.smiles)
