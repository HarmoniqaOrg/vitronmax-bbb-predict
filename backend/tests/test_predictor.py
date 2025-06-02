"""
Tests for BBB predictor functionality.
"""

import pytest
from rdkit import Chem
from pytest import approx
from app.ml.predictor import BBBPredictor


@pytest.fixture(scope="function")
async def predictor_with_model() -> BBBPredictor:
    """Create predictor instance for testing and ensure model is loaded."""
    pred = BBBPredictor()
    # Model is now loaded in __init__. Assert it's loaded.
    assert pred.is_loaded, "Model should be loaded after BBBPredictor instantiation"
    return pred


@pytest.fixture(scope="function")
def predictor_instance() -> BBBPredictor:
    """Fixture to provide a BBBPredictor instance (model not necessarily loaded)."""
    return BBBPredictor()


# New Test Class for Molecular Properties
class TestBBBPredictorProperties:
    def test_calculate_molecular_properties_aspirin(
        self, predictor_instance: BBBPredictor
    ):
        """Test _calculate_molecular_properties with Aspirin."""
        smiles = "CC(=O)OC1=CC=CC=C1C(=O)O"  # Aspirin
        mol = Chem.MolFromSmiles(smiles)
        assert mol is not None, "Failed to parse Aspirin SMILES"

        properties = predictor_instance._calculate_molecular_properties(mol)

        assert properties["mw"] == approx(180.157, rel=1e-3)
        assert properties["logp"] == approx(1.25, abs=0.2)
        assert properties["tpsa"] == approx(63.60, rel=1e-3)
        assert properties["rot_bonds"] == 2
        assert properties["h_acceptors"] == 3
        assert properties["h_donors"] == 1
        assert properties["heavy_atoms"] == 13
        assert properties["mol_formula"] == "C9H8O4"
        assert properties["frac_csp3"] == approx(
            1 / 9, rel=1e-2
        )  # Aspirin: 1 CH3 (sp3) / 9 total C
        assert properties["molar_refractivity"] is not None  # Value can vary
        assert properties["log_s_esol"] is not None
        assert properties["gi_absorption"] == "High"
        assert properties["lipinski_passes"] is True
        assert properties["pains_alerts"] == 0
        assert (
            properties["brenk_alerts"] > 0
        )  # Updated: Aspirin might have Brenk alerts
        assert "error" not in properties or properties["error"] is None

    def test_calculate_molecular_properties_invalid_mol_input(
        self, predictor_instance: BBBPredictor
    ):
        """Test _calculate_molecular_properties with Mol=None."""
        properties = predictor_instance._calculate_molecular_properties(None)
        assert properties["mw"] is None
        assert properties["pains_alerts"] == 0
        assert properties["brenk_alerts"] == 0
        assert properties["logp"] is None

    def test_calculate_molecular_properties_with_alerts_known_brenk(
        self, predictor_instance: BBBPredictor
    ):
        """Test _calculate_molecular_properties with a molecule expected to have a Brenk alert (using RDKit's built-in set)."""
        test_smiles = "C1OC1C"  # Propylene oxide - an epoxide, often a Brenk alert
        mol = Chem.MolFromSmiles(test_smiles)
        assert mol is not None, f"Failed to parse molecule SMILES: {test_smiles}"

        properties = predictor_instance._calculate_molecular_properties(mol)
        assert isinstance(properties["pains_alerts"], int)
        assert isinstance(properties["brenk_alerts"], int)
        assert (
            properties["brenk_alerts"] > 0
        ), f"Expected Brenk alert for {test_smiles} (using RDKit built-in), got {properties['brenk_alerts']}"
        # Propylene oxide should not have PAINS alerts from the standard PAINS filters A, B, C
        assert (
            properties["pains_alerts"] == 0
        ), f"Expected 0 PAINS alerts for {test_smiles}, got {properties['pains_alerts']}"

    def test_calculate_molecular_properties_with_alerts_propylene_oxide(
        self, predictor_instance: BBBPredictor
    ):
        """Test _calculate_molecular_properties with Propylene oxide (known Brenk alert)."""
        test_smiles = "C1OC1C"  # Propylene oxide
        mol = Chem.MolFromSmiles(test_smiles)
        assert mol is not None, f"Failed to parse Propylene oxide SMILES: {test_smiles}"

        properties = predictor_instance._calculate_molecular_properties(mol)
        assert isinstance(properties["pains_alerts"], int)
        assert isinstance(properties["brenk_alerts"], int)
        assert (
            properties["brenk_alerts"] > 0
        ), f"Expected Brenk alert for Propylene oxide, got {properties['brenk_alerts']}"
        assert (
            properties["pains_alerts"] == 0
        ), f"Expected 0 PAINS alerts for Propylene oxide, got {properties['pains_alerts']}"

    def test_calculate_molecular_properties_with_pains_quinone(
        self, predictor_instance: BBBPredictor
    ):
        """Test _calculate_molecular_properties with 1,4-benzoquinone (known PAINS alert)."""
        test_smiles = "O=C1C=CC(=O)C=C1"  # 1,4-benzoquinone
        mol = Chem.MolFromSmiles(test_smiles)
        assert (
            mol is not None
        ), f"Failed to parse 1,4-benzoquinone SMILES: {test_smiles}"

        properties = predictor_instance._calculate_molecular_properties(mol)
        assert isinstance(properties["pains_alerts"], int)
        assert isinstance(properties["brenk_alerts"], int)
        assert (
            properties["pains_alerts"] > 0  # 1,4-benzoquinone is a known PAINS alert
        ), f"Expected PAINS alert for 1,4-benzoquinone, got {properties['pains_alerts']}"
        assert (
            properties["brenk_alerts"]
            > 0  # 1,4-benzoquinone is also a Brenk alert with RDKit's catalog
        ), f"Expected >0 Brenk alerts for 1,4-benzoquinone, got {properties['brenk_alerts']}"


