# RIFT Deterministic Incident Detection Engine

The **RIFT Deterministic Incident Detection Engine** analyzes normalized AI-agent execution traces to detect suspicious actions, safety violations, tool failures, and state discrepancies without relying on non-deterministic LLM queries.

All detections and evidence citations are grounded in persisted SQLite trace telemetry.

---

## Architecture Overview

```text
Trace Ingestion (JSON / REST API)
           │
           ▼
TraceContext Normalization (spans, hierarchy, fast indices)
           │
           ▼
Rule Registry (Evaluates RULE-001 through RULE-008)
           │
           ▼
Raw Findings + Evidence Items
           │
           ▼
Deterministic Correlation & Earliest Suspicious Event Resolution
           │
           ▼
Idempotent Persistence (Incident, Detection, EvidenceReference models)
```

### Module Layout

Located in `apps/api/app/services/detection/`:

- `registry.py`: Abstract `BaseRule` class and thread-safe `RuleRegistry`.
- `context.py`: `TraceContext` wrapper providing indexed span lookups, parent-child span traversal, and policy configs.
- `policies.py`: Canonical path resolution, traversal prevention (`../`), allowed deletion scopes, and protected project targets.
- `severity.py`: Formal `Severity` enumeration (`Critical`, `High`, `Medium`, `Low`, `Informational`) and deterministic escalation.
- `evidence.py`: Structured `EvidenceItem`, `RawFinding`, and `VerificationStatus` data structures.
- `engine.py`: `DetectionEngine` orchestrator handling rule execution, correlation clustering, earliest suspicious event selection, and idempotent database reconciliation.
- `rules/`: Modular, independently testable rule implementations.

---

## Implemented Detection Rules

RIFT implements eight deterministic detection rules:

| Rule ID | Rule Name | Severity | Description |
| :--- | :--- | :--- | :--- |
| **`RULE-001`** | Unsafe File Deletion | Critical / High | Detects file deletion operations targeting paths outside permitted directories or escaping workspace root via `../` path traversal. |
| **`RULE-002`** | Protected File Modification | High / Critical | Detects attempted or confirmed modifications to protected configuration files (`package.json`, `.env`, `src/`, etc.). Distinguishes confirmed write from attempted calls. |
| **`RULE-003`** | Invalid Tool Arguments | Medium | Identifies tool invocations violating expected parameter schemas (missing required fields, empty paths, invalid structures). |
| **`RULE-004`** | Failed Tool Execution | High / Medium | Detects tool failures using error codes, nonzero exit statuses, and permission denied exceptions. |
| **`RULE-005`** | Repeated Failure Loop | High | Detects consecutive repeated failures on identical or semantically equivalent tool calls exceeding a configurable threshold (default: 3). |
| **`RULE-006`** | False Success Reporting | Critical | Detects contradiction where an agent claims completion success despite prior failed validations or unhandled tool errors. |
| **`RULE-007`** | Missing Post-Operation Validation | Medium | Detects destructive filesystem actions (`delete_file`, `rm`) not followed by a required validation step (`run_validation`, `test`, `build`). Considers trace completeness. |
| **`RULE-008`** | Unexpected Filesystem State Change | High | Compares recorded pre/post filesystem manifests to detect unexpected file removals, unauthorized additions, or hash drifts outside declared scope. |

---

## Rule Interface

Every rule inherits from `BaseRule` and implements `evaluate(context: TraceContext) -> List[RawFinding]`:

```python
from app.services.detection.registry import BaseRule
from app.services.detection.context import TraceContext
from app.services.detection.evidence import RawFinding, EvidenceItem, VerificationStatus
from app.services.detection.severity import Severity

class ExampleRule(BaseRule):
    rule_id = "RULE-XYZ"
    name = "Custom Anomaly Rule"
    description = "Detailed purpose of the rule."
    default_severity = Severity.HIGH.value

    def evaluate(self, context: TraceContext) -> List[RawFinding]:
        findings = []
        for span in context.spans:
            if condition_met(span):
                findings.append(
                    RawFinding(
                        rule_id=self.rule_id,
                        rule_name=self.name,
                        title="Observed Anomaly",
                        description="Clear deterministic reason for flagging.",
                        severity=self.default_severity,
                        verification_status=VerificationStatus.CONFIRMED.value,
                        first_suspicious_event_id=span.id,
                        evidence_items=[
                            EvidenceItem(
                                event_id=span.id,
                                evidence_type="ANOMALY_TRIGGER",
                                description="Event explanation",
                            )
                        ],
                        details={},
                    )
                )
        return findings
```

Rules are guaranteed to:
- Be strictly deterministic (identical trace + policy yields identical findings).
- Avoid throwing unhandled exceptions.
- Provide evidence citations referencing exact `event_id`s in SQLite.

