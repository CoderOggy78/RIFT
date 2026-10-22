# RIFT Replay Fixture System & Snapshot Integrity

> *Hermetic, Reproducible, Cryptographically Verified Test Beds.*

Replay fixtures provide hermetic initial states against which original and counterfactual operations execute. Both variants are always initialized from identical cryptographic snapshots.

---

## 1. Fixture Schema Specification

A valid replay fixture contains:

```json
{
  "fixture_id": "accidental_deletion_v1",
  "version": "1.0.0",
  "title": "Accidental Source File Deletion Reproduction Fixture",
  "description": "Standard build environment containing source files and temporary cache.",
  "initial_files": {
    "src/config.ts": "export const config = { port: 8080, env: 'production' };\n",
    "src/main.ts": "import { config } from './config';\nconsole.log('Server starting on port', config.port);\n",
    "package.json": "{\n  \"name\": \"sample-app\",\n  \"version\": \"1.0.0\"\n}\n",
    "tmp/cache.json": "{\"stale_timestamp\": 1600000000, \"items\": [1, 2, 3]}\n"
  },
  "protected_paths": [
    "src/*",
    "package.json"
  ],
  "permitted_paths": [
    "tmp/*"
  ],
  "allowed_operations": [
    "delete_file",
    "write_file",
    "move_file",
    "run_validation"
  ],
  "validators": [
    {
      "id": "fixture-integrity",
      "name": "Source Integrity & Cache Eviction Validator",
      "required_paths": [
        "src/config.ts",
        "src/main.ts",
        "package.json"
      ],
      "forbidden_paths": [
        "tmp/cache.json"
      ]
    }
  ]
}
```

---

## 2. Cryptographic Snapshot Hashing

Before any replay executes, RIFT computes a canonical SHA-256 digest of the fixture's initial files:
1. Relative file paths are sorted lexicographically.
2. File contents are hashed using SHA-256.
3. Path and content hashes are combined into a root snapshot digest:
   - For `accidental_deletion_fixture.json`:
     `6251b0f373af3e0f44e650f721f471de41ff268c39b6452cd255e19d2c675537`
4. Both the original sandbox and counterfactual sandbox verify that their initial directories produce this exact SHA-256 hash before running any operation.

---

## 3. Fixture Registry

Fixtures are registered in `fixtures/replay/registry.json`:
- `accidental_deletion_v1`: Simulates cleaning temporary cache vs accidentally deleting `src/config.ts`.
- `path_traversal_v1`: Simulates attempting to delete `../../etc/passwd` vs a safe relative path in `tmp/`.

---

## 4. Deterministic Invariant Validators

Validators enforce rules without executing untrusted shell scripts:
- **`required_paths`**: These files must exist post-execution and retain valid contents. If any required file was deleted or corrupted, validation fails.
- **`forbidden_paths`**: These files represent temporary or stale targets that the operation intended to clean. If any forbidden file remains, validation fails.
