"""
BBB permeability prediction using Random Forest and Morgan fingerprints.
"""

import logging
import joblib
import numpy as np
from numpy.typing import NDArray
from typing import List, Tuple, Optional

from pathlib import Path
import hashlib

from rdkit import Chem
from rdkit.Chem import rdMolDescriptors
from sklearn.ensemble import RandomForestClassifier

from app.core.config import settings

logger = logging.getLogger(__name__)


class BBBPredictor:
    """Blood-Brain-Barrier permeability predictor."""

    def __init__(self) -> None:
        self.model: Optional[RandomForestClassifier] = None
        self.is_loaded = False

    async def load_model(self) -> None:
        """Load the trained Random Forest model."""
        try:
            model_path = Path(settings.MODEL_PATH)
            if not model_path.exists():
                # Create a dummy model for demo purposes
                logger.warning("Model file not found, creating dummy model")
                self._create_dummy_model()
            else:
                self.model = joblib.load(model_path)

            self.is_loaded = True
            logger.info("BBB prediction model loaded successfully")

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

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

    def smiles_to_fingerprint(self, smiles: str) -> NDArray[np.int_]:
        """Convert SMILES to Morgan fingerprint."""
        try:
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                raise ValueError(f"Invalid SMILES: {smiles}")

            # Generate Morgan fingerprint
            fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(
                mol, radius=settings.FP_RADIUS, nBits=settings.FP_NBITS
            )

            # Convert to numpy array
            fp_array: NDArray[np.int_] = np.array(list(fp), dtype=np.int_)
            return fp_array

        except Exception as e:
            logger.error(f"Error generating fingerprint for {smiles}: {e}")
            raise

    def calculate_fingerprint_hash(self, fingerprint: NDArray[np.int_]) -> str:
        """Calculate hash of fingerprint for caching."""
        fp_bytes: bytes = fingerprint.tobytes()
        return hashlib.md5(fp_bytes).hexdigest()

    def predict_single(self, smiles: str) -> Tuple[float, str, float, NDArray[np.int_]]:
        """
        Predict BBB permeability for a single molecule.

        Returns:
            Tuple of (probability, class, confidence, fingerprint)
        """
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        assert self.model is not None  # Ensure model is not None for Mypy

        # Generate fingerprint
        fingerprint = self.smiles_to_fingerprint(smiles)

        # Make prediction
        fp_reshaped = fingerprint.reshape(1, -1)
        probability = self.model.predict_proba(fp_reshaped)[
            0, 1
        ]  # Probability of class 1 (permeable)

        # Determine class
        prediction_class = "permeable" if probability >= 0.5 else "non_permeable"

        # Calculate confidence (distance from decision boundary)
        confidence = abs(probability - 0.5) * 2

        return probability, prediction_class, confidence, fingerprint

    def predict_batch(
        self, smiles_list: List[str]
    ) -> List[Tuple[float, str, float, NDArray[np.int_]]]:
        """Predict BBB permeability for multiple molecules."""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        assert self.model is not None  # Ensure model is not None for Mypy

        results: List[Tuple[float, str, float, NDArray[np.int_]]] = []
        for smiles in smiles_list:
            try:
                result = self.predict_single(smiles)
                results.append(result)
            except Exception as e:
                logger.warning(f"Failed to predict for {smiles}: {e}")
                # Return default values for failed predictions
                results.append(
                    (0.0, "unknown", 0.0, np.zeros(settings.FP_NBITS, dtype=np.int_))
                )

        return results

    def get_feature_importance(self, top_n: int = 20) -> List[Tuple[int, float]]:
        """Get top N most important features from the model."""
        if not self.is_loaded:
            raise RuntimeError("Model not loaded")
        assert self.model is not None  # Ensure model is not None for Mypy

        importances: NDArray[np.float64] = self.model.feature_importances_
        indices: NDArray[np.int_] = np.argsort(importances)[::-1][:top_n]

        return [(int(idx), float(importances[idx])) for idx in indices]
