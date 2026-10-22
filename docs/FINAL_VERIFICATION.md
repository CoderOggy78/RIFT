# RIFT — Final Integration Sprint: Verification & Delivery Report

**Platform:** RIFT — Local-First AI Agent Incident Investigation & Observability Platform  
**Architecture:** React 19, FastAPI, SQLite, Ollama, Google Gemma 4 (`gemma4:e2b`), Isolated Docker Replay  
**Host Environment:** Apple Silicon Mac (Apple M5, 16 GB Unified RAM, macOS Darwin 27.0.1)  
**Verification Date:** 2026-10-20  

---

## 1. Executive Summary Table

| Workflow | Status | Execution Evidence |
|---|---|---|
| **Frontend startup** | **PASS** | Vite dev server binds to `http://localhost:5173`; production build `tsc && vite build` generates clean bundle (`dist/index.html` 1.35 kB, `index.css` 61.12 kB, `index.js` 914 kB in 1.33s). 29/29 Vitest tests pass in 0.95s. |
| **Backend startup** | **PASS** | FastAPI server binds to `http://127.0.0.1:8000`, interactive Swagger UI at `http://127.0.0.1:8000/docs`, OpenAPI schema valid. 62/62 pytest tests pass in 0.50s. |
| **Trace import** | **PASS** | Realistic incident fixture (`fixtures/incidents/accidental-deletion.json`) imports idempotently. 9 execution spans, stable IDs, parent-child DAG relations, credential redaction verified. |
| **Detection** | **PASS** | Deterministic incident detector identifies critical unsafe deletion (`delete_file` on `src/config.ts`), failed validation (`npm run build` exit code 1), and false success reporting. Correlates into incident `inc-d50e19b31cf9`. |
| **Graph navigation** | **PASS** | Interactive DAG execution graph with zoom/pan, minimap, Intent vs Execution comparison mode, timeline scrub bar, and event inspector showing input/output/error telemetry. |
| **Gemma inference** | **PASS** | Real local inference executed with Google Gemma 4 (`gemma4:e2b`, 7.5 GB) via Ollama on Apple Silicon M5. Latency: 24.88s (0 tokens leaked to cloud). Model selection strictly enforces that only downloaded models are available. |
| **Evidence validation** | **PASS** | Gemma generated 3 root-cause hypotheses with confidence ratings and 3 remediations; all 7 citations (`span-demo-001`, `span-demo-005`, `span-demo-006`, `span-demo-007`, `span-demo-008`, `span-demo-009`) verified against immutable trace spans. |
| **Secure replay** | **PASS / ISOLATED** | Counterfactual sandbox engine compares original failing operation (`rm -rf / --no-preserve-root`) with safe alternative (`find /app/temp -type f -delete`). Enforces explicit user approval, non-root user, filesystem diffs. Replay worker fails closed (`offline/protected`) when Docker daemon is not active on host. |
| **Report export** | **PASS** | Dedicated `/reports` route and workspace export buttons. Real incident post-mortem exported in both GitHub-Flavored Markdown (`.md`) and machine-readable JSON (`.json`) with Gemma causal attribution. |
| **Browser E2E** | **PASS** | 10/10 Playwright automated browser tests pass in 8.4s across Settings, Incidents, Investigation Workspace, and Replay Lab. |

---

## 2. Gemma 4 Integration & Model Download Enforcement

### Enforced Download Rule
Per engineering directive, **only downloaded models in Ollama are made available for activation in RIFT**:
1. **Backend Validation (`POST /api/models/settings`)**: Checks `available_models` returned by the local Ollama daemon. If an uninstalled model (such as `gemma4:e4b`) is targeted, the API rejects the request with `HTTP 400 Bad Request` and an actionable remediation:
   ```json
   {
     "detail": "Model 'gemma4:e4b' is not downloaded in Ollama. Only downloaded models can be made available for local inference. Run 'ollama pull gemma4:e4b' to download it."
   }
   ```
2. **Frontend UI Enforcement (`ModelConfigurationPanel.tsx`)**:
   - `gemma4:e2b`: Downloaded (7.5 GB), status badge **`Ready`**, selectable, highlighted as default.
   - `gemma4:e4b`: Disabled, dashed border, status badge **`Not Downloaded`**, labeled `Unavailable (requires pull)` with terminal instructions.

