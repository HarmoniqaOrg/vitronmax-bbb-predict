"""
Tests for BBB predictor functionality.
"""

import pytest
import numpy as np
from app.ml.predictor import BBBPredictor


@pytest.fixture
async def predictor():
    """Create predictor instance for testing."""
    pred = BBBPredictor()
    await pred.load_model()
    return pred


class TestBBBPredictor:
    """Test cases for BBB predictor."""

    @pytest.mark.asyncio
    async def test_model_loading(self, predictor):
        """Test model loading."""
        assert predictor.is_loaded
        assert predictor.model is not None

    def test_smiles_to_fingerprint(self, predictor):
        """Test SMILES to fingerprint conversion."""
        smiles = "CCO"  # ethanol
        fp = predictor.smiles_to_fingerprint(smiles)

        assert isinstance(fp, np.ndarray)
        assert fp.shape == (2048,)  # Default fingerprint size
        assert fp.dtype == bool or fp.dtype == int

    def test_invalid_smiles(self, predictor):
        """Test handling of invalid SMILES."""
        invalid_smiles = "INVALID_SMILES_123"

        with pytest.raises(ValueError):
            predictor.smiles_to_fingerprint(invalid_smiles)

    def test_predict_single(self, predictor):
        """Test single molecule prediction."""
        smiles = "CCO"  # ethanol

        probability, pred_class, confidence, fingerprint = predictor.predict_single(
            smiles
        )

        assert 0.0 <= probability <= 1.0
        assert pred_class in ["permeable", "non_permeable"]
        assert 0.0 <= confidence <= 1.0
        assert isinstance(fingerprint, np.ndarray)

    def test_predict_batch(self, predictor):
        """Test batch prediction."""
        smiles_list = ["CCO", "CC(=O)O", "c1ccccc1"]  # ethanol, acetic acid, benzene

        results = predictor.predict_batch(smiles_list)

        assert len(results) == len(smiles_list)

        for result in results:
            probability, pred_class, confidence, fingerprint = result
            assert 0.0 <= probability <= 1.0
            assert pred_class in ["permeable", "non_permeable", "unknown"]
            assert 0.0 <= confidence <= 1.0

    def test_fingerprint_hash(self, predictor):
        """Test fingerprint hashing."""
        smiles = "CCO"
        fp = predictor.smiles_to_fingerprint(smiles)
        hash_val = predictor.calculate_fingerprint_hash(fp)

        assert isinstance(hash_val, str)
        assert len(hash_val) == 32  # MD5 hash length

    def test_feature_importance(self, predictor):
        """Test feature importance retrieval."""
        importance = predictor.get_feature_importance(top_n=5)

        assert len(importance) == 5
        assert all(
            isinstance(idx, int) and isinstance(imp, float) for idx, imp in importance
        )


@pytest.mark.asyncio
async def test_model_not_loaded():
    """Test behavior when model is not loaded."""
    predictor = BBBPredictor()

    with pytest.raises(RuntimeError):
        predictor.predict_single("CCO")

    with pytest.raises(RuntimeError):
        predictor.get_feature_importance()
