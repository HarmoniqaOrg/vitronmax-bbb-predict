
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies
# Added build-essential for a more complete build environment.
# Added common libraries that can help with compilation of scientific packages.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libfontconfig1 \
    libfreetype6 \
    libxrender1 \
    libxext6 \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip, setuptools, and wheel first
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p models

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/healthz || exit 1

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
