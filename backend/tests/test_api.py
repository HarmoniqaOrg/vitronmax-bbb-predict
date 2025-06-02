"""
Tests for API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from typing import Iterator


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


class TestHealthCheck:
    """Test health check endpoint."""

    def test_health_check(self, client: TestClient) -> None:
        """Test health check endpoint."""
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestPredictionAPI:
    """Test prediction endpoint."""

    def test_predict_fp_success(self, client: TestClient) -> None:
        """Test successful prediction with valid SMILES."""
        response = client.post(
            "/api/v1/predict", json={"smiles": "CCO", "molecule_name": "ethanol"}
        )
        assert response.status_code == 200
        data = response.json()

        assert "smiles" in data
        assert data["smiles"] == "CCO"
        assert "molecule_name" in data
        assert data["molecule_name"] == "ethanol"
        assert "bbb_probability" in data
        assert "bbb_class" in data
        assert "prediction_certainty" in data
        assert "applicability_score" in data  # Can be None
        assert (
            "fingerprint_hash" in data
        )  # Can be None if SMILES was invalid, but not for CCO
        assert "mw" in data
        assert "logp" in data
        assert "processing_time_ms" in data

        # Removed redundant check for input_smiles, already checked as data["smiles"]
        assert data["molecule_name"] == "ethanol"
        assert data["status"] == "success"
        assert 0 <= data["bbb_probability"] <= 1
        assert data["bbb_class"] in ["permeable", "non_permeable"]
        assert 0 <= data["prediction_certainty"] <= 1
        if data.get("applicability_score") is not None:
            assert 0 <= data["applicability_score"] <= 1
        assert isinstance(
            data.get("fingerprint_hash"), (str, type(None))
        )  # Should be a string for CCO
        assert data["processing_time_ms"] > 0

    def test_invalid_smiles(self, client: TestClient) -> None:
        """Test behavior with invalid SMILES."""
        response = client.post("/api/v1/predict", json={"smiles": "INVALID_SMILES_123"})
        assert response.status_code == 400
        json_response = response.json()
        assert "detail" in json_response

    def test_empty_smiles(self, client: TestClient) -> None:
        """Test behavior with empty SMILES."""
        response = client.post("/api/v1/predict", json={"smiles": ""})
        assert response.status_code == 400
        json_response = response.json()
        assert "detail" in json_response

    def test_model_info(self, client: TestClient) -> None:
        """Test model info endpoint."""
        response = client.get("/api/v1/model/info")
        assert response.status_code == 200
        data = response.json()

        assert "model_type" in data
        assert "fingerprint_type" in data
        assert "fingerprint_radius" in data
        assert "fingerprint_bits" in data
        assert "top_features" in data
        assert "is_loaded" in data


class TestExplainAPI:
    """Test explain endpoint."""

    def test_explain_sample(self, client: TestClient) -> None:
        """Test sample explanation endpoint."""
        response = client.get("/api/v1/explain/sample")
        assert response.status_code == 200
        data = response.json()

        assert "smiles" in data
        assert "explanation" in data
        assert "confidence" in data
        assert "prediction" in data
