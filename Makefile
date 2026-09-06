# PowerBlind+ Makefile
# Usage: make <target>

.PHONY: help install dev dev-api dev-web dev-ml \
        db-migrate db-seed db-reset \
        test test-watch \
        build docker-build docker-up docker-down docker-logs \
        train clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2}'

# ── Local dev ─────────────────────────────────────────────────────────────────

install: ## Install all npm dependencies
	npm install

dev: ## Start all services in parallel (requires tmux or run separately)
	@echo "Start each in its own terminal:"
	@echo "  make dev-api"
	@echo "  make dev-web"
	@echo "  make dev-ml"

dev-api: ## Start Express API on :4000
	npm run dev:api

dev-web: ## Start Vite frontend on :5173
	npm run dev:web

dev-ml: ## Start FastAPI ML service on :8000
	cd services/ml && \
	  ([ -d .venv ] || python3 -m venv .venv) && \
	  . .venv/bin/activate && \
	  pip install -r requirements.txt -q && \
	  python main.py

# ── Database ──────────────────────────────────────────────────────────────────

db-migrate: ## Run Prisma migrations (creates DB if needed)
	npm run db:migrate

db-seed: ## Seed the DB with dataset + default admin
	npm run db:seed

db-reset: ## Drop DB, remigrate, reseed (destructive!)
	npm run db:reset

# ── Tests ─────────────────────────────────────────────────────────────────────

test: ## Run all API integration tests
	npm test -w apps/api

test-watch: ## Run tests in watch mode
	npm run test:watch -w apps/api

# ── ML Training ───────────────────────────────────────────────────────────────

train: ## Train the XGBoost model (requires dataset in data/)
	cd services/ml && \
	  . .venv/bin/activate && \
	  python -m training.train \
	    --readings ../../data/powerblind_smartmeter_readings.csv \
	    --labels   ../../data/powerblind_consumer_labels.csv \
	    --out      models/ \
	    --n_splits 5

train-quick: ## Train with 3 folds (faster, for testing)
	cd services/ml && \
	  . .venv/bin/activate && \
	  python -m training.train --n_splits 3

# ── Docker ────────────────────────────────────────────────────────────────────

build: ## Build all Docker images
	docker compose build

docker-up: ## Start full stack in Docker (dev mode)
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

docker-prod: ## Start full stack in Docker (production mode)
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

docker-migrate: ## Run DB migration + seed inside Docker
	docker compose --profile migrate up migrate

docker-down: ## Stop all Docker services
	docker compose down

docker-logs: ## Follow logs from all services
	docker compose logs -f

docker-shell-api: ## Open shell in running API container
	docker compose exec api sh

docker-shell-ml: ## Open shell in running ML container
	docker compose exec ml bash

# ── Build & clean ─────────────────────────────────────────────────────────────

build-web: ## Build the React app for production
	npm run build -w apps/web

clean: ## Remove build artifacts and node_modules
	rm -rf apps/web/dist
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	find . -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true
