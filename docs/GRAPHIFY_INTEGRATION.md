# RIFT × Graphify Codebase Knowledge & Impact Analysis Integration

## 1. Executive Summary & Philosophy

**RIFT Product Concept:**
> *"Between what agents intend and what they do."*

RIFT monitors, analyzes, and constrains autonomous AI agents operating on codebases and digital infrastructure. While RIFT's core telemetry engine records dynamic runtime traces (prompts, thought events, tool invocations, shell commands, and file mutations), **Graphify** adds a complementary **deterministic codebase ground truth**:

- **Dynamic Execution DAG:** Captures runtime intent, chronological telemetry spans, and actual execution behavior.
- **Static Codebase Knowledge Graph (Graphify):** Extracts abstract syntax trees (AST), symbol definitions, reverse dependencies, and call hierarchies via local Tree-sitter parsers with **zero vector embeddings and zero external API costs**.

By connecting static codebase structure to dynamic execution traces, RIFT can evaluate the blast radius of destructive agent mutations (e.g. `delete_file`, `write_file`) and supply Gemma/Ollama root-cause analysis engines with cited, verified dependency evidence.

---

## 2. Architecture & Design

```
+---------------------------------------------------------------------------------+
|                               RIFT DASHBOARD                                    |
|   +------------------------------------+   +---------------------------------+  |
|   | /graphify: Blast Radius Explorer   |   | /incidents/:id: Impact Summary  |  |
|   +------------------------------------+   +---------------------------------+  |
+----------------------------------------+----------------------------------------+
                                         | HTTP / REST
                                         v
+---------------------------------------------------------------------------------+
|                                FASTAPI BACKEND                                  |
|   [Endpoints: /api/knowledge/*, /api/incidents/{id}/code-impact]               |
|                                        |                                        |
|   +------------------------------------+------------------------------------+   |
|   |                  CodeKnowledgeAdapter (Singleton)                       |   |
|   |   - Status & Health Validation     - Bounded Subprocess Execution       |   |
|   |   - Direct JSON Query & Explain    - AST Reverse-Dependency Traversal  |   |
|   |   - Path & Symlink Traversal Guard - Provenance Grounding (AST vs INF)  |   |
|   +------------------------------------+------------------------------------+   |
+----------------------------------------+----------------------------------------+
         |                                                 |
         v                                                 v
+-----------------------------+              +-----------------------------+
|    graphify-out/graph.json  |              |    graphify CLI (0.9.92)    |
| - 1,254 Nodes               |              | - graphify update .         |
| - 3,532 Edges               |              | - graphify extract .        |
| - 72 Louvain Communities    |              | - Subprocess timeouts (30s) |
+-----------------------------+              +-----------------------------+
```

### Core Design Principles
1. **Preserve Existing Workflows:** Trace ingestion, rule-based detection, Gemma investigation, counterfactual replay, and report generation operate uninterrupted regardless of Graphify presence.
2. **Safe Fallbacks (Fail-Open):** If Graphify is uninstalled, disabled, or corrupt, endpoints return structured degraded status payloads (`status: "disabled"` or `"unavailable"`), never unhandled 500 crashes.
3. **AST Ground Truth (No Mocking in Production):** All node and edge relationships are grounded in actual extracted syntax. Relationships are strictly tagged with provenance metadata (`EXTRACTED` vs `INFERRED`).

---

## 3. Installation & Prerequisites

Graphify requires Python 3.10+ and standard build toolchains for Tree-sitter grammars.

### Installation via uv or pip
```bash
# Recommended: Install graphify via uv or pipx into user environment
pip install graphifyy

# Verify executable is present in PATH
which graphify
graphify --help
```

### Supported CLI Commands
- `graphify update .` — Incrementally updates the knowledge graph using local AST parsers in ~2 seconds (zero API tokens used).
- `graphify extract . --code-only` — Full fresh extraction of AST entities without semantic LLM summaries.
- `graphify query "<query>"` — Subgraph extraction for concept or symbol queries.
- `graphify explain "<symbol>"` — Node inspection with direct incident and outgoing edges.
- `graphify path "<nodeA>" "<nodeB>"` — Shortest dependency path traversal.

---

## 4. Configuration Reference

