import hashlib
from pathlib import Path
from typing import Dict, Any, List


class ValidationRunner:
    @staticmethod
    def run_fixture_integrity_validator(
        workspace_path: Path,
        required_files: List[str] = None,
        forbidden_files: List[str] = None,
    ) -> Dict[str, Any]:
        """
        Deterministic fixture integrity validator.
        """
        required_files = required_files or []
        forbidden_files = forbidden_files or []

        missing_required = []
        found_forbidden = []
        checked_files = {}

        for req in required_files:
            target = workspace_path / req
            if not target.exists():
                missing_required.append(req)
            else:
                try:
                    data = target.read_bytes()
                    checked_files[req] = {
                        "exists": True,
                        "size_bytes": len(data),
                        "hash": hashlib.sha256(data).hexdigest(),
                    }
                except Exception as e:
                    missing_required.append(f"{req} ({str(e)})")

        for forb in forbidden_files:
            target = workspace_path / forb
            if target.exists():
                found_forbidden.append(forb)

        passed = (len(missing_required) == 0 and len(found_forbidden) == 0)

        return {
            "validator_id": "fixture-integrity",
            "passed": passed,
            "missing_required": missing_required,
            "found_forbidden": found_forbidden,
            "checked_files": checked_files,
            "summary": (
                "All required protected files present and forbidden files removed."
                if passed else
                f"Integrity check failed: missing {missing_required}, forbidden {found_forbidden}"
            ),
        }
