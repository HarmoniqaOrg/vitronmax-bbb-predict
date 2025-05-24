
# VitronMax API Documentation

## Overview

The VitronMax API provides a comprehensive set of endpoints for predicting Blood-Brain-Barrier (BBB) permeability of molecules. The API is RESTful and returns responses in JSON format.

Base URL: `https://api.vitronmax.com/api/v1`

## Authentication

*Note: Authentication will be implemented in a future version.*

## Endpoints

### Health Check

```
GET /healthz
```

Check if the API is running.

#### Response

```json
{
  "status": "healthy",
  "timestamp": 1682541872,
  "version": "1.0.0",
  "service": "VitronMax API"
}
```

### Single Molecule Prediction

```
POST /predict_fp
```

Predict BBB permeability for a single molecule using fingerprint analysis.

#### Request Body

```json
{
  "smiles": "CCO",
  "molecule_name": "Ethanol"  // Optional
}
```

#### Response

```json
{
  "smiles": "CCO",
  "molecule_name": "Ethanol",
  "bbb_probability": 0.72,
  "prediction_class": "permeable",
  "confidence_score": 0.88,
  "fingerprint_features": [0, 1, 0, 0, 1, ...],  // First 10 features
  "processing_time_ms": 357.2
}
```

### Batch Prediction

```
POST /batch_predict_csv
```

Upload a CSV file for batch processing of multiple molecules.

#### Request

Multipart form data with:
- `file`: CSV file with 'smiles' column (required) and optional 'molecule_name' column
- `job_name`: Optional name for the batch job
- `notify_email`: Optional email for completion notification

#### Response

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "created_at": "2023-04-26T15:30:45.123Z",
  "estimated_completion_time": "2023-04-26T15:45:45.123Z",
  "total_molecules": 256
}
```

### Batch Job Status

```
GET /batch_status/{job_id}
```

Check the status of a batch prediction job.

#### Response

```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "created_at": "2023-04-26T15:30:45.123Z",
  "updated_at": "2023-04-26T15:35:45.123Z",
  "total_molecules": 256,
  "processed_molecules": 128,
  "failed_molecules": 2,
  "progress_percentage": 50.0,
  "estimated_completion_time": "2023-04-26T15:45:45.123Z"
}
```

Status can be one of: `pending`, `processing`, `completed`, `failed`

### Download Batch Results

```
GET /download/{job_id}
```

Download the results of a completed batch job as a CSV file.

#### Response

A CSV file with headers:
- `smiles`
- `molecule_name`
- `bbb_probability`
- `prediction_class`
- `confidence_score`
- `error` (only for failed predictions)

### Generate PDF Report

```
POST /report
```

Generate a PDF report for a single molecule.

#### Request Body

```json
{
  "smiles": "CCO",
  "molecule_name": "Ethanol"  // Optional
}
```

#### Response

A PDF file with molecule information, prediction results, and interpretation.

### Get Report by ID

```
GET /report/{molecule_id}
```

Get a PDF report for a previously analyzed molecule by ID.

#### Response

A PDF file with molecule information, prediction results, and interpretation.

### AI Explanation

```
POST /explain
```

Get an AI-powered explanation of a BBB permeability prediction.

#### Request Body

```json
{
  "smiles": "CCO",
  "prediction_result": {  // Optional, will be predicted if not provided
    "bbb_probability": 0.72,
    "prediction_class": "permeable",
    "confidence_score": 0.88
  },
  "context": "Focus on lipophilicity factors"  // Optional
}
```

#### Response

Server-sent events stream with explanation content:

```
data: {"content": "Analyzing the molecule structure..."}
data: {"content": " This molecule has several features..."}
data: {"content": " The primary factor for BBB permeability is..."}
data: {"done": true}
```

### Model Information

```
GET /model/info
```

Get information about the prediction model.

#### Response

```json
{
  "model_type": "RandomForestClassifier",
  "fingerprint_type": "Morgan",
  "fingerprint_radius": 2,
  "fingerprint_bits": 2048,
  "n_estimators": 100,
  "top_features": [[1024, 0.12], [256, 0.09], [512, 0.07], ...],
  "is_loaded": true
}
```

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "error_type",
  "message": "Human readable error message",
  "details": {  // Optional additional information
    "field": "smiles",
    "reason": "Invalid SMILES string"
  }
}
```

Common HTTP status codes:
- `400` - Bad Request (invalid input)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Limits and Constraints

- Maximum CSV file size: 50MB
- Maximum batch size: 10,000 molecules
- Rate limits: 60 requests per minute per IP address
- Results storage: 30 days