class TestBBBPredictor:
    """Test cases for BBB predictor (legacy tests, may need update/removal)."""

    @pytest.mark.asyncio
    async def test_model_loading(self, predictor_with_model: BBBPredictor) -> None:
        """Test model loading."""
        assert predictor_with_model.is_loaded
        assert predictor_with_model.model is not None

    @pytest.mark.asyncio
    async def test_predict_smiles_data_aspirin(
        self, predictor_with_model: BBBPredictor
    ):
        """Test predict_smiles_data with valid SMILES (Aspirin)."""
        smiles = "CC(=O)OC1=CC=CC=C1C(=O)O"
        data = await predictor_with_model.predict_smiles_data(smiles)

        assert data["status"] == "success"
        assert data["smiles"] == smiles
        assert data["mw"] == approx(180.157, rel=1e-3)
        assert data["pains_alerts"] == 0
        assert data["brenk_alerts"] == 1  # Aspirin has one Brenk alert (ester)
        assert data["bbb_probability"] is not None
        assert 0 <= data["bbb_probability"] <= 1
        assert data["prediction_class"] in [
            "permeable",
            "non_permeable",
        ]  # Assuming these are the classes
        assert data["prediction_certainty"] is not None
        assert 0 <= data["prediction_certainty"] <= 1
        assert (
            data.get("applicability_score") is not None
        )  # Aspirin should have a score
        if data.get("applicability_score") is not None:  # Check range only if present
            assert 0 <= data["applicability_score"] <= 1
        assert data.get("fingerprint_hash") is not None  # Aspirin should have a hash
        if data.get("fingerprint_hash") is not None:  # Check type only if present
            assert isinstance(data["fingerprint_hash"], str)
        assert "error" not in data or data["error"] is None  # Existing check

    @pytest.mark.asyncio
    async def test_predict_smiles_data_invalid_smiles(
        self, predictor_instance: BBBPredictor
    ):
        """Test predict_smiles_data with invalid SMILES."""
        smiles = "INVALID[ SMILES"
        # Ensure predictor_instance's model is loaded if not already (e.g. by calling load_model or using predictor_with_model)
        # Since predict_smiles_data now loads the model internally, this should be fine.
        if not predictor_instance.is_loaded:
            await predictor_instance.load_model()  # Explicitly load if using raw instance

        data = await predictor_instance.predict_smiles_data(smiles)
        assert data["status"] == "error_invalid_smiles"
        assert "Invalid SMILES string" in data.get(
            "error", ""
        )  # Check if error message is as expected
        assert data.get("bbb_probability") == 0.0
        assert data.get("prediction_certainty") == 0.0
        # Check the default bbb_class for invalid smiles.
        # _run_prediction_pipeline_sync returns "non_permeable" as prediction_class from initial dict.
        assert data.get("prediction_class") == "non_permeable"
        assert data.get("applicability_score") is None
        assert data.get("fingerprint_hash") is None

    @pytest.mark.asyncio
    async def test_predict_smiles_data_empty_smiles(
        self, predictor_instance: BBBPredictor
    ):
        """Test predict_smiles_data with empty SMILES."""
        smiles = ""
        if not predictor_instance.is_loaded:
            await predictor_instance.load_model()  # Explicitly load if using raw instance

        data = await predictor_instance.predict_smiles_data(smiles)  # Added await
        assert data["status"] == "error_empty_smiles"
        assert data["error"] is not None

    @pytest.mark.asyncio
    async def test_predict_batch_new_logic(self, predictor_with_model: BBBPredictor):
        """Test new predict_batch logic returning list of dicts."""
        smiles_list = ["CCO", "INVALID_SMILES", "CC(=O)O", ""]
        results = await predictor_with_model.predict_batch(smiles_list)

        assert len(results) == len(smiles_list)

        # Ethanol (CCO) - success
        assert results[0]["status"] == "success"
        assert results[0]["smiles"] == "CCO"
        assert results[0]["mw"] is not None
        assert results[0]["bbb_probability"] is not None

        # INVALID_SMILES - error
        assert results[1]["status"] != "success"
        assert results[1]["smiles"] == "INVALID_SMILES"
        assert results[1]["error"] is not None
        assert results[1]["mw"] is None

        # Acetic Acid (CC(=O)O) - success
        assert results[2]["status"] == "success"
        assert results[2]["smiles"] == "CC(=O)O"
        assert results[2]["mw"] is not None

        # Empty SMILES - error
        assert results[3]["status"] == "error_empty_smiles"
        assert results[3]["smiles"] == ""
        assert results[3]["error"] is not None


@pytest.mark.asyncio
async def test_model_not_loaded_predict_smiles_data() -> None:
    """Test behavior of predict_smiles_data when model is not loaded."""
    predictor = BBBPredictor()  # Model now loads in __init__
    # assert not predictor.is_loaded  # This assertion is no longer valid
    with pytest.raises(RuntimeError, match="Model not loaded"):
        # To properly test this, we'd need to mock _load_model to fail and ensure is_loaded remains False
        # For now, if __init__ succeeds (even with dummy), is_loaded will be True.
        # Let's assume for this test case, we simulate is_loaded being False manually for the check.
        predictor.is_loaded = False  # Manually set for test purpose
        await predictor.predict_smiles_data("CCO")


@pytest.mark.asyncio
async def test_model_not_loaded_get_feature_importance() -> None:
    """Test get_feature_importance when model is not loaded."""
    predictor = BBBPredictor()  # Model now loads in __init__
    # assert not predictor.is_loaded # This assertion is no longer valid
    with pytest.raises(RuntimeError, match="Model not loaded"):
        # Similar to above, we'd need to mock _load_model to fail.
        # Manually setting for test purpose.
        predictor.is_loaded = False  # Manually set for test purpose
        await predictor.get_feature_importance()