All settings are configured via environment variables or `.env` files loaded by `apps/api/app/config.py`:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ENABLE_CODEBASE_KNOWLEDGE` | `bool` | `True` | Master feature flag. Set to `False` to completely disable Graphify features. |
| `GRAPHIFY_GRAPH_PATH` | `str` | `graphify-out/graph.json` | Path to the Graphify JSON knowledge graph file relative to repository root. |
| `GRAPHIFY_EXECUTABLE_PATH` | `str` | Auto-detected | Explicit path to `graphify` binary (auto-detects from `PATH` or `/Users/oggy/.local/bin/graphify`). |
| `GRAPHIFY_TIMEOUT_SECONDS` | `int` | `30` | Subprocess execution timeout in seconds. |
| `GRAPHIFY_REBUILD_TIMEOUT_SECONDS`| `int` | `60` | Timeout for graph generation/update operations. |

---

## 5. API Endpoints Catalog

### 5.1 Status & Health Check
- **Endpoint:** `GET /api/knowledge/status`
- **Response:**
  ```json
  {
    "status": "ready",
    "is_enabled": true,
    "is_installed": true,
    "graphify_version": "0.9.92",
    "graph_path": "/path/to/graphify-out/graph.json",
    "schema_version": 1,
    "node_count": 1254,
    "edge_count": 3532,
    "community_count": 72,
    "last_updated_at": "2026-10-22T06:40:00Z",
    "message": "Graphify codebase knowledge graph is ready and verified."
  }
  ```

### 5.2 Code Impact Analysis & Blast Radius
- **Endpoint:** `POST /api/knowledge/impact` (or `GET /api/knowledge/impact`)
- **Request Body:**
  ```json
  {
    "target": "apps/api/app/services/detection/engine.py",
    "change_type": "modify",
    "max_depth": 2,
    "max_results": 50
  }
  ```
- **Response:**
  ```json
  {
    "target": "apps/api/app/services/detection/engine.py",
    "target_type": "file",
    "change_type": "modify",
    "status": "success",
    "direct_impact_count": 23,
    "transitive_impact_count": 1,
    "affected_files": [
      "apps/api/app/api/endpoints.py",
      "apps/api/tests/test_detection.py"
    ],
    "affected_symbols": ["endpoints.py", "DetectionEngine", "test_detection.py"],
    "relationships": [
      {
        "source": "endpoints.py",
        "target": "DetectionEngine",
        "relation": "imports",
        "direction": "incoming",
        "depth": 1,
        "confidence": "EXTRACTED",
        "confidence_score": 1.0,
        "source_file": "apps/api/app/api/endpoints.py",
        "source_location": "L73",
        "target_file": "apps/api/app/services/detection/engine.py",
        "target_location": "L17",
        "relevance_explanation": "Modifying 'DetectionEngine' may affect 'endpoints.py' which imports it in apps/api/app/api/endpoints.py:L73 [EXTRACTED]."
      }
    ],
    "summary": "Impact analysis for file 'apps/api/app/services/detection/engine.py' (modify): 23 direct dependent(s), 1 transitive dependent(s) across 2 file(s) and 3 symbol(s).",
    "limitations": [
      "Static AST analysis only; dynamically imported modules (importlib) are not captured.",
      "Results capped at 50 relationships."
    ],
    "graph_freshness": "2026-10-22T06:40:00Z",
    "duration_ms": 1.45
  }
  ```

### 5.3 Incident-Linked Blast Radius
- **Endpoint:** `GET /api/incidents/{incident_id}/code-impact`
- **Response:** Automatically extracts file mutation paths from the incident's trace spans (e.g. `delete_file`, `write_file`, `modify_file`), executes downstream AST impact analysis, and aggregates the blast radius.

### 5.4 Subgraph Live Query
- **Endpoint:** `POST /api/knowledge/query`
- **Request Body:** `{"query": "TraceContext", "budget": 2000}`
- **Response:** Returns scoped subgraphs containing connected AST entities, call hierarchy edges, and community clusters.

### 5.5 Symbol Explanation
- **Endpoint:** `GET /api/knowledge/explain/{symbol}`
- **Response:** Detailed incoming and outgoing edges for an individual class, function, or file node.

### 5.6 Source Code Preview
- **Endpoint:** `GET /api/knowledge/file-preview?path=apps/api/app/models/models.py&line=45&context=25`
- **Response:** Sanitized source code lines with line numbering and highlights. Protected by strict path traversal validation.

### 5.7 Incremental Graph Refresh
- **Endpoint:** `POST /api/knowledge/refresh`
- **Response:** Triggers `graphify update .` in a bounded background subprocess without blocking the API.

---

## 6. Code Impact Analysis & Provenance Taxonomy

### Reverse Dependency Traversal Algorithm
Traditional AST graphs record *outgoing* calls (`Module A imports Module B`). To compute blast radius, RIFT builds an inverted index of *incoming* reverse dependencies:
- **Depth 1 (Direct Dependents):** Code entities that directly import, instantiate, call, or inherit from the mutated target.
- **Depth 2+ (Transitive Dependents):** Secondary callers that depend on direct dependents, propagating up the architecture.

### Mutation Types & Semantics
- **`modify`:** Simulates changing internal logic or function signatures. Downstream dependents may fail at runtime or suffer behavioral regressions.
- **`delete`:** Simulates removing a file or symbol. Direct dependents will fail immediately with `ImportError` or `NameError`.
- **`create`:** Simulates introducing a new file or symbol. Highlights shadowing risks or collision with existing community namespaces.

### Provenance Classification
- **`EXTRACTED` (Confidence 1.0):** Direct syntactic relationships discovered through Tree-sitter AST parsing (`imports`, `calls`, `inherits`, `uses`, `re_exports`).
- **`INFERRED` (Confidence < 1.0):** Lexical or symbol-name references where dynamic dispatch or duck-typing makes absolute AST resolution ambiguous.

---

## 7. AI Investigation Workspace Integration

When Gemma (via local Ollama) investigates an incident, RIFT's `ContextBuilder` (`apps/api/app/services/ai/context_builder.py`) enriches the prompt with static codebase ground truth:

1. **Span Inspection:** Identifies tool calls with file arguments (`path`, `target_path`, `file_path`).
2. **Blast Radius Computation:** Runs `adapter.analyze_impact(path, change_type)`.
3. **Evidence Package Generation:** Injects discrete evidence items:
   - Evidence ID: `ev-code-imp-1`, `ev-code-imp-2`, etc.
   - Text: `[CODE IMPACT AST] File 'src/config.ts' (delete): 5 direct dependent(s)...`
4. **Gemma Citation:** Gemma cites `ev-code-imp-N` when formulating hypotheses explaining why deleting or mutating a source file cascaded into downstream application crashes.

---

## 8. Security Architecture & Threat Defenses

| Threat | Defense Implementation | Code Location |
| :--- | :--- | :--- |
| **Path Traversal Attacks** | Rejects `../`, absolute paths outside workspace, and encoded variations. Enforces `commonpath([realpath(path), repo_root]) == repo_root`. | `adapter._validate_safe_path()` |
| **Symlink Escape** | Resolves real file targets using `os.path.realpath()` before checking root confinement. Rejects broken or escaping symlinks. | `adapter._validate_safe_path()` |
| **Subprocess Injection** | Strictly uses structured list arguments (`["graphify", "query", ...]`). **Never `shell=True`**. | `adapter._run_graphify_cli()` |
| **DoS via Hangs / Slow Traversal** | All CLI subprocesses use strict execution timeouts (`timeout=30s`). Traversal depth is clamped to 1-5, results clamped to 100 max. | `adapter._run_graphify_cli()` |
| **Untrusted Input Sanitization** | Queries and symbol names are sanitized against control characters and null bytes (`\x00`). Rejects input exceeding length budgets. | `adapter.query_graph()`, `endpoints.py` |

---

## 9. Testing & Quality Verification

### Backend Pytest Suite
```bash
# Run all code knowledge tests (26 unit + security tests)
source apps/api/.venv/bin/activate
pytest apps/api/tests/test_code_knowledge.py -v

