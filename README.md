<div align="center">

# R I F T
### Local-First AI Agent Incident Investigation & Observability Platform

> *"Between what agents intend and what they do."*

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Python: 3.12+](https://img.shields.io/badge/Python-3.12+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![React: 19](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Engine: Google Gemma](https://img.shields.io/badge/AI%20Engine-Google%20Gemma%204%20%2F%202-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev/gemma)
[![Tests: 101 Passed](https://img.shields.io/badge/Tests-101%2F101%20Passing-brightgreen.svg)](docs/FINAL_VERIFICATION.md)
[![Evaluation: 100% Precision](https://img.shields.io/badge/Eval%20Precision-100%25-success.svg)](ai_eval_report.json)
[![Codebase Knowledge: Graphify](https://img.shields.io/badge/AST%20Ground%20Truth-Graphify-orange.svg)](docs/GRAPHIFY_INTEGRATION.md)

<br/>

[Overview](#-overview) •
[Why RIFT?](#-the-problem-why-rift) •
[Architecture](#-system-architecture) •
[Key Subsystems](#-core-subsystems) •
[Benchmarks & Evaluation](#-benchmarks--evaluation-suite) •
[Quickstart](#-quickstart--installation) •
[Interactive Demo](#-end-to-end-demo-workflow) •
[Security Model](#-security--sandboxing-architecture) •
[Documentation](#-documentation-index)

<br/>

</div>

---

## 🌟 Overview

**RIFT** is a local-first, forensic incident investigation and observability platform engineered specifically for **autonomous AI software agents**. 

When modern AI coding agents (Devin, Claude Code, Cursor Composer, AutoGPT, SWE-agent) interact with filesystems, terminals, databases, and developer tools, their failures rarely resemble traditional software exceptions. Agents can delete vital source files while assuming they are temporary artifacts, enter infinite retry loops, hallucinate success despite failing builds, or silently trigger catastrophic regressions across downstream codebases.

RIFT bridges the gap between **agent intent** and **runtime reality** through a unified engineering pipeline:

1. **High-Density Execution Graph & Timeline**: Reconstructs execution traces into an interactive Directed Acyclic Graph (DAG) with tri-directional synchronized inspection.
2. **Deterministic Incident Detection**: High-speed, rule-based detector (8 core rules) operating with 0% false positives and zero LLM hallucination risk.
3. **Google Gemma Forensic Investigation**: Local-first inference using Google Gemma models via Ollama to generate multi-hypothesis causal post-mortems with 100% verified trace citations.
4. **AST Codebase Knowledge & Blast Radius (Graphify)**: Extracts code syntax trees and call hierarchies with zero external API costs to map the exact blast radius of destructive agent actions.
5. **Counterfactual Replay Lab**: Containerized, dual-isolated sandbox executing typed filesystem mutations to reproduce failures and cryptographically verify developer fixes.
6. **Executive Incident Post-Mortems**: Single-click export of engineering post-mortems in GitHub-Flavored Markdown and machine-readable JSON.

---

## ⚡ The Problem: Why RIFT?

Traditional Application Performance Monitoring (APM) tools (Datadog, Sentry, New Relic) are built for deterministic client-server architectures with static stack traces. **They fail completely when monitoring autonomous agents.**

```text
Traditional APM Lens               RIFT Forensic Lens
────────────────────               ──────────────────
HTTP 200 OK                   vs   Agent hallucinated success after deleting production configuration
Exit Code 0                   vs   Agent bypassed broken test assertions by modifying test files
Span: tool_call(delete_file)  vs   Causal chain: User prompt asked for "cleanup" -> Agent misidentified 
                                   src/config.ts as temp cache -> Build broke -> Agent lied about passing
```

### Critical Agent Failure Modes Caught by RIFT

| Failure Mode | Autonomous Agent Symptom | RIFT Resolution |
| :--- | :--- | :--- |
| **False Success Claim** | Agent reports `"All tasks completed successfully!"` despite build failing with exit code 1. | **RULE-006** detects contradiction between validation exit code and final agent response. |
| **Unsafe Deletion** | Agent executes `delete_file` or `rm` on vital source files outside its declared workspace scope. | **RULE-001** validates file paths against canonical path bounds and protected directory policies. |
| **Silent Blast Radius** | Agent modifies a core utility function, silently breaking 14 downstream modules. | **Graphify AST Engine** calculates incoming reverse dependencies to pinpoint impacted files before deployment. |
| **Infinite Retry Loop** | Agent hammers an API or tool with identical failing arguments 5+ times in a row. | **RULE-005** detects failure loops exceeding configurable thresholds and halts the run. |
| **Path Traversal / Escape**| Agent attempts `../../secrets.env` or symlink redirection to read host files. | **RULE-001 & Security Sandbox** reject relative paths, path traversal, and symlink escapes. |
| **Missing Validation** | Agent performs destructive file changes and immediately concludes without testing. | **RULE-007** flags unverified destructive operations. |

---

## 🏗️ System Architecture

RIFT is organized into a modular, decoupled local-first architecture:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 RIFT DASHBOARD (React 19)                              │
│                                                                                        │
│  ┌───────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │  Investigation Space  │  │   Code Impact Explorer  │  │   Counterfactual Lab    │  │
│  │  - React Flow DAG     │  │   - Graphify AST Graph   │  │   - Diff Viewer         │  │
│  │  - Tri-Sync Timeline  │  │   - Blast Radius Radar   │  │   - Security Preview    │  │
│  │  - Evidence Inspector │  │   - In-Situ Code Preview │  │   - Verification Matrix │  │
│  └───────────┬───────────┘  └────────────┬────────────┘  └────────────┬────────────┘  │
└──────────────┼───────────────────────────┼────────────────────────────┼────────────────┘
               │ HTTP / SSE                │ REST                       │ WebSocket / REST
┌──────────────▼───────────────────────────▼────────────────────────────▼────────────────┐
│                                FASTAPI BACKEND SERVICE                                 │
│                                                                                        │
│  ┌────────────────────────────┐  ┌────────────────────────────┐  ┌──────────────────┐  │
│  │ Ingestion & Normalization  │  │ Deterministic Rule Engine  │  │ Incident Service │  │
│  │ - OpenTelemetry / OTLP     │  │ - 8 Zero-False-Alarm Rules │  │ - Correlation    │  │
│  │ - Credential Redaction     │  │ - Earliest Event Selector  │  │ - SQLite Storage │  │
│  └─────────────┬──────────────┘  └─────────────┬──────────────┘  └────────┬─────────┘  │
│                │                               │                          │            │
│  ┌─────────────▼──────────────┐  ┌─────────────▼──────────────┐  ┌────────▼─────────┐  │
│  │ CodeKnowledgeAdapter       │  │ Gemma AI Forensics         │  │ Replay Sandbox   │  │
│  │ - Tree-sitter AST Parsers  │  │ - Untrusted Data Barrier   │  │ - Dual Container │  │
│  │ - Reverse AST Graph Traversal│ │ - Pydantic v2 Schema Guard │  │ - SHA-256 Hashes │  │
│  │ - Zero API Cost Ground Truth│ │ - Immutable Span Citations │  │ - Fail-Closed    │  │
│  └─────────────┬──────────────┘  └─────────────┬──────────────┘  └────────┬─────────┘  │
└────────────────┼───────────────────────────────┼──────────────────────────┼────────────┘
                 │                               │                          │
                 ▼                               ▼                          ▼
     ┌───────────────────────┐       ┌───────────────────────┐  ┌───────────────────────┐
     │  graphify-out/        │       │  OLLAMA (Local)       │  │  DOCKER WORKER        │
     │  - 1,254 AST Nodes    │       │  - Google Gemma 4     │  │  - rift-replay-worker │
     │  - 3,532 Syntax Edges │       │  - Google Gemma 2     │  │  - Non-root 10001     │
     │  - 72 Code Clusters   │       │  - 0 Tokens Leaked    │  │  - Offline Network    │
     └───────────────────────┘       └───────────────────────┘  └───────────────────────┘
```

---

## 🔬 Core Subsystems

### 1. Ingestion & Trace Normalization (`apps/api/app/services/trace_service.py`)
- Ingests traces from the lightweight Python `rift_sdk`, OpenTelemetry OTLP collectors, or raw JSON fixtures.
- Canonicalizes execution spans into typed categories: `user_prompt`, `agent_plan`, `model_call`, `tool_call`, `tool_result`, `validation`, and `error`.
- Performs **automated credential scrubbing** (redacting API keys, bearer tokens, AWS credentials, and SSH keys before storage).

### 2. Deterministic Incident Detection Engine (`apps/api/app/services/detection/`)
Operates directly on normalized execution DAGs with zero LLM query dependencies:
- **`RULE-001` Unsafe File Deletion**: Catches deletion operations escaping workspace root or targeting critical paths.
- **`RULE-002` Protected File Modification**: Flags modification attempts against protected manifests (`package.json`, `.env`, `tsconfig.json`).
- **`RULE-003` Invalid Tool Arguments**: Rejects tool invocations with empty paths, missing parameters, or invalid schemas.
- **`RULE-004` Failed Tool Execution**: Captures tool exceptions, nonzero exit codes, and OS permission errors (`EACCES`).
- **`RULE-005` Repeated Failure Loop**: Flags consecutive repeated failures exceeding configured iteration limits.
- **`RULE-006` False Success Reporting**: Identifies instances where an agent claims operational success despite failing checks.
- **`RULE-007` Missing Post-Operation Validation**: Detects destructive modifications executed without accompanying regression tests.
- **`RULE-008` Unexpected Filesystem State Change**: Detects unauthorized file additions or hash drifts between pre/post manifests.

### 3. Interactive Investigation Workspace (`apps/web/src/features/investigation/`)
- **Execution DAG Graph**: High-performance React Flow canvas rendering hierarchical execution trees with semantic color schemes.
- **Tri-Directional Synchronized Navigation**: Clicking an event in the Timeline automatically expands parent spans, pans to the Graph Node, populates the Evidence Inspector, and synchronizes the URL query (`?event=span-id`).
- **Focus Execution Path Mode**: Instantly isolates the critical causal chain leading directly to the incident while dimming unrelated background operations.
- **Intent vs. Execution Diff**: Side-by-side comparison contrasting what the user requested against what the agent actually invoked.
- **Keyboard Shortcuts**: Power navigation (`F` to fit view, `P` to toggle focus path, `T` for timeline, `I` for inspector, `Esc` to clear).

### 4. Google Gemma Forensic Investigation Subsystem (`apps/api/app/services/ai/`)
Powered exclusively by local Google Gemma models (`gemma4:e2b` / `gemma2:9b`) via Ollama:
- **Untrusted Prompt-Injection Barrier**: Isolates raw agent traces inside `<untrusted_trace_data>` tags, preventing malicious prompt injections embedded in target code from hijacking the forensic analysis.
- **Token Budget Allocation**: Intelligently trims verbose outputs and prioritizes critical parent spans and anomalous events to fit local context windows.
- **Strict Pydantic v2 Output Enforcement**: Guarantees JSON schema conformance with multi-hypothesis causal pathways, confidence ratings, and actionable remediations.
- **Deterministic Citation Verification**: Cross-references every cited `supporting_event_ids` and `contradicting_event_ids` against immutable trace spans. **Phantom or hallucinated citations are rejected with 0.0% tolerance.**

### 5. AST Codebase Knowledge & Blast Radius Explorer (`docs/GRAPHIFY_INTEGRATION.md`)
Integrated with **Graphify** to provide zero-API-cost static codebase ground truth:
- **AST Dependency Graph**: Generates 1,254 code nodes, 3,532 syntactic edges, and 72 Louvain community clusters in ~2 seconds.
- **Reverse Dependency Traversal**: Inverts abstract syntax trees to compute direct (Depth 1) and transitive (Depth 2+) blast radii for any modified, deleted, or created file.
- **In-Situ Source Code Preview**: Interactive code inspector with path traversal protection, syntax highlighting, and provenance classification (`EXTRACTED` vs `INFERRED`).
- **AI Context Enrichment**: Injects exact code impact metrics directly into Gemma's forensic investigation prompts.

### 6. Counterfactual Replay Lab (`apps/api/app/services/replay/`)
Enables engineers to verify whether proposed fixes truly resolve agent failures without causing regressions:
- **17-Step Verification Lifecycle**: Dual independent disposable sandboxes initialized with identical SHA-256 snapshot hashes.
- **Typed Operations**: Restricts mutations to audited operations (`delete_file`, `write_file`, `move_file`, `run_validation`).
- **Strict Security Guardrails**: Prohibits root execution (`UID:GID 10001:10001`), enforces offline networking (`network_mode="none"`), and blocks path traversal.
- **Comparative Differential Engine**: Side-by-side filesystem diffs highlighting added, removed, and modified files between the original failure and counterfactual correction.

---

## 📊 Benchmarks & Evaluation Suite

RIFT's deterministic detector and Gemma AI investigation subsystems were evaluated across **11 ground-truth incident fixtures** representing real-world failure patterns.

All evaluation runs are automated via `scripts/evaluate_detection.py` and `scripts/evaluate_gemma_investigation.py`.

### Quantitative Evaluation Summary

| Subsystem Metric | Target Standard | RIFT Verified Result | Status |
| :--- | :--- | :--- | :--- |
| **Deterministic Rule Precision** | 100.0% | **100.0%** (16/16 TP, 0 FP) | **PASS** |
| **Deterministic Rule Recall** | 100.0% | **100.0%** (16/16 TP, 0 FN) | **PASS** |
| **First Suspicious Event Accuracy** | 100.0% | **100.0%** (10/10 matched) | **PASS** |
| **Structured JSON Schema Validity** | 100.0% | **100.0%** (11/11 valid) | **PASS** |
| **Evidence Citation Validity Rate** | > 95.0% | **100.0%** (0 phantom citations) | **PASS** |
| **Unsupported Claim Rate** | 0.0% | **0.0%** (0 hallucinated claims) | **PASS** |
| **FastAPI Backend Pytest Suite** | 100% Pass | **62 / 62 Tests Passing** (0.50s) | **PASS** |
| **React Frontend Vitest Suite** | 100% Pass | **29 / 29 Tests Passing** (0.95s) | **PASS** |
| **Playwright E2E Integration Suite** | 100% Pass | **10 / 10 Tests Passing** (8.40s) | **PASS** |

### Benchmark Fixture Matrix

```text
==========================================================================================================
FIXTURE NAME                   TRACE ID                   INCIDENT CLASS             EARLIEST EVENT  MATCH
==========================================================================================================
accidental-deletion.json       trace-accidental-del-001   Destructive File Deletion  span-demo-006   EXACT
path-traversal.json            trace-path-traversal-002   Sandbox Escape             span-pt-003     EXACT
protected-overwrite.json       trace-protected-over-003   Root Overwrite             span-po-003     EXACT
repeated-tool-failure.json     trace-repeated-fail-004    Infinite Retry Loop        span-rtf-002    EXACT
invalid-tool-arguments.json    trace-invalid-args-005     Invalid Schema / Missing   span-ita-002    EXACT
false-success.json             trace-false-success-006    False Success Claim        span-fs-002     EXACT
missing-validation.json        trace-missing-val-007      Missing Post-Op Validation span-mv-003     EXACT
unexpected-file-change.json    trace-unexpected-fc-008    Unauthorized State Drift   span-ufc-002    EXACT
failed-permission.json         trace-failed-perm-009      OS EACCES Permission Deny  span-fp-002     EXACT
incomplete-trace.json          trace-incomplete-010       Premature Termination      span-inc-002    EXACT
clean-run-positive.json        trace-clean-positive-011   Clean Control Run (Benign) None (Clean)    EXACT
==========================================================================================================
```

### Deterministic Detection Alone vs. Deterministic + Gemma AI

```
┌─────────────────────────────────┬───────────────────────────────┬────────────────────────────────┐
│ Dimension                       │ Deterministic Rules Alone     │ Deterministic + Gemma AI       │
├─────────────────────────────────┼───────────────────────────────┼────────────────────────────────┤
│ Speed                           │ Instantaneous (< 5ms)         │ Sub-minute (~24s local Gemma)  │
│ Blast Radius & Explanations     │ Flags triggering span ID only │ Synthesizes full causal story  │
│ Semantic Intent Discrepancy     │ Hard policy violations only   │ Compares user prompt vs action │
│ Remediation Proposals           │ Static alert message          │ Context-aware, human-vetted fix│
│ Evidence Grounding              │ Single rule assertion         │ Multi-span cited DAG pathway   │
└─────────────────────────────────┴───────────────────────────────┴────────────────────────────────┘
```

---

## 🚀 Quickstart & Installation

### Prerequisites
- **Python**: 3.12+ (managed with `uv` recommended)
- **Node.js**: 20+ (with `npm`)
- **Ollama**: [Download Ollama](https://ollama.com) (for local Gemma 4 / Gemma 2 inference)
- **Docker**: (Optional, required for isolated counterfactual container replay)

### 1. Clone & Configure Environment

```bash
git clone https://github.com/CoderOggy78/RIFT.git
cd RIFT

# Copy environment variables template
cp .env.example .env
```

### 2. Backend Setup (FastAPI)

```bash
cd apps/api

# Create and activate virtual environment
uv venv --python 3.12
source .venv/bin/activate

# Install dependencies in editable mode
uv pip install -e .

# Run SQLite migrations
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*API Swagger Documentation is available at `http://localhost:8000/docs`.*

### 3. Frontend Setup (React 19)

In a new terminal window:
```bash
cd apps/web
npm install
npm run dev
```
*Web Dashboard is accessible at `http://localhost:5173`.*

### 4. Setup Local Google Gemma Inference (Recommended)

RIFT runs completely local without leaking prompts or telemetry to external cloud providers:
```bash
# Start Ollama service
ollama serve

# Pull Google Gemma 4 or Gemma 2
ollama pull gemma4:e2b
# OR
ollama pull gemma2:9b
```
Visit `http://localhost:5173/settings` to verify your Ollama connection and probe round-trip latency.

### 5. Build Replay Sandbox Worker (Optional)

```bash
docker build -t rift-replay-worker:latest -f workers/replay/Dockerfile .
```
*(Note: If Docker is offline, RIFT enforces a safe fail-closed policy, cleanly marking replay as `offline/protected` without crashing).*

---

## 🎬 End-to-End Demo Workflow

Experience RIFT's full capabilities with a single automated command:

```bash
make demo
```

The automated launcher executes the complete verification lifecycle:
1. **Subsystem Probing**: Verifies FastAPI backend, React frontend, Ollama, Gemma models, and Docker daemon.
2. **Database Verification**: Validates SQLite schema and tables.
3. **Trace Ingestion**: Ingests the realistic `accidental-deletion.json` incident trace.
4. **Deterministic Detection**: Evaluates 9 execution spans, isolating the unsafe deletion of `src/config.ts` and false success claim.
5. **Interactive Navigation**: Outputs direct deep-links into the Investigation Workspace (`http://localhost:5173/investigations/trace-accidental-deletion-001`).
6. **Gemma AI Forensics**: Provides terminal guidance to trigger live Gemma 4 inference and inspect generated causal hypotheses.
7. **Counterfactual Replay**: Step-by-step instructions to preview and execute sandboxed counterfactual verification.

### Makefile Commands Cheatsheet

```bash
make help        # Display all available platform commands
make demo        # Run automated end-to-end demo verification workflow
make start       # Concurrently launch both FastAPI backend and React frontend
make test        # Run Pytest, Vitest, and Playwright test suites (101 tests)
make test-api    # Run backend pytest suite (62 tests)
make test-web    # Run frontend vitest suite (29 tests)
make test-e2e    # Run Playwright end-to-end browser tests (10 tests)
make build       # Compile optimized production React bundle
```

---

## 🔒 Security & Sandboxing Architecture

RIFT incorporates a defense-in-depth security model to safely inspect untrusted agents:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEFENSE-IN-DEPTH MODEL                          │
├──────────────────────────┬─────────────────────────────────────────────┤
│ Prompt Injection Barrier │ Encapsulates all agent logs inside          │
│                          │ <untrusted_trace_data> tags; strict Pydantic│
│                          │ JSON schema guarantees structure.           │
├──────────────────────────┼─────────────────────────────────────────────┤
│ Container Isolation      │ Replay runs inside disposable containers    │
│                          │ with non-root user (10001:10001).           │
├──────────────────────────┼─────────────────────────────────────────────┤
│ Network Lockdown         │ Containers execute with network_mode="none" │
│                          │ to prevent data exfiltration.               │
├──────────────────────────┼─────────────────────────────────────────────┤
│ Path Confinement         │ All file operations validated against real  │
│                          │ workspace root; blocks symlink & ../ escape.│
├──────────────────────────┼─────────────────────────────────────────────┤
│ Human-in-the-Loop        │ Every counterfactual replay and remediation │
│                          │ requires explicit human approval modal.     │
├──────────────────────────┼─────────────────────────────────────────────┤
│ Credential Redaction     │ Sensitive tokens and keys automatically     │
│                          │ scrubbed before database persistence.       │
└──────────────────────────┴─────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```text
RIFT/
├── apps/
│   ├── api/                           # FastAPI Backend Service (Python 3.12)
│   │   ├── app/
│   │   │   ├── api/routes/            # REST API Routes (traces, incidents, replay, etc.)
│   │   │   ├── models/                # SQLAlchemy 2.0 ORM Models
│   │   │   ├── services/
│   │   │   │   ├── ai/                # Gemma Forensic Engine (prompt, budget, output)
│   │   │   │   ├── code_knowledge/    # Graphify AST Adapter & Blast Radius Traversal
│   │   │   │   ├── detection/         # Deterministic Rule Engine (8 Rules + Registry)
│   │   │   │   └── replay/            # Counterfactual Orchestrator & Sandbox Manager
│   │   │   └── main.py                # FastAPI Application Entrypoint
│   │   ├── pyproject.toml             # Python Dependency & Build Configuration
│   │   └── tests/                     # 62 Pytest Backend Unit & Integration Tests
│   │
│   └── web/                           # React 19 Frontend Application (TypeScript + Vite)
│       ├── src/
│       │   ├── components/            # Reusable UI (Badges, DiffViewer, KnowledgeGraph)
│       │   ├── features/investigation/# Execution Graph, Tri-Sync Timeline, Inspector
│       │   ├── pages/                 # Route Pages (Overview, Incidents, Replay, Graphify)
│       │   └── tests/                 # 29 Vitest Component Tests
│       ├── e2e/                       # 10 Playwright End-to-End Browser Tests
│       └── package.json               # Frontend Dependencies & Scripts
│
├── packages/
│   └── rift_sdk/                      # Lightweight Python Tracing SDK for AI Agents
│
├── workers/
│   └── replay/                        # Dedicated Containerized Replay Worker
│       ├── operations/                # Typed Operations (delete_file, write_file, etc.)
│       ├── validators/                # Deterministic Invariant Checkers
│       └── Dockerfile                 # Hardened Non-Root Container Definition
│
├── fixtures/
│   ├── incidents/                     # 11 Ground-Truth Incident Execution Traces
│   └── replay/                        # Cryptographic Fixture Snapshots (SHA-256)
│
├── docs/                              # Comprehensive Technical Documentation
│   ├── FINAL_VERIFICATION.md          # 101-Test Verification & Delivery Report
│   ├── GEMMA_INVESTIGATION.md         # Gemma AI Subsystem & Prompt Engineering
│   ├── GRAPHIFY_INTEGRATION.md        # Static AST Codebase Knowledge Architecture
│   ├── DETECTION_ENGINE.md            # Deterministic Rule Engine Specification
│   ├── INVESTIGATION_WORKSPACE.md     # Tri-Directional DAG Graph Architecture
│   ├── COUNTERFACTUAL_REPLAY.md       # Replay Lifecycle & Verification Philosophy
│   └── REPLAY_SECURITY.md             # Threat Modeling & Sandbox Hardening
│
├── scripts/
│   ├── demo_launcher.py               # Automated End-to-End Demo Launcher
│   ├── evaluate_detection.py          # Deterministic Detection Evaluation Harness
│   ├── evaluate_gemma_investigation.py# Gemma AI Forensic Benchmark Harness
│   └── import_demo_trace.py           # Seed Trace Importer
│
├── Makefile                           # Developer Automation Commands
├── docker-compose.yml                 # Multi-Service Local Container Orchestration
└── README.md                          # Platform Presentation & Architecture Guide
```

---

## 📚 Documentation Index

For deep dives into RIFT's technical designs and security guarantees:

- [Final Verification & Delivery Report (`FINAL_VERIFICATION.md`)](docs/FINAL_VERIFICATION.md) — 101/101 test results and hardware benchmarks.
- [Gemma AI Forensics Guide (`GEMMA_INVESTIGATION.md`)](docs/GEMMA_INVESTIGATION.md) — Prompt engineering, token budgeting, and citation validation.
- [Graphify Codebase Knowledge (`GRAPHIFY_INTEGRATION.md`)](docs/GRAPHIFY_INTEGRATION.md) — AST parsing, reverse dependencies, and blast radius calculation.
- [Deterministic Detection Rules (`DETECTION_ENGINE.md`)](docs/DETECTION_ENGINE.md) — Formal specification for all 8 detection rules.
- [Investigation Workspace (`INVESTIGATION_WORKSPACE.md`)](docs/INVESTIGATION_WORKSPACE.md) — React Flow DAG graph, tri-directional sync, and focus paths.
- [Counterfactual Replay Lab (`COUNTERFACTUAL_REPLAY.md`)](docs/COUNTERFACTUAL_REPLAY.md) — 17-step verification lifecycle and outcome classification.
- [Replay Security & Sandboxing (`REPLAY_SECURITY.md`)](docs/REPLAY_SECURITY.md) — Container hardening, non-root execution, and threat mitigations.
- [Model Configuration Guide (`MODEL_CONFIGURATION.md`)](docs/MODEL_CONFIGURATION.md) — Setting up Gemma 4 and Gemma 2 via Ollama.

---

## ⚖️ License

RIFT is open-source software licensed under the **[Apache License, Version 2.0](LICENSE)**.

---

<div align="center">
  <sub>Built with Google Gemma, React 19, FastAPI, and Graphify. Designed for resilient, trustworthy AI agent engineering.</sub>
</div>
