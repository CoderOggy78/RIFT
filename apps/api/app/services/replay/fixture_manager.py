import json
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional

REPLAY_FIXTURES_DIR = Path(__file__).resolve().parents[5] / "fixtures" / "replay"


class FixtureIntegrityError(ValueError):
    """Raised when fixture snapshot does not match registered cryptographic hash."""
    pass


class FixtureManager:
    @staticmethod
    def compute_snapshot_hash(initial_files: Dict[str, str]) -> str:
        canonical_str = json.dumps(initial_files, sort_keys=True)
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    @classmethod
    def list_fixtures(cls) -> List[Dict[str, Any]]:
        registry_file = REPLAY_FIXTURES_DIR / "registry.json"
        if not registry_file.exists():
            return []

        try:
            with open(registry_file, "r", encoding="utf-8") as f:
                registry = json.load(f)

            fixtures_summary = []
            for item in registry:
                fix_data = cls.load_fixture(item["fixture_id"])
                if fix_data:
                    fixtures_summary.append({
                        "fixture_id": fix_data["fixture_id"],
                        "title": fix_data.get("title"),
                        "description": fix_data.get("description"),
                        "incident_id": fix_data.get("incident_id"),
                        "original_event_id": fix_data.get("original_event_id"),
                        "allowed_operations": fix_data.get("allowed_operations", []),
                        "protected_paths": fix_data.get("protected_paths", []),
                        "permitted_paths": fix_data.get("permitted_paths", []),
                        "initial_file_count": len(fix_data.get("initial_files", {})),
                        "snapshot_integrity_hash": fix_data.get("snapshot_integrity_hash"),
                    })
            return fixtures_summary
        except Exception:
            return []

    @classmethod
    def load_fixture(cls, fixture_id: str) -> Optional[Dict[str, Any]]:
        registry_file = REPLAY_FIXTURES_DIR / "registry.json"
        if not registry_file.exists():
            return None

        with open(registry_file, "r", encoding="utf-8") as f:
            registry = json.load(f)

        filename = None
        for item in registry:
            if item.get("fixture_id") == fixture_id:
                filename = item.get("filename")
                break

        if not filename:
            # Fallback direct lookup
            cand = REPLAY_FIXTURES_DIR / f"{fixture_id}.json"
            if cand.exists():
                with open(cand, "r", encoding="utf-8") as f:
                    return json.load(f)
            return None

        target_file = REPLAY_FIXTURES_DIR / filename
        if not target_file.exists():
            return None

        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Verify integrity hash
        initial_files = data.get("initial_files", {})
        expected_hash = data.get("snapshot_integrity_hash")
        computed_hash = cls.compute_snapshot_hash(initial_files)

        if expected_hash and computed_hash != expected_hash:
            raise FixtureIntegrityError(
                f"Snapshot integrity mismatch for fixture '{fixture_id}'. Expected {expected_hash}, computed {computed_hash}"
            )

        return data

    @classmethod
    def get_fixture_for_incident(cls, incident_id: str) -> Optional[Dict[str, Any]]:
        registry_file = REPLAY_FIXTURES_DIR / "registry.json"
        if not registry_file.exists():
            return None

        with open(registry_file, "r", encoding="utf-8") as f:
            registry = json.load(f)

        for item in registry:
            if item.get("incident_id") == incident_id:
                return cls.load_fixture(item["fixture_id"])

        # Default fallback to accidental deletion fixture for demo traces
        return cls.load_fixture("fixture-accidental-deletion")