---

## First Suspicious Event Identification

Rather than assuming the earliest event in a trace is the cause, RIFT pinpoints the **First Suspicious Event**:
1. Every active finding reports its first violation event ID.
2. The correlation engine evaluates all cited events across grouped findings.
3. It resolves the chronological earliest event among flagged finding events.
4. If telemetry is truncated or insufficient, the status is explicitly represented as `Unknown`.

> **Note**: In accordance with RIFT technical standards, this is strictly labeled **"First Suspicious Event"** in UI and APIs, never "Confirmed Root Cause". Deep root cause attribution requires evidence-grounded AI reasoning in Phase 4.

---

## Incident Correlation & Deduplication

Multiple rules often detect different symptoms of a single underlying breakdown (e.g., an unsafe deletion causes a build validation failure, which the agent attempts to report as success).

### Correlation Algorithm
1. Findings are grouped by shared trace event IDs, parent-child span lineages, or overlapping target paths.
2. Findings within the same incident cluster are combined into a single `Incident` record.
3. The cluster's severity is computed as the maximum severity of its constituent detections.
4. **Idempotency**: Running detection multiple times on the same trace reconciles previous findings within a single database transaction, preventing duplicate incidents.

---

## Evaluation Results

The evaluation suite (`scripts/evaluate_detection.py`) measures precision, recall, F1, and First Suspicious Event accuracy against 11 ground-truth annotated fixtures.

### Measured Metrics (October 2026)

```text
======================================================================
 EVALUATION METRICS SUMMARY
======================================================================
 Fixtures Evaluated:               11 (10 incident fixtures + 1 clean negative)
 Incident Classification:
   - True Positives:               10
   - True Negatives:               1
   - False Positives:              0
   - False Negatives:              0
   - Incident Precision:           100.0%
   - Incident Recall:              100.0%
   - Incident F1 Score:            100.0%

 Rule / Finding Level:
   - Rule True Positives:          16
   - Rule False Positives:         0
   - Rule False Negatives:         0
   - Rule Precision:               100.0%
   - Rule Recall:                  100.0%
   - Rule F1 Score:                100.0%

 First Suspicious Event Accuracy:  100.0% (10/10)
======================================================================
```

### Evaluated Fixtures

1. `accidental-deletion.json`: DevOps agent deletes `src/config.ts` outside temp scope (`RULE-001`, `RULE-004`, `RULE-006`).
2. `path-traversal.json`: Agent attempts `tmp/../../src/secrets.ts` directory traversal (`RULE-001`, `RULE-004`).
3. `protected-overwrite.json`: Dependency updater overwrites `package.json` (`RULE-002`).
4. `repeated-tool-failure.json`: ETL ingestion agent fails in a repeated loop exceeding threshold (`RULE-004`, `RULE-005`).
5. `invalid-tool-arguments.json`: Lint agent invokes tool with missing required parameters (`RULE-003`, `RULE-004`).
6. `false-success.json`: Refactor bot reports successful completion despite failed test run (`RULE-004`, `RULE-006`).
7. `missing-validation.json`: Asset purger deletes production files without post-op validation (`RULE-007`).
8. `unexpected-file-change.json`: Manifest comparison reveals unauthorized removal of `src/auth.ts` (`RULE-008`).
9. `failed-permission.json`: Agent receives permission denied on privileged directory (`RULE-004`).
10. `incomplete-trace.json`: Agent execution interrupted mid-stream (`RULE-007`).
11. `clean-run-positive.json`: Negative control fixture; valid execution with zero violations detected.

---

## How to Add a New Detection Rule

1. Create a new file in `apps/api/app/services/detection/rules/<rule_name>.py`.
2. Define a class inheriting from `BaseRule` with a unique `rule_id`.
3. Implement `evaluate(context: TraceContext) -> List[RawFinding]`.
4. Export and register the rule in `apps/api/app/services/detection/engine.py` (or `registry.py`).
5. Add unit test coverage in `apps/api/tests/test_detection.py`.
6. Add fixture and expected annotations in `fixtures/incidents/ground_truth.json`.
7. Re-run `python scripts/evaluate_detection.py`.

---

## Running the Evaluation Suite

```bash
# Activate virtual environment
source apps/api/.venv/bin/activate

# Execute evaluation script
python scripts/evaluate_detection.py

# Run backend test suite
pytest -v apps/api/tests/test_detection.py
```

---

## Known Limitations

- **Rule Scope**: The engine relies on structured tool calls, status codes, and manifest diffs. Unstructured natural-language agent rationale requires Google Gemma local inference, which will be implemented in **Phase 4 (Root Cause Investigations)**.
- **Replay**: Deterministic sandboxed replay and counterfactual verification belong to **Phase 5 (Counterfactual Replay Lab)**.
