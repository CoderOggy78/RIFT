# RIFT Replay Security Architecture & Trust Boundaries

> *Strict Isolation, Zero Host Access, Fail-Closed Enforcement.*

Counterfactual replay involves potentially destructive filesystem operations (e.g. deleting or overwriting files). To eliminate all risks to the host development environment, RIFT enforces uncompromising isolation principles.

---

## 1. Non-Negotiable Security Controls

1. **Zero Host Project Modification**: The user's actual project filesystem is never mounted into replay containers. Replays run exclusively against ephemeral scratch copies populated from reproducible JSON fixture snapshots.
2. **No Host Network Access**: Replay containers operate with `network_mode: "none"` (completely offline).
3. **No Root Execution**: Container process runs under dedicated unprivileged UID `10001:10001` (`replayuser`).
4. **No Docker Socket Mounting**: Replay containers have no access to `/var/run/docker.sock` and cannot spawn child containers.
5. **Read-Only Root Filesystem**: Container root filesystem is mounted read-only (`read_only: true`). Only `/workspace` (in-memory `tmpfs`) is writable.
6. **Strict Resource Quotas**:
   - Memory Limit: 256 MB (`mem_limit="256m"`)
   - CPU Limit: 1.0 core (`nano_cpus=1000000000`)
   - PIDs Limit: 64 processes (`pids_limit=64`)
   - Execution Timeout: 30 seconds (`timeout=30`)
7. **Canonical Path Resolution & Escape Prevention**:
   - Rejection of parent traversal (`../` and `..\`).
   - Rejection of absolute paths (`/etc/passwd`, `C:\Windows`).
   - Rejection of null bytes (`\0`).
   - Rejection of symlink escapes pointing outside `/workspace`.
   - Rejection of device nodes, sockets, and FIFOs.
8. **Protected Path Enforcement**: Fixtures define glob patterns for protected assets (`src/*`, `package.json`). Operations attempting to delete or overwrite protected paths are flagged as invariant violations.
9. **Fail-Closed Architecture**: If Docker is unavailable or misconfigured, RIFT strictly refuses to fall back to executing on the host. The application surfaces:
   *"Secure replay is unavailable in this environment."*

---

## 2. Trust Boundaries & Threat Model

```
┌────────────────────────────────────────────────────────┐
│ UNTRUSTED ZONE                                         │
│ • Local Gemma Model Output                             │
│ • Historical Ingested Agent Traces                     │
│ • User-Edited Replay JSON Arguments                    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ (Schema Validation & Security Policy)
┌────────────────────────────────────────────────────────┐
│ TRUSTED ORCHESTRATION LAYER (FastAPI API Service)      │
│ • Pydantic Schema Verification                         │
│ • Canonical Path Safety Checker                        │
│ • Fixture Manager & SHA-256 Hasher                     │
│ • Explicit Human Approval Verifier                     │
│ • Ephemeral Sandbox Lifecycle Manager                  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼ (Docker API via Unix Domain Socket)
┌────────────────────────────────────────────────────────┐
│ ISOLATED EXECUTION ENVIRONMENT                         │
│ • Dedicated Alpine-based Replay Worker                 │
│ • UID 10001:10001 (replayuser)                         │
│ • Offline (network_mode: none)                         │
│ • Ephemeral Workspace Only                             │
└────────────────────────────────────────────────────────┘
```

---

## 3. Explicit Approval Protocol

Every replay execution requires explicit human authorization:
- The approval checkbox in `SecurityPreviewModal` is **unchecked by default**.
- The API endpoint `POST /api/incidents/:id/replay` requires `{ approved_by_user: true }`.
- Repeated requests or unapproved submissions are rejected with HTTP 400 Bad Request.
- Authorization records the timestamp and audit parameters in the `replays` database table.

---

## 4. Verification Suite

The replay security boundary is validated by automated test suites:
- `test_resolve_secure_path_rejects_parent_traversal`: Rejects `../outside.txt` and `sub/../../outside.txt`.
- `test_resolve_secure_path_rejects_absolute_path`: Rejects `/etc/passwd`.
- `test_resolve_secure_path_rejects_null_byte`: Rejects null byte injection.
- `test_resolve_secure_path_rejects_symlink_escape`: Rejects symlinks pointing to host filesystem.
- `test_api_replay_requires_explicit_approval`: Confirms API rejects submissions with `approved_by_user: false`.
