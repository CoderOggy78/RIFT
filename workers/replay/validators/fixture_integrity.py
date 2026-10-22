import hashlib
from pathlib import Path
from typing import Dict, Any, List


def check_fixture_integrity(
    workspace: Path,
    required_files: List[str] = None,
    forbidden_files: List[str] = None,
) -> Dict[str, Any]:
    """
    Deterministic validator checking that required files exist and forbidden files are absent.
    """
    required_files = required_files or []
    forbidden_files = forbidden_files or []

    missing_required = []
    found_forbidden = []
    checked_files = {}

    for req in required_files:
        p = workspace / req
        if not p.exists():
            missing_required.append(req)
        else:
            try:
                content = p.read_bytes()
                h = hashlib.sha256(content).hexdigest()
                checked_files[req] = {"exists": True, "size_bytes": len(content), "hash": h}
            except Exception as e:
                missing_required.append(f"{req} (unreadable: {str(e)})")

    for forb in forbidden_files:
        p = workspace / forb
        if p.exists():
            found_forbidden.append(forb)

    passed = (len(missing_required) == 0 and len(found_forbidden) == 0)

    return {
        "validator_id": "fixture-integrity",
        "passed": passed,
        "missing_required": missing_required,
        "found_forbidden": found_forbidden,
        "checked_files": checked_files,
        "error_message": (
            f"Validation failed: missing {missing_required}, found forbidden {found_forbidden}"
            if not passed else None
        ),
    }
