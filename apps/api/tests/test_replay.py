import pytest
import json
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.models import Incident, Trace, Replay, ReplayVariant, ReplayComparison
from app.services.replay.security_policy import SecurityPolicy, SecurityPolicyError
from app.services.replay.operation_registry import TypedOperation, DeleteFileArguments, WriteFileArguments
from app.services.replay.operation_validator import OperationValidator, OperationValidationError
from workers.replay.validators.fixture_integrity import check_fixture_integrity
from app.services.replay.fixture_manager import FixtureManager, FixtureIntegrityError
from app.services.replay.snapshot_manager import SnapshotManager
from app.services.replay.filesystem_diff import FilesystemDiff
from app.services.replay.result_comparator import ResultComparator
from app.services.replay.sandbox import SandboxOrchestrator, SandboxUnavailableError
from app.services.replay.orchestrator import ReplayOrchestrator
from app.services.replay.audit_logger import ReplayAuditLogger

client = TestClient(app)


# ==========================================
# 1. Operation Validation & Schema Tests
# ==========================================

def test_operation_validator_valid_delete():
    res = OperationValidator.validate_operation("delete_file", {"path": "tmp/cache.json"})
    assert res["valid"] is True
    assert res["validated_arguments"]["path"] == "tmp/cache.json"
    assert res["affects_protected"] is False


def test_operation_validator_detects_protected_path():
    res = OperationValidator.validate_operation(
        "delete_file",
        {"path": "src/config.ts"},
        protected_paths=["src/config.ts", "package.json"],
    )
    assert res["valid"] is True
    assert res["affects_protected"] is True
    assert res["matching_protected_rule"] == "src/config.ts"


def test_operation_validator_rejects_unknown_operation():
    with pytest.raises(OperationValidationError, match="Unsupported operation"):
        OperationValidator.validate_operation("execute_bash", {"command": "rm -rf /"})


def test_operation_validator_rejects_missing_arguments():
    with pytest.raises(OperationValidationError, match="Invalid operation arguments"):
        OperationValidator.validate_operation("delete_file", {})


def test_operation_validator_rejects_oversized_content():
    oversized = "A" * (1024 * 1024 + 10)
    with pytest.raises(OperationValidationError, match="exceeds 1MB"):
        OperationValidator.validate_operation("write_file", {"path": "tmp/big.txt", "content": oversized})


# ==========================================
# 2. Filesystem Security & Path Traversal
# ==========================================

def test_security_policy_rejects_parent_traversal():
    with pytest.raises(SecurityPolicyError, match="Parent directory traversal"):
        SecurityPolicy.validate_path_syntax("../../etc/passwd")


def test_security_policy_rejects_absolute_paths():
    with pytest.raises(SecurityPolicyError, match="Absolute paths are forbidden"):
        SecurityPolicy.validate_path_syntax("/var/log/system.log")


def test_security_policy_rejects_windows_drive():
    with pytest.raises(SecurityPolicyError, match="Windows drive letters are forbidden"):
        SecurityPolicy.validate_path_syntax("C:\\Windows\\System32")


def test_security_policy_rejects_null_bytes():
    with pytest.raises(SecurityPolicyError, match="Forbidden character"):
        SecurityPolicy.validate_path_syntax("file.txt\0.js")


# ==========================================
# 3. Fixture Manager & Snapshot Integrity
# ==========================================

def test_fixture_manager_loads_accidental_deletion_fixture():
    fixture = FixtureManager.load_fixture("fixture-accidental-deletion")
    assert fixture is not None
    assert fixture["fixture_id"] == "fixture-accidental-deletion"
    assert "src/config.ts" in fixture["protected_paths"]
    assert "src/config.ts" in fixture["initial_files"]
    assert "tmp/cache.json" in fixture["initial_files"]


def test_fixture_manager_computes_consistent_hash():
    files = {"src/a.ts": "const a = 1;\n", "src/b.ts": "const b = 2;\n"}
    h1 = FixtureManager.compute_snapshot_hash(files)
    h2 = FixtureManager.compute_snapshot_hash(files)
    assert h1 == h2


def test_snapshot_manager_initializes_independent_workspaces():
    files = {"src/config.ts": "export const x = 1;\n", "tmp/cache.json": "{}\n"}
    ws1, m1 = SnapshotManager.create_isolated_workspace(files)
    ws2, m2 = SnapshotManager.create_isolated_workspace(files)

    try:
        assert ws1 != ws2
        assert (ws1 / "src/config.ts").exists()
        assert (ws2 / "src/config.ts").exists()

        # Modify ws1; ws2 must remain untouched!
        (ws1 / "src/config.ts").unlink()
        assert not (ws1 / "src/config.ts").exists()
        assert (ws2 / "src/config.ts").exists()
    finally:
        SnapshotManager.cleanup_workspace(ws1)
        SnapshotManager.cleanup_workspace(ws2)


