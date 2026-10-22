# RIFT Counterfactual Replay & Failure Verification Engine

> *Between what agents intend and what they do.*

The **Counterfactual Replay Engine** enables developers to verify whether a proposed correction safely resolves an observed agent execution failure without causing regressions or invariant violations.

---

## 1. Primary Philosophy & Distinctions

Counterfactual replay distinguishes between four distinct states:

| State | Definition | RIFT Verification Mechanism |
|---|---|---|
| **Execution Succeeded** | The low-level tool invocation returned exit code 0. | Exit status inspection inside isolated container. |
| **Validation Passed** | Deterministic invariants (source files intact, artifacts generated) were satisfied. | Deterministic fixture integrity checker. |
| **Correction Improved Outcome** | Counterfactual variant satisfied invariants while original variant violated them. | Comparative differential outcome classifier. |
| **Hypothesis Conclusively Verified** | Complete root-cause explanation proven across all execution environments. | High-confidence evidence under tested fixture conditions (does not extrapolate to unverified host states). |

> [!IMPORTANT]
> A successful counterfactual replay demonstrates evidence strictly within the tested fixture snapshot. It does not automatically guarantee root cause verification across all possible host configurations.

---

## 2. Replay Pipeline (17-Step Lifecycle)

Every replay adheres to a strictly deterministic, 17-step lifecycle:

```
[1. Load Incident]
       │
[2. Resolve Failing Tool Call Event]
       │
[3. Validate Operation Type & Args]
       │
[4. Load Fixture Definition]
       │
[5. Validate Counterfactual Arguments]
       │
[6. Generate Security Preview]
       │
[7. Require Explicit User Authorization]  ─── (Fail-closed if unapproved)
       │
[8. Initialize Two Independent Disposable Sandboxes]
       │
[9. Verify Identical Initial Snapshot Hash (SHA-256)]
       │
[10. Execute Original Variant]
       │
[11. Execute Counterfactual Variant]
       │
[12. Run Deterministic Invariant Validators]
       │
[13. Capture Post-Execution Filesystem Manifests]
       │
[14. Compute Filesystem Differences (Added, Removed, Modified)]
       │
[15. Persist Replay, Variants & Comparison Records]
       │
[16. Emit Machine-Readable Audit Manifest]
       │
[17. Securely Purge Both Sandbox Environments]
```

---

## 3. Supported Typed Operations

RIFT strictly rejects arbitrary shell commands, raw Python code execution, and unvalidated model output. Only four typed operations are permitted:

### 1. `delete_file`
Deletes an ephemeral file within the sandbox workspace.
```json
{
  "operation": "delete_file",
  "arguments": {
    "path": "tmp/cache.json"
  }
}
```

### 2. `write_file`
Writes UTF-8 text content to a destination within the sandbox workspace (max size 256 KB).
```json
{
  "operation": "write_file",
  "arguments": {
    "path": "tmp/output.json",
    "content": "{\"status\": \"ok\"}"
  }
}
```

### 3. `move_file`
Relocates a file between two permitted paths inside the sandbox workspace.
```json
{
  "operation": "move_file",
  "arguments": {
    "source": "tmp/old.json",
    "destination": "tmp/new.json"
  }
}
```

### 4. `run_validation`
Executes an allowlisted, fixture-specific invariant check inside the container.
```json
{
  "operation": "run_validation",
  "arguments": {
    "validator_id": "fixture-integrity"
  }
}
```

---

## 4. Comparison Semantics & Conclusion Outcomes

After independent execution, RIFT computes a deterministic verdict:

- **`counterfactual_passed_original_failed`**: The proposed correction succeeded while the original action violated fixture invariants (verified improvement).
- **`both_failed`**: Both the original action and proposed correction failed deterministic validation checks.
- **`both_passed`**: Both variants satisfied invariants; no differential discrepancy observed.
- **`counterfactual_introduced_failures`**: The counterfactual correction introduced new errors or regressions.
- **`safety_violation`**: An operation attempted to violate canonical path boundaries or access protected paths.
- **`inconclusive`**: Execution was interrupted, timed out, or unverified.

---

## 5. Gemma Remediation Integration

From the **Investigation Workspace** (`/investigations/:traceId`):
1. Gemma formulates root-cause hypotheses and suggests remediation actions.
2. If a remediation suggestion matches a supported typed operation, RIFT displays a **"Prepare Counterfactual Replay"** draft button.
3. Unsafe or open-ended recommendations (e.g. natural-language shell suggestions) are explicitly badged:
   *"This recommendation requires manual verification and cannot be replayed automatically."*
4. The draft loads into `/replay` where arguments can be inspected, adjusted, previewed, and approved.

---

## 6. Reproducing a Replay via CLI

Every replay exports a machine-readable audit manifest:
```bash
# 1. Fetch manifest from API
curl http://localhost:8000/api/replays/<replay_id>/manifest > manifest.json

# 2. Run standalone worker against the fixture snapshot
python3 -m workers.replay.worker \
  --fixture fixtures/replay/accidental_deletion_fixture.json \
  --operation delete_file \
  --arguments '{"path": "tmp/cache.json"}' \
  --output result.json
```
