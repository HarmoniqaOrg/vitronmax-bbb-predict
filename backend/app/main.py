"""
VitronMax FastAPI application main module.
Provides BBB permeability prediction API endpoints.
"""

import logging
import time
from contextlib import asynccontextmanager
from typing import Dict, Any, AsyncGenerator, Callable, Awaitable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from app.core.config import settings
from app.api.routes import prediction, batch, report, explain, utils, statistics
from app.core.database import init_db
from app.core.logging_config import setup_logging

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan management."""
    logger.info("Starting VitronMax API server...")

    # Initialize database
    await init_db()

    # Load ML model
    from app.ml.predictor import BBBPredictor

    app.state.predictor = BBBPredictor()
    await app.state.predictor.load_model()

    logger.info("VitronMax API server started successfully")
    yield

    logger.info("Shutting down VitronMax API server...")


# Create FastAPI app
app = FastAPI(
    title="VitronMax API",
    description="Blood-Brain-Barrier Permeability Prediction Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Add processing time to response headers."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Health check endpoint
@app.get("/healthz")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "service": "VitronMax API",
    }


# Include API routes
app.include_router(prediction.router, prefix="/api/v1", tags=["prediction"])
app.include_router(batch.router, prefix="/api/v1/batch_jobs", tags=["batch"])
app.include_router(report.router, prefix="/api/v1", tags=["report"])
app.include_router(explain.router, prefix="/api/v1", tags=["explain"])
app.include_router(utils.router, prefix="/api/v1/utils", tags=["utilities"])
app.include_router(statistics.router, prefix="/api/v1", tags=["statistics"])


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler for unhandled errors."""
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
        },
    )


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8001,
        reload=settings.ENV == "development",
        log_level=settings.LOG_LEVEL.lower(),
    )