# Run entire backend test suite (89 passing tests)
pytest apps/api/tests
```

Key test cases in `test_code_knowledge.py`:
- `test_path_traversal_prevention_on_preview`: Rejects `../../etc/passwd` and absolute traversal.
- `test_symlink_escape_prevention`: Verifies symlinks targeting outside directories are blocked.
- `test_impact_analysis_for_file_and_symbol`: Validates reverse AST dependency traversal.
- `test_untrusted_input_sanitization`: Verifies rejection of shell injection strings and null bytes.
- `test_fallback_when_disabled`: Verifies graceful degradation when feature flag is off.
- `test_real_graphify_generation_in_temp_repo`: Real integration test extracting AST from a temporary repository.

### Frontend Vitest Suite
```bash
# Run all frontend tests (31 passing tests)
cd apps/web
npm test

# Verify production build & TypeScript validation
npm run build
```

---

## 10. Operational Runbook

### Updating the Code Knowledge Graph After Code Changes
To keep the AST graph current after editing code files, run:
```bash
graphify update .
```
*(Execution time: ~2 seconds; 0 API cost)*

### Viewing the Explorer in RIFT
1. Open RIFT at `http://localhost:5173`.
2. Navigate to **Code Knowledge** (`/graphify`) from the top navigation.
3. In the **Code Impact Analysis & Blast Radius Explorer**, enter a target file or symbol (e.g. `apps/api/app/services/detection/engine.py` or preset `DetectionEngine`).
4. Select mutation type (`modify`, `delete`, or `create`) and depth (1, 2, or 3).
5. Click **Run** to view immediate callers, transitive cascades, and click file links to trigger in-situ source code previews.
