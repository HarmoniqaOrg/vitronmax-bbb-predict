
# Product Requirements Document (PRD)
# VitronMax - BBB Permeability Prediction Platform

## 1. Problem Statement

Drug discovery teams need a fast, explainable in-silico screening tool for Blood-Brain-Barrier (BBB) permeability. Existing tools are either too slow, lack explainability, or have poor accuracy.

## 2. Solution Overview

VitronMax is an API-first SaaS platform with a web dashboard that provides:

1. Fast single molecule BBB permeability predictions
2. Batch processing capabilities for large compound libraries
3. Explainable predictions with AI-powered insights
4. Detailed reports for documentation and analysis
5. Simple integration options for existing drug discovery workflows

## 3. MVP Components

### 3.1 `/predict_fp` Endpoint

**Purpose**: Single molecule prediction using Morgan fingerprints

**Requirements**:
- Accept SMILES input with optional molecule name
- Generate Morgan fingerprints (radius 2, 2048 bits)
- Return BBB permeability probability, prediction class, and confidence score
- 95th percentile latency < 800ms
- Results include processing time metrics

**Acceptance Criteria**:
- API returns valid predictions for standard molecules
- Invalid SMILES strings are rejected with appropriate error messages
- Latency meets performance target

### 3.2 Batch Processing

**Requirements**:
- `/batch_predict_csv` endpoint for async CSV uploads
- `/batch_status/{id}` endpoint for job status polling
- `/download/{id}` endpoint for results retrieval
- Support for files up to 50MB and 10,000 molecules
- Background processing with queue management
- Email notification option upon completion

**Acceptance Criteria**:
- System handles concurrent batch jobs correctly
- CSV files with valid structure are processed completely
- Progress tracking is accurate
- Results are available for download for at least 30 days

### 3.3 PDF Reports

**Requirements**:
- `/report` endpoint generates professional PDF reports
- Reports include molecule visualization, prediction results, and interpretation
- Include confidence metrics and methodology explanation
- Branded output with consistent formatting

**Acceptance Criteria**:
- PDFs render correctly in common viewers
- All prediction information is included
- Molecule visualization is clear and accurate

### 3.4 Dashboard

**Requirements**:
- Clean, responsive web interface
- Single molecule prediction form with visualization
- Batch upload workflow with progress tracking
- Results display with sorting and filtering options
- Basic analytics (usage statistics, success rate)

**Acceptance Criteria**:
- Dashboard works on desktop and mobile browsers
- All core API functions are accessible via UI
- Data visualization is clear and informative

### 3.5 AI Explanations

**Requirements**:
- `/explain` endpoint for streaming AI-powered explanations
- Use OpenAI's models to interpret predictions
- Highlight key molecular features affecting permeability
- Include confidence assessment and suggested modifications

**Acceptance Criteria**:
- Explanations are scientifically sound
- Explanations complete within reasonable time (<5 seconds)
- Streaming response provides progressive rendering

## 4. Technical Requirements

### 4.1 Performance

- 95th-percentile latency < 800 ms for single predictions
- Support for 100+ concurrent users
- 10,000+ molecules per batch job
- 99.9% uptime SLA

### 4.2 Security

- API authentication
- Rate limiting to prevent abuse
- Data encryption for sensitive information
- Secure storage of credentials (OpenAI, Supabase)

### 4.3 Infrastructure

- Fly.io deployment
- Supabase for database and storage
- CI/CD with GitHub Actions
- Monitoring and logging

## 5. Success Metrics

- External validation AUC-ROC ≥ 0.90
- 95th-percentile latency < 800 ms
- User feedback indicates useful explainability
- Test coverage ≥ 80%

## 6. Future Enhancements (Post-MVP)

- User accounts with saved results
- Integration with additional molecular property predictors
- API client libraries for common languages
- Advanced molecular visualization options
- Comparison tool for multiple compounds
