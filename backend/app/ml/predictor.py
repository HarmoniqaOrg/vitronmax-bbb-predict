"""
BBB permeability prediction using Random Forest and Morgan fingerprints.
"""

import hashlib
import logging
import joblib
import numpy as np
import pandas as pd  # Added pandas
from numpy.typing import NDArray
from typing import List, Tuple, Optional, Dict, Any
from fastapi.concurrency import run_in_threadpool

from pathlib import Path

from rdkit import Chem, rdBase, DataStructs  # Added DataStructs
from rdkit.Chem import AllChem, rdMolDescriptors  # Added AllChem
from rdkit.Chem import Descriptors, Crippen, FilterCatalog, Lipinski
from sklearn.ensemble import RandomForestClassifier

from app.core.config import settings

# Ensure RDKit logging is handled appropriately if verbose output is not desired
rdBase.DisableLog("rdApp.error")

logger = logging.getLogger(__name__)


class BBBPredictor:
    """Blood-Brain Barrier Permeability Predictor."""

    def __init__(self) -> None:
        self.model: Optional[RandomForestClassifier] = None
        self.is_loaded: bool = False
        self.pains_catalog: Optional[FilterCatalog.FilterCatalog] = None
        self.brenk_catalog: Optional[FilterCatalog.FilterCatalog] = None
        self._training_fps: List[Any] = []  # For Tanimoto applicability score

        try:
            # Initialize PAINS alerts catalog (RDKit built-in A, B, C)
            pains_filter_params = FilterCatalog.FilterCatalogParams()
            for cat_enum_val in (
                FilterCatalog.FilterCatalogParams.FilterCatalogs.PAINS_A,
                FilterCatalog.FilterCatalogParams.FilterCatalogs.PAINS_B,
                FilterCatalog.FilterCatalogParams.FilterCatalogs.PAINS_C,
            ):
                pains_filter_params.AddCatalog(cat_enum_val)
            self.pains_catalog = FilterCatalog.FilterCatalog(pains_filter_params)
            logger.info(
                "PAINS alert catalog (RDKit built-in A, B, C) loaded successfully."
            )

            # Initialize Brenk alerts catalog (RDKit built-in)
            brenk_filter_params = FilterCatalog.FilterCatalogParams()
            brenk_filter_params.AddCatalog(
                FilterCatalog.FilterCatalogParams.FilterCatalogs.BRENK
            )
            self.brenk_catalog = FilterCatalog.FilterCatalog(brenk_filter_params)
            logger.info("Brenk alert catalog (RDKit built-in) loaded successfully.")

        except Exception as e:
            logger.error(f"Failed to initialize RDKit filter catalogs: {e}")
            # Set catalogs to None to indicate failure but allow app to potentially continue
            self.pains_catalog = None
            self.brenk_catalog = None

        # Load training fingerprints for applicability score
        try:
            self._load_training_fingerprints()
        except Exception as e:
            logger.error(f"Failed to load training fingerprints: {e}", exc_info=True)
            # self._training_fps will remain empty, applicability score will be None

        # Load the pre-trained model
        try:
            self._load_model()
        except Exception as e:
            logger.error(f"Model loading failed during __init__: {e}")
            # self.is_loaded will remain False

    def _load_model(self) -> None:
        """Load the trained Random Forest model."""
        model_path = Path(settings.MODEL_PATH)
        if not model_path.exists():
            logger.warning(
                f"Model file not found at {model_path}, creating dummy model."
            )
            self._create_dummy_model()
        else:
            try:
                self.model = joblib.load(model_path)
                logger.info(f"Successfully loaded model from {model_path}")
                self.is_loaded = True
            except Exception as e:
                logger.error(
                    f"Error loading model from {model_path}: {e}", exc_info=True
                )
                logger.warning("Creating dummy model as fallback due to loading error.")
                self._create_dummy_model()  # Fallback to dummy if loading fails
        logger.info(f"Model loading process finished. Model loaded: {self.is_loaded}")

    def _create_dummy_model(self) -> None:
        """Create a dummy model for demonstration."""
        # This would be replaced with actual trained model
        from sklearn.ensemble import RandomForestClassifier

        # Generate dummy training data
        np.random.seed(42)
        X_dummy: NDArray[np.float64] = np.random.random((1000, settings.FP_NBITS))
        y_dummy: NDArray[np.int_] = np.random.choice([0, 1], size=1000, p=[0.3, 0.7])

        self.model = RandomForestClassifier(
            n_estimators=100, random_state=42, n_jobs=-1
        )
        self.model.fit(X_dummy, y_dummy)
        self.is_loaded = True

    def _load_training_fingerprints(self) -> None:
        """Load Morgan fingerprints from the training dataset for applicability scoring."""
        # Path to the training data CSV file
        # Assumes predictor.py is in backend/app/ml/, and sample_data is at project root
        training_data_path = (
            Path(__file__)
            .resolve()
            .parent.parent.parent.parent  # Adjusted to point to project root
            / "sample_data"
            / "training_dataset.csv"
        )

        if not training_data_path.exists():
            logger.warning(
                f"Training dataset for applicability score not found at {training_data_path}. "
                f"Applicability score will not be calculated."
            )
            return

        try:
            df_train = pd.read_csv(training_data_path)
            if "smiles" not in df_train.columns:
                logger.warning(
                    f"'smiles' column not found in {training_data_path}. "
                    f"Applicability score will not be calculated."
                )
                return

            count = 0
            for smiles_str in df_train["smiles"]:
                mol = Chem.MolFromSmiles(smiles_str)
                if mol:
                    fp = AllChem.GetMorganFingerprintAsBitVect(
                        mol, radius=2, nBits=settings.FP_NBITS
                    )
                    self._training_fps.append(fp)
                    count += 1
            logger.info(
                f"Successfully loaded {count} fingerprints from {training_data_path} for applicability scoring."
            )
        except Exception as e:
            logger.error(
                f"Error loading training fingerprints from {training_data_path}: {e}",
                exc_info=True,
            )
            self._training_fps = []  # Ensure it's empty on error

    def _calculate_molecular_properties(
        self, mol: Optional[Chem.Mol]
    ) -> Dict[str, Any]:
        """Calculate physicochemical properties and structural alerts for a molecule."""
        props: Dict[str, Any] = {
            "mw": None,
            "logp": None,
            "tpsa": None,
            "rot_bonds": None,
            "h_acceptors": None,
            "h_donors": None,
            "frac_csp3": None,
            "molar_refractivity": None,
            "log_s_esol": None,
            "gi_absorption": "N/A",
            "lipinski_passes": None,
            "pains_alerts": 0,
            "brenk_alerts": 0,
            "heavy_atoms": None,
            "mol_formula": None,
            "exact_mw": None,  # New
            "formal_charge": None,  # New
            "num_rings": None,  # New
        }

        if mol is None:
            return props

        try:
            props["mw"] = Descriptors.MolWt(mol)
            props["logp"] = Crippen.MolLogP(mol)
            props["tpsa"] = Descriptors.TPSA(mol)
            props["h_acceptors"] = Lipinski.NumHAcceptors(mol)
            props["h_donors"] = Lipinski.NumHDonors(mol)
            props["rot_bonds"] = Lipinski.NumRotatableBonds(mol)
            props["mol_formula"] = rdMolDescriptors.CalcMolFormula(mol)
            props["heavy_atoms"] = mol.GetNumHeavyAtoms()
            props["frac_csp3"] = Descriptors.FractionCSP3(mol)
            props["molar_refractivity"] = Crippen.MolMR(mol)
            props["exact_mw"] = Descriptors.ExactMolWt(mol)
            props["formal_charge"] = Chem.rdmolops.GetFormalCharge(mol)
            props["num_rings"] = Lipinski.RingCount(mol)

            # ESOL LogS
            # Formula: 0.16 - 0.63*logp - 0.0062*mw + 0.066*rot - 0.74*fr_csp3
            if all(
                props[k] is not None for k in ["logp", "mw", "rot_bonds", "frac_csp3"]
            ):
                props["log_s_esol"] = (
                    0.16
                    - (0.63 * props["logp"])
                    - (0.0062 * props["mw"])
                    + (0.066 * props["rot_bonds"])
                    - (0.74 * props["frac_csp3"])
                )

            # GI Absorption
            if props["tpsa"] is not None and props["rot_bonds"] is not None:
                props["gi_absorption"] = (
                    "High"
                    if props["tpsa"] <= 130 and props["rot_bonds"] <= 10
                    else "Low"
                )

            # Lipinski's Rule of Five
            if all(
                props[k] is not None for k in ["h_donors", "h_acceptors", "mw", "logp"]
            ):
                props["lipinski_passes"] = (
                    props["h_donors"] <= 5
                    and props["h_acceptors"] <= 10
                    and props["mw"] < 500
                    and props["logp"] < 5
                )

            # PAINS and Brenk alerts
            if self.pains_catalog:
                pains_matches = self.pains_catalog.GetMatches(mol)
                props["pains_alerts"] = len(pains_matches)
            else:
                props["pains_alerts"] = 0  # Default if catalog not loaded

            if self.brenk_catalog:
                brenk_matches = self.brenk_catalog.GetMatches(mol)
                props["brenk_alerts"] = len(brenk_matches)
                # Optionally, log more details about Brenk matches if needed for debugging
                # if brenk_matches:
                #     for match in brenk_matches:
                #         logger.debug(f"Brenk alert: {match.GetDescription()}")
            else:
                # This path should ideally not be taken if constructor guarantees loading
                props["brenk_alerts"] = 0

            # Molecular Formula
            props["mol_formula"] = Descriptors.rdMolDescriptors.CalcMolFormula(mol)
        except Exception as e:
            logger.error(
                f"Error calculating properties for a molecule: {e}", exc_info=True
            )
            # Keep default None/0/"N/A" values for properties if calculation fails for any reason
            pass  # Individual property calculation errors will result in None for that property

        return props

    def _run_prediction_pipeline_sync(self, smiles: str) -> Dict[str, Any]:
        # Initialize default molecular properties. These will be updated if 'mol' is valid.
        current_molecular_properties: Dict[str, Any] = (
            self._calculate_molecular_properties(None)
        )

        # Base structure for the result. Fields will be updated based on pipeline execution.
        final_result_data: Dict[str, Any] = {
            "smiles": smiles,
            "molecule_name": None,  # Can be updated later if available
            **current_molecular_properties,
            "status": "error_processing",  # Default, will be updated
            "error": None,
            "bbb_probability": 0.0,
            "prediction_class": "non_permeable",  # Default, updated on success or specific errors
            "prediction_certainty": 0.0,
            "applicability_score": None,
            "fingerprint_hash": None,
            "fingerprint_features": None,
        }

        mol: Optional[Chem.Mol] = None

        try:
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                final_result_data["status"] = "error_invalid_smiles"
                final_result_data["error"] = "Invalid SMILES string."
                logger.debug(
                    f"Invalid SMILES (sync): {smiles}. RDKit Mol object is None."
                )
                # prediction_class remains "non_permeable" (default)
                # Other prediction fields remain at their defaults.
                # Molecular properties are already set to defaults for None mol.
                if final_result_data.get("error") is None:  # Cleanup error key
                    if "error" in final_result_data:
                        del final_result_data["error"]
                return final_result_data

            # Mol is valid, update properties and attempt fingerprint hash
            current_molecular_properties = self._calculate_molecular_properties(mol)
            final_result_data.update(current_molecular_properties)

            try:
                canonical_smiles = Chem.MolToSmiles(mol, canonical=True)
                final_result_data["fingerprint_hash"] = hashlib.sha256(
                    canonical_smiles.encode("utf-8")
                ).hexdigest()
            except Exception as e_hash:
                logger.warning(
                    f"Could not generate canonical SMILES or hash for {smiles}: {e_hash}"
                )
                # fingerprint_hash remains None (default)

            fp_numpy_array = self._prepare_fingerprint(mol)
            if fp_numpy_array is None:
                final_result_data["status"] = "error_fingerprint_generation"
                final_result_data["error"] = (
                    "Failed to generate fingerprint for the molecule."
                )
                logger.debug(
                    f"Numpy fingerprint generation failed for SMILES (sync): {smiles}"
                )
                # prediction_class remains "non_permeable" (default)
                if final_result_data.get("error") is None:  # Cleanup error key
                    if "error" in final_result_data:
                        del final_result_data["error"]
                return final_result_data

            # Prepare RDKit fingerprint for Tanimoto
            fp_rdkit_obj: Optional[Any] = None
            try:
                # Ensure radius matches what was used for training fingerprints if applicable
                # Using settings.FP_RADIUS which should be 2 as per previous context
                fp_rdkit_obj = AllChem.GetMorganFingerprintAsBitVect(
                    mol, radius=settings.FP_RADIUS, nBits=settings.FP_NBITS
                )
            except Exception as e_fp_rdkit:
                logger.warning(
                    f"Failed to generate RDKit fingerprint for Tanimoto for {smiles}: {e_fp_rdkit}"
                )

            if not self.model or not self.is_loaded:
                final_result_data["status"] = "error_model_not_loaded"
                final_result_data["error"] = "Prediction model is not available."
                logger.error(
                    "Model not loaded, cannot perform BBB prediction in sync pipeline."
                )
                # prediction_class remains "non_permeable" (default)
                if final_result_data.get("error") is None:  # Cleanup error key
                    if "error" in final_result_data:
                        del final_result_data["error"]
                return final_result_data

            # Perform prediction
            probability = self.model.predict_proba(fp_numpy_array.reshape(1, -1))[0, 1]
            final_result_data["bbb_probability"] = float(probability)
            final_result_data["prediction_class"] = (
                "permeable" if probability >= 0.5 else "non_permeable"
            )
            final_result_data["prediction_certainty"] = abs(probability - 0.5) * 2
            final_result_data["fingerprint_features"] = fp_numpy_array.tolist()

            # Calculate applicability score
            if (
                self._training_fps and fp_rdkit_obj
            ):  # Ensure training FPs and current mol FP are available
                try:
                    similarities = DataStructs.BulkTanimotoSimilarity(
                        fp_rdkit_obj, self._training_fps
                    )
                    # Ensure similarities list is not empty before calling max()
                    if similarities:
                        final_result_data["applicability_score"] = round(
                            max(similarities), 4
                        )
                    else:
                        # Handle case where similarities might be empty (e.g., if _training_fps was empty)
                        final_result_data["applicability_score"] = (
                            0.0  # Or None, depending on desired behavior
                        )
                except Exception as e_tanimoto:
                    logger.warning(
                        f"Tanimoto similarity calculation failed for {smiles}: {e_tanimoto}"
                    )
                    # applicability_score remains its default (None)
            elif not self._training_fps:
                logger.debug(
                    "Training fingerprints not loaded, cannot calculate applicability score."
                )
            elif (
                not fp_rdkit_obj
            ):  # fp_rdkit_obj could be None if its generation failed
                logger.debug(
                    f"RDKit fingerprint not generated for {smiles}, cannot calculate applicability score."
                )

            final_result_data["status"] = "success"
            final_result_data["error"] = (
                None  # Explicitly set error to None for success
            )

        except Exception as e_pipeline:
            logger.error(
                f"Critical error in prediction pipeline for '{smiles}': {e_pipeline}",
                exc_info=True,
            )
            final_result_data["status"] = (
                "error_pipeline_execution"  # More specific status
            )
            final_result_data["error"] = (
                f"Internal error during prediction pipeline: {e_pipeline!s}"
            )
            # Reset prediction-specific fields for general pipeline errors
            final_result_data["bbb_probability"] = 0.0
            final_result_data["prediction_class"] = (
                "unknown"  # Distinct class for pipeline errors
            )
            final_result_data["prediction_certainty"] = 0.0
            final_result_data["applicability_score"] = None
            # fingerprint_hash and molecular_properties might have been partially set or default.
            # Molecular properties are based on 'mol' if it was successfully created, else defaults.
            # This is handled by initial setup and update after mol creation.

        # Final cleanup of the error key
        if final_result_data.get("error") is None:
            if "error" in final_result_data:  # Check key existence before del
                del final_result_data["error"]

        return final_result_data

    async def predict_smiles_data(self, smiles: str) -> Dict[str, Any]:
        """Process a single SMILES string for BBB prediction and molecular properties (non-blocking)."""
        if not self.is_loaded:
            logger.error("Model not loaded, cannot perform BBB prediction.")
            # This exception will propagate and be caught by the caller in process_batch_job
            raise RuntimeError("Model not loaded")

        if not smiles:
            logger.warning("Input SMILES string is empty.")
            return {
                "smiles": smiles,
                "status": "error_empty_smiles",
                "error": "Input SMILES string is empty.",
                "bbb_probability": None,
                "bbb_class": "unknown",
                "bbb_confidence": None,
                **self._calculate_molecular_properties(None),  # Default properties
            }

        logger.info(f"Processing SMILES (async via threadpool): {repr(smiles)}")
        try:
            # Offload the synchronous, CPU-bound work to a thread pool
            result = await run_in_threadpool(self._run_prediction_pipeline_sync, smiles)
            # ADDED LOGGING HERE (Corrected Placement)
            logger.info(
                f"Pipeline result for SMILES '{smiles}' (from try block): {result}"
            )
            if "prediction_class" in result:
                logger.info(
                    f"  prediction_class in pipeline_result for '{smiles}': {result['prediction_class']}"
                )
            else:
                logger.warning(
                    f"  prediction_class MISSING in pipeline_result for SMILES: {smiles}"
                )
        except Exception as e_threadpool:
            # This catches errors from within _run_prediction_pipeline_sync if they weren't handled
            # or errors during the threadpool execution itself.
            logger.error(
                f"Error running prediction pipeline in threadpool for SMILES '{smiles}': {e_threadpool}",
                exc_info=True,
            )
            return {
                "smiles": smiles,
                "status": "error_threadpool_execution",
                "error": f"Critical error in prediction pipeline: {e_threadpool}",
                "bbb_probability": None,
                "bbb_class": "unknown",
                "bbb_confidence": None,
                **self._calculate_molecular_properties(None),  # Default properties
            }
        return result

    def _prepare_fingerprint(
        self, mol: Optional[Chem.Mol]
    ) -> Optional[NDArray[np.int_]]:
        """Convert an RDKit Mol object to a Morgan fingerprint if the mol is valid."""
        if mol is None:
            return None
        try:
            fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(
                mol, settings.FP_RADIUS, nBits=settings.FP_NBITS
            )
            return np.array(fp, dtype=np.int_)
        except Exception as e:
            logger.error(f"Error generating fingerprint: {e}", exc_info=True)
            return None

    async def predict_batch(self, smiles_list: List[str]) -> List[Dict[str, Any]]:
        """Process a batch of SMILES strings for BBB prediction and properties."""
        results: List[Dict[str, Any]] = []
        for smiles in smiles_list:
            single_result = await self.predict_smiles_data(smiles)
            results.append(single_result)
        return results

    def get_feature_importance(self, top_n: int = 20) -> List[Tuple[int, float]]:
        """Get top N most important features from the model."""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        assert self.model is not None

        importances: NDArray[np.float64] = self.model.feature_importances_
        indices: NDArray[np.int_] = np.argsort(importances)[::-1][:top_n]

        return [(int(idx), float(importances[idx])) for idx in indices]
