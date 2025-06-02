# backend/app/ml/molecule_utils.py
from rdkit import Chem  # type: ignore
from rdkit.Chem import AllChem  # type: ignore
from typing import cast


def smiles_to_pdb_string(smiles: str) -> str | None:
    """
    Converts a SMILES string to a PDB block string.

    Args:
        smiles: The SMILES string of the molecule.

    Returns:
        A string containing the molecule in PDB format, or None if conversion fails.
    """
    try:
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            # RDKit couldn't parse the SMILES string
            return None

        # Add hydrogens (important for 3D structure)
        mol_with_hs = Chem.AddHs(mol)

        # Generate 3D coordinates
        # ETKDG is a good default method for conformer generation
        embed_result = AllChem.EmbedMolecule(mol_with_hs, AllChem.ETKDG())
        if embed_result == -1:
            # Embedding failed (e.g., for very complex or problematic molecules)
            # Try a different method or parameters if needed, or return None
            # For simplicity, we'll try UFF optimization if ETKDG fails before giving up
            embed_result_uff = AllChem.EmbedMolecule(mol_with_hs, useRandomCoords=True)
            if embed_result_uff == -1:
                return None  # Still failed
            AllChem.UFFOptimizeMolecule(mol_with_hs)

        elif embed_result == 0:
            # Optimization might be beneficial after embedding
            AllChem.UFFOptimizeMolecule(mol_with_hs)

        # Generate PDB block
        pdb_block = Chem.MolToPDBBlock(mol_with_hs)
        return cast(str, pdb_block)
    except Exception as e:
        print(f"Error converting SMILES to PDB: {smiles}, Error: {str(e)}")
        return None