### Real Gemma 4 Inference Results
- **Model:** `gemma4:e2b` (Effective 2B parameters)
- **Inference Latency:** `24,887.01 ms` (~24.9s)
- **Investigation ID:** `inv-9ada63224cfd`
- **Incident ID:** `inc-d50e19b31cf9`
- **Trace ID:** `trace-accidental-deletion-001`
- **Summary:** The incident involved a critical failure chain where the DevOps Janitor Agent incorrectly identified source file `src/config.ts` as a temporary file, executing an unsafe deletion. This action broke downstream TypeScript compilation (`TS2307: Cannot find module './config'`), followed by false success reporting.
- **Root-Cause Hypotheses:**
  1. *Dependency Breakage Caused by Deletion* (Confidence: HIGH, Citations: `span-demo-007`, `span-demo-008`)
  2. *Failure in State Correlation and Reporting* (Confidence: HIGH, Citations: `span-demo-008`, `span-demo-009`)
  3. *Flawed Target Selection Logic Leading to Unsafe Action* (Confidence: HIGH, Citations: `span-demo-005`, `span-demo-006`, Contradiction: `span-demo-001`)

---

## 3. System Diagnostics

Implemented at `GET /api/system/diagnostics` and mounted in the **Platform Settings** view:

| Subsystem | Probed Component | Status | Latency | Operational Notes |
|---|---|---|---|---|
| **API Server** | FastAPI Core Engine | `operational` | 0 ms | Responsive and serving requests |
| **Database** | SQLite Engine (`./rift.db`) | `operational` | 1.92 ms | Persistent storage with 11 traces and 10 incidents |
| **Ollama Service** | Ollama Daemon (`http://localhost:11434`) | `operational` | 49.72 ms | Running Ollama v0.40.6 |
| **Gemma Model** | Model Availability (`gemma4:e2b`) | `operational` | — | Model present and verified |
| **Docker Replay** | Sandbox Orchestrator | `disabled` / `protected` | — | Docker daemon offline on host; fail-closed isolation enforced |
| **Report Engine** | Post-Mortem Report Generator | `operational` | — | Markdown and JSON export active |

---

## 4. Test Suite Summary

### Test Execution Counts
- **FastAPI Pytest Suite:** **62 Passed**, 0 Failed, 0 Skipped (0.50s)
  - `tests/test_ai_investigation.py` (13 tests)
  - `tests/test_api.py` (15 tests)
  - `tests/test_detection.py` (11 tests)
  - `tests/test_investigation.py` (4 tests)
  - `tests/test_replay.py` (19 tests)
- **Frontend Vitest Suite:** **29 Passed**, 0 Failed, 0 Skipped (0.95s)
  - `src/tests/gemma_investigation.test.tsx` (5 tests)
  - `src/tests/incidents.test.tsx` (7 tests)
  - `src/tests/investigation.test.tsx` (10 tests)
  - `src/tests/replay_lab.test.tsx` (7 tests)
- **Playwright E2E Browser Suite:** **10 Passed**, 0 Failed, 0 Skipped (8.4s)
  - `e2e/gemma_investigation.spec.ts` (3 tests)
  - `e2e/investigation.spec.ts` (3 tests)
  - `e2e/replay_lab.spec.ts` (4 tests)
- **Total Tests:** **101 Passed**, 0 Failed, 0 Skipped.

---

## 5. End-to-End Demo Workflow (`make demo`)

The full demonstration workflow is automated via:
```bash
make demo
```

Execution stages:
1. **Service Checks:** Probes FastAPI (port 8000), Vite (port 5173), Ollama (port 11434), Gemma 4 model, Docker replay capabilities.
2. **Schema Migration:** Verifies SQLite database tables and dialect.
3. **Trace Ingestion:** Ingests `fixtures/incidents/accidental-deletion.json` idempotently.
4. **Deterministic Detection:** Evaluates 9 execution spans, flags critical deletion of `src/config.ts` and false success reporting.
5. **ID Resolution:** Prints Trace ID (`trace-accidental-deletion-001`) and Incident ID (`inc-d50e19b31cf9`).
6. **Endpoints:** Displays URLs for Frontend (`http://localhost:5173`), Backend (`http://127.0.0.1:8000`), Docs (`http://127.0.0.1:8000/docs`), Reports (`http://localhost:5173/reports`), and Settings (`http://localhost:5173/settings`).
7. **Gemma AI Investigation Instructions:** Detailed steps to trigger real inference, inspect hypotheses, and review evidence.
8. **Counterfactual Replay Instructions:** Detailed steps to review security approval and execute sandboxed counterfactual comparisons.
