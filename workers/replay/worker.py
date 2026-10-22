#!/usr/bin/env python3
"""
RIFT Sandboxed Replay Worker Entrypoint.
Runs inside an isolated, unprivileged, network-less container.
"""

import sys
import json
import time
import hashlib
from pathlib import Path
from typing import Dict, Any

from operations.delete_file import execute_delete_file
from operations.write_file import execute_write_file
from operations.move_file import execute_move_file
from operations.run_validation import execute_run_validation
from validators.fixture_integrity import check_fixture_integrity

WORKSPACE_DIR = Path("/workspace")
OUTPUT_DIR = Path("/app/output")


def scan_filesystem_manifest(root: Path) -> Dict[str, Any]:
    """Generates an SHA-256 content manifest of all files within root."""
    manifest = {}
    if not root.exists():
        return manifest

    for p in sorted(root.rglob("*")):
        if p.is_file():
            rel = str(p.relative_to(root))
            try:
                data = p.read_bytes()
                manifest[rel] = {
                    "size_bytes": len(data),
                    "hash": hashlib.sha256(data).hexdigest(),
                }
            except Exception as e:
                manifest[rel] = {"error": str(e)}
    return manifest


def main():
    start_time = time.time()
    try:
        # Read payload from stdin or input file
        input_file = Path("/app/input/request.json")
        if input_file.exists():
            payload = json.loads(input_file.read_text(encoding="utf-8"))
        else:
            payload = json.loads(sys.stdin.read())
    except Exception as e:
        err_res = {
            "status": "failed",
            "error_type": "InvalidInputError",
            "message": f"Failed to parse input payload: {str(e)}",
            "duration_ms": 0.0,
        }
        print(json.dumps(err_res))
        sys.exit(1)

    operation = payload.get("operation")
    arguments = payload.get("arguments", {})
    protected_paths = payload.get("protected_paths", [])
    validation_spec = payload.get("validation_spec", {})

    pre_manifest = scan_filesystem_manifest(WORKSPACE_DIR)
    op_result = None
    op_error = None
    execution_status = "success"

    try:
        if operation == "delete_file":
            op_result = execute_delete_file(WORKSPACE_DIR, arguments, protected_paths)
        elif operation == "write_file":
            op_result = execute_write_file(WORKSPACE_DIR, arguments, protected_paths)
        elif operation == "move_file":
            op_result = execute_move_file(WORKSPACE_DIR, arguments, protected_paths)
        elif operation == "run_validation":
            validators = {"fixture-integrity": lambda ws: check_fixture_integrity(
                ws,
                validation_spec.get("required_files", []),
                validation_spec.get("forbidden_files", []),
            )}
            op_result = execute_run_validation(WORKSPACE_DIR, arguments, validators)
        else:
            raise ValueError(f"Unsupported operation: '{operation}'")
    except Exception as e:
        execution_status = "failed"
        op_error = str(e)

    # Execute deterministic post-execution validation
    val_result = check_fixture_integrity(
        WORKSPACE_DIR,
        required_files=validation_spec.get("required_files", []),
        forbidden_files=validation_spec.get("forbidden_files", []),
    )

    post_manifest = scan_filesystem_manifest(WORKSPACE_DIR)
    duration_ms = round((time.time() - start_time) * 1000, 2)

    response = {
        "operation": operation,
        "arguments": arguments,
        "execution_status": execution_status,
        "operation_result": op_result,
        "operation_error": op_error,
        "validation_result": val_result,
        "pre_manifest": pre_manifest,
        "post_manifest": post_manifest,
        "duration_ms": duration_ms,
    }

    # Write output to output directory if present
    if OUTPUT_DIR.exists():
        out_file = OUTPUT_DIR / "result.json"
        out_file.write_text(json.dumps(response, indent=2), encoding="utf-8")

    print(json.dumps(response))
    sys.exit(0 if execution_status == "success" else 1)


if __name__ == "__main__":
    main()
