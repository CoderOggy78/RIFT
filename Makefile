.PHONY: demo test test-api test-web build start start-api start-web lint install clean help

help:
	@echo "RIFT Platform Commands:"
	@echo "  make demo        - Run end-to-end demo verification workflow"
	@echo "  make test        - Run all backend and frontend tests"
	@echo "  make test-api    - Run FastAPI backend pytest suite (62 tests)"
	@echo "  make test-web    - Run React frontend Vitest suite (29 tests)"
	@echo "  make build       - Build production frontend bundle"
	@echo "  make start       - Start both backend and frontend servers"
	@echo "  make start-api   - Start FastAPI backend on http://localhost:8000"
	@echo "  make start-web   - Start React frontend on http://localhost:5173"

demo:
	python3 scripts/demo_launcher.py

test-api:
	cd apps/api && source .venv/bin/activate && pytest

test-web:
	cd apps/web && npm run test

test-e2e:
	cd apps/web && npx playwright test

test: test-api test-web test-e2e

build:
	cd apps/web && npm run build

start-api:
	cd apps/api && source .venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

start-web:
	cd apps/web && npm run dev

start:
	@echo "Starting RIFT backend and frontend..."
	@echo "Backend:  http://localhost:8000"
	@echo "Frontend: http://localhost:5173"
	@(trap 'kill 0' SIGINT; make start-api & make start-web & wait)
