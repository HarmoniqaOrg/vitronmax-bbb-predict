
"""
PyTest configuration and fixtures.
"""

import pytest
import os
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

# Set environment variables for testing
os.environ["SUPABASE_URL"] = "https://mock.supabase.co"
os.environ["SUPABASE_SERVICE_KEY"] = "mock_key"
os.environ["OPENAI_API_KEY"] = "mock_key"
os.environ["STORAGE_BUCKET_NAME"] = "test-bucket"
os.environ["ENV"] = "test"
os.environ["LOG_LEVEL"] = "ERROR"


@pytest.fixture(scope="session", autouse=True)
def mock_supabase():
    """Mock Supabase client."""
    from unittest.mock import patch, MagicMock
    
    # Create mock storage object
    mock_storage = MagicMock()
    mock_storage.from_.return_value.upload.return_value = {"Key": "test-file.csv"}
    mock_storage.from_.return_value.download.return_value = b"test,data\n1,2"
    
    # Create mock table object
    mock_table = MagicMock()
    mock_table.select.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
    mock_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{
        "job_id": "test-job",
        "status": "completed",
        "created_at": "2023-01-01T00:00:00",
        "updated_at": "2023-01-01T01:00:00",
        "total_molecules": 10,
        "processed_molecules": 10,
        "failed_molecules": 0,
        "progress_percentage": 100.0,
        "results_file_path": "test-file.csv",
        "estimated_completion_time": "2023-01-01T01:00:00"
    }])
    mock_table.update.return_value.eq.return_value.execute.return_value = None
    mock_table.insert.return_value.execute.return_value = None
    
    # Create mock supabase client
    mock_client = MagicMock()
    mock_client.table.return_value = mock_table
    mock_client.storage = mock_storage
    
    with patch("app.core.database.create_client", return_value=mock_client):
        yield


@pytest.fixture(scope="session", autouse=True)
def mock_openai():
    """Mock OpenAI client."""
    from unittest.mock import patch, MagicMock, AsyncMock
    
    # Create mock AsyncMock for streaming response
    mock_stream = AsyncMock()
    mock_stream.__aiter__.return_value = [
        MagicMock(choices=[MagicMock(delta=MagicMock(content="Test", get=lambda x: "Test"))])
    ]
    
    # Mock OpenAI API
    with patch("openai.ChatCompletion.acreate", return_value=mock_stream):
        yield
