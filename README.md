# VitronMax - BBB Permeability Prediction Platform

A fast, explainable in-silico screening platform for Blood-Brain-Barrier (BBB) permeability prediction.

## 📚 About

VitronMax is an open-source machine learning platform for predicting blood-brain barrier (BBB) permeability of drug candidates with state-of-the-art accuracy (AUC-ROC: 0.932, AUC-PR: 0.959). Built on Random Forest with Morgan fingerprints and validated on 7,807 diverse compounds, it offers reliable predictions for CNS drug discovery pipelines. 

## 🚀 Features

- **API-First Design**: RESTful API with comprehensive endpoints
- **Batch Processing**: Async CSV upload and processing
- **ML Predictions**: Random Forest model with Morgan fingerprints
- **AI Explanations**: GPT-powered molecular insights
- **Modern Dashboard**: React/Next.js interface
- **Production Ready**: Docker, CI/CD, monitoring
- **Extra Features**: Molecular property calculations, structural alerts, 3D visualization, and comprehensive scientific validation.

## 🧬 Model Validation

The VitronMax Blood-Brain Barrier (BBB) permeability prediction model has been rigorously validated on an external dataset of 7807 molecules, achieving excellent performance:

- **AUC-ROC**: 0.932
- **AUC-PR**: 0.959
- **Accuracy**: 0.85
- **F1-score (BBB+)**: 0.89
- **F1-score (BBB-)**: 0.78

The model uses a Random Forest algorithm with Morgan molecular fingerprints and has been validated through 5-fold cross-validation (AUC-ROC: 0.925 ± 0.011) and on an external test set.

For complete documentation on the validation methodology, detailed performance metrics, and applicability domain, see the [model validation documentation](docs/model-validation.md).

## 🛠 Tech Stack

### Backend
- Python 3.10 + FastAPI
- RDKit for molecular processing
- scikit-learn RandomForest
- Supabase (Postgres + Storage)
- OpenAI API integration

### Frontend
- Next.js 14 + TypeScript
- Tailwind CSS + shadcn/ui
- React Query for data fetching
- Recharts, 3Dmol.js and RDKit for visualizations

### Infrastructure
- Fly.io deployment
- GitHub Actions CI/CD
- Docker containerization
- Playwright E2E testing

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repo-url>
cd VitronMax

# Backend setup (Python 3.11+ recommended, use a virtual environment)
cd backend
python -m venv .venv
# Activate venv (e.g., source .venv/bin/activate or .venv\Scripts\activate)
# requirements.txt contains pinned versions for model compatibility.
pip install -r requirements.txt
# Ensure MODEL_PATH in .env is set or default is used (see Environment Setup)
uvicorn app.main:app --reload

# Frontend setup
cd ../frontend
npm install
npm run dev

# Docker deployment
# (Assumes Dockerfile is at the project root)
docker build -t vitronmax .
docker run -p 8080:8080 vitronmax

# For Fly.io deployment:
# - Ensure `fly.toml` and `Dockerfile` are at the project root.
# - Run `fly deploy` from the project root directory.
# - The `APP_PROJECT_ROOT_ENV` environment variable in `fly.toml` should be set (e.g., to "/app")
#   to ensure correct path resolution within the Docker container.
```

## 📚 Documentation

- [Product Requirements](docs/PRD.md)
- [API Documentation](docs/API-documentation.md)
- [Deployment Guide](docs/DEPLOY.md)

## 🧪 Testing

```bash
# Backend tests
# (Assumes virtual environment is active and MODEL_PATH is configured for tests via conftest.py or .env)
# Tests now reliably pass; model loading issues in test environment resolved.
pytest -q --cov=app

# Frontend tests
npm test

# E2E tests
npx playwright test
```

## 📈 API Endpoints

- `POST /predict` - Single molecule prediction
- `POST /batch_predict_csv` - Batch processing
- `GET /batch_status/{id}` - Job status
- `GET /download/{id}` - Download results
- `GET /report/{molecule_id}` - PDF report
- `POST /explain` - AI explanation

## 🔧 Environment Setup

Copy `.env.example` to `.env` (located in the `backend` directory) and configure:

```env
OPENAI_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_SERVICE_KEY=your_key
STORAGE_BUCKET_NAME=vitronmax-storage # Ensure this bucket exists in your Supabase project
LOG_LEVEL=INFO
ENV=development # 'production', 'test', or 'development'
MODEL_PATH=models/default_model.joblib # Optional: path to your trained model relative to the backend directory
APP_PROJECT_ROOT_ENV=/app # For containerized deployments (like Fly.io, set in fly.toml), defines the project root inside the container.
                         # Not typically needed in local .env if running Python directly without Docker.
```

## 📄 License

MIT License - see LICENSE file for details.
