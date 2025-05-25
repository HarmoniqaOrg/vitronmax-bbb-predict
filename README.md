# VitronMax - BBB Permeability Prediction Platform

A fast, explainable in-silico screening platform for Blood-Brain-Barrier (BBB) permeability prediction.

## 🚀 Features

- **API-First Design**: RESTful API with comprehensive endpoints
- **Batch Processing**: Async CSV upload and processing
- **ML Predictions**: Random Forest model with Morgan fingerprints
- **AI Explanations**: GPT-powered molecular insights
- **Modern Dashboard**: React/Next.js interface
- **Production Ready**: Docker, CI/CD, monitoring

## 📊 Performance Targets

- External AUC-ROC ≥ 0.90
- 95th-percentile latency < 800ms
- 80%+ test coverage

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
- Recharts for visualizations

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
docker build -t vitronmax .
docker run -p 8080:8080 vitronmax
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

- `POST /predict_fp` - Single molecule prediction
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
```

## 📄 License

MIT License - see LICENSE file for details.