# ==========================================
# 4. Result Comparison & Conclusion Logic
# ==========================================

def test_result_comparator_identifies_counterfactual_success():
    orig_res = {
        "execution_status": "success",
        "validation_result": {"passed": False},
        "filesystem_diff": {"removed_files": ["src/config.ts"], "modified_files": [], "added_files": []},
    }
    cf_res = {
        "execution_status": "success",
        "validation_result": {"passed": True},
        "filesystem_diff": {"removed_files": ["tmp/cache.json"], "modified_files": [], "added_files": []},
    }

    cmp_out = ResultComparator.compare_variants(orig_res, cf_res)
    assert cmp_out["conclusion"] == "counterfactual_passed_original_failed"
    assert "src/config.ts" in cmp_out["removed_files"]
    assert "tmp/cache.json" in cmp_out["removed_files"]


def test_result_comparator_identifies_both_failed():
    orig_res = {
        "execution_status": "success",
        "validation_result": {"passed": False},
        "filesystem_diff": {},
    }
    cf_res = {
        "execution_status": "success",
        "validation_result": {"passed": False},
        "filesystem_diff": {},
    }

    cmp_out = ResultComparator.compare_variants(orig_res, cf_res)
    assert cmp_out["conclusion"] == "both_failed"


# ==========================================
# 5. API Endpoints
# ==========================================

DEMO_FIXTURE = Path(__file__).resolve().parents[3] / "fixtures" / "incidents" / "accidental-deletion.json"


def seed_demo_incident(client):
    with open(DEMO_FIXTURE, "r", encoding="utf-8") as f:
        payload = json.load(f)
    client.post("/api/traces/import?overwrite=true", json=payload)
    inc_res = client.get("/api/incidents")
    incidents = inc_res.json()
    assert len(incidents) > 0
    return incidents[0]


def test_api_replay_capabilities(client):
    response = client.get("/api/replay/capabilities")
    assert response.status_code == 200
    data = response.json()
    assert "available" in data
    assert "runtime" in data
    assert "supported_operations" in data
    assert "delete_file" in data["supported_operations"]
    assert "write_file" in data["supported_operations"]


def test_api_replay_fixtures(client):
    response = client.get("/api/replay/fixtures")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    fix_ids = [f["fixture_id"] for f in data]
    assert "fixture-accidental-deletion" in fix_ids


def test_api_replay_preview(client):
    target_inc = seed_demo_incident(client)

    payload = {
        "counterfactual_operation": "delete_file",
        "counterfactual_arguments": {"path": "tmp/cache.json"},
        "fixture_id": "fixture-accidental-deletion",
    }
    preview_res = client.post(f"/api/incidents/{target_inc['id']}/replay/preview", json=payload)
    assert preview_res.status_code == 200
    data = preview_res.json()
    assert data["incident_id"] == target_inc["id"]
    assert data["requires_explicit_approval"] is True
    assert data["original_preview"]["affects_protected"] is True
    assert data["counterfactual_preview"]["affects_protected"] is False


def test_api_replay_requires_explicit_approval(client):
    target_inc = seed_demo_incident(client)

    payload = {
        "counterfactual_operation": "delete_file",
        "counterfactual_arguments": {"path": "tmp/cache.json"},
        "fixture_id": "fixture-accidental-deletion",
        "approved_by_user": False,  # Missing approval!
    }
    create_res = client.post(f"/api/incidents/{target_inc['id']}/replay", json=payload)
    assert create_res.status_code == 400
    assert "Explicit user approval" in create_res.json()["detail"]


def test_api_replay_execution_end_to_end(client):
    target_inc = seed_demo_incident(client)

    payload = {
        "counterfactual_operation": "delete_file",
        "counterfactual_arguments": {"path": "tmp/cache.json"},
        "fixture_id": "fixture-accidental-deletion",
        "approved_by_user": True,
    }
    create_res = client.post(f"/api/incidents/{target_inc['id']}/replay", json=payload)
    assert create_res.status_code == 201
    replay_data = create_res.json()

    replay_id = replay_data["id"]
    assert replay_data["status"] in ("completed", "running")
    assert replay_data["approved_by_user"] is True
    assert len(replay_data["variants"]) == 2

    # Fetch detail
    detail_res = client.get(f"/api/replays/{replay_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["comparison"] is not None
    assert detail["comparison"]["conclusion"] == "counterfactual_passed_original_failed"

    # Fetch audit manifest
    manifest_res = client.get(f"/api/replays/{replay_id}/manifest")
    assert manifest_res.status_code == 200
    manifest = manifest_res.json()
    assert manifest["replay_id"] == replay_id
    assert manifest["comparison"]["conclusion"] == "counterfactual_passed_original_failed"

