
"""
Tests for API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestHealthCheck:
    """Test health check endpoint."""
    
    def test_health_check(self):
        """Test health check endpoint."""
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestPredictionAPI:
    """Test prediction endpoint."""
    
    def test_predict_fp_success(self):
        """Test successful prediction with valid SMILES."""
        response = client.post(
            "/api/v1/predict_fp",
            json={"smiles": "CCO", "molecule_name": "ethanol"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "smiles" in data
        assert "bbb_probability" in data
        assert "prediction_class" in data
        assert "confidence_score" in data
        assert "processing_time_ms" in data
        
        assert data["smiles"] == "CCO"
        assert 0 <= data["bbb_probability"] <= 1
        assert data["prediction_class"] in ["permeable", "non_permeable"]
        assert 0 <= data["confidence_score"] <= 1
        assert data["processing_time_ms"] > 0
    
    def test_invalid_smiles(self):
        """Test behavior with invalid SMILES."""
        response = client.post(
            "/api/v1/predict_fp",
            json={"smiles": "INVALID_SMILES_123"}
        )
        assert response.status_code == 400
    
    def test_empty_smiles(self):
        """Test behavior with empty SMILES."""
        response = client.post(
            "/api/v1/predict_fp",
            json={"smiles": ""}
        )
        assert response.status_code == 422
    
    def test_model_info(self):
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
    
    def test_explain_sample(self):
        """Test sample explanation endpoint."""
        response = client.get("/api/v1/explain/sample")
        assert response.status_code == 200
        data = response.json()
        
        assert "smiles" in data
        assert "explanation" in data
        assert "confidence" in data
        assert "prediction" in data
