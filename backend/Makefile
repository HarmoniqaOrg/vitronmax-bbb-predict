
.PHONY: setup install test lint format clean clean-cache run build-docker

# Default python command
PYTHON = python3
PIP = $(PYTHON) -m pip

# Project directories
SRC_DIR = app
TEST_DIR = tests
VENV_DIR = venv

# URLs and ports
APP_PORT = 8080
DOCS_URL = http://localhost:$(APP_PORT)/docs

# Environment variables
ENV_FILE ?= .env

# Commands
setup: install

install: $(VENV_DIR)
	. $(VENV_DIR)/bin/activate && $(PIP) install -r requirements.txt

$(VENV_DIR):
	$(PYTHON) -m venv $(VENV_DIR)

run:
	. $(VENV_DIR)/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port $(APP_PORT)

run-production:
	. $(VENV_DIR)/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port $(APP_PORT)

test:
	. $(VENV_DIR)/bin/activate && pytest -q

test-cov:
	. $(VENV_DIR)/bin/activate && pytest --cov=$(SRC_DIR) --cov-report=term --cov-report=html

format:
	. $(VENV_DIR)/bin/activate && black $(SRC_DIR) $(TEST_DIR)

lint:
	. $(VENV_DIR)/bin/activate && ruff $(SRC_DIR) $(TEST_DIR)
	. $(VENV_DIR)/bin/activate && flake8 $(SRC_DIR) $(TEST_DIR) --select E9,F63,F7,F82

type-check:
	. $(VENV_DIR)/bin/activate && mypy $(SRC_DIR) --strict --warn-return-any --disallow-any-generics

check: lint type-check test-cov

clean:
	rm -rf __pycache__ .pytest_cache .coverage htmlcov .mypy_cache .ruff_cache

clean-cache:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name "*.eggs" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	rm -rf .coverage htmlcov

build-docker:
	docker build -t vitronmax:latest .

run-docker:
	docker run -p $(APP_PORT):$(APP_PORT) --env-file $(ENV_FILE) vitronmax:latest

help:
	@echo "Available commands:"
	@echo "  setup           - Create virtual environment and install dependencies"
	@echo "  install         - Install project dependencies"
	@echo "  run             - Run the API in development mode"
	@echo "  run-production  - Run the API in production mode"
	@echo "  test            - Run tests"
	@echo "  test-cov        - Run tests with coverage report"
	@echo "  format          - Format code with black"
	@echo "  lint            - Lint code with ruff and flake8"
	@echo "  type-check      - Check types with mypy"
	@echo "  check           - Run all checks (lint, type-check, test)"
	@echo "  clean           - Remove generated files"
	@echo "  clean-cache     - Remove all cache directories"
	@echo "  build-docker    - Build Docker image"
	@echo "  run-docker      - Run Docker container"
	@echo "  help            - Show this help message"
