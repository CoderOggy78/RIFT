import json
from pathlib import Path
import pytest
from app.services.detection.engine import DetectionEngine
from app.services.detection.registry import registry
from app.services.detection.policies import DetectionPolicy
from app.schemas.schemas import TraceImportPayload
from app.services.trace_service import TraceService

FIXTURES_DIR = Path("/Users/oggy/RIFT/fixtures/incidents")


def test_registry_contains_eight_rules():
    rules = registry.list_rules()
    assert len(rules) >= 8
    rule_ids = {r.rule_id for r in rules}
    assert "RULE-001" in rule_ids
    assert "RULE-002" in rule_ids
    assert "RULE-003" in rule_ids
    assert "RULE-004" in rule_ids
    assert "RULE-005" in rule_ids
    assert "RULE-006" in rule_ids
    assert "RULE-007" in rule_ids
    assert "RULE-008" in rule_ids


def test_rule_001_unsafe_deletion_and_traversal(client):
    # Ingest path traversal fixture
    with open(FIXTURES_DIR / "path-traversal.json", "r") as f:
        data = json.load(f)

    res = client.post("/api/traces/import?overwrite=true&run_detect=true", json=data)
    assert res.status_code == 201

    # Check detections
    det_res = client.get("/api/traces/trace-path-traversal-002/detections")
    assert det_res.status_code == 200
    detections = det_res.json()
    rule_ids = [d["rule_id"] for d in detections]
    assert "RULE-001" in rule_ids

    unsafe_det = next(d for d in detections if d["rule_id"] == "RULE-001")
    assert unsafe_det["severity"] == "Critical"
    assert "src/secrets.ts" in unsafe_det["details"]["canonical_path"]


def test_rule_002_protected_overwrite(client):
    with open(FIXTURES_DIR / "protected-overwrite.json", "r") as f:
        data = json.load(f)

    res = client.post("/api/traces/import?overwrite=true&run_detect=true", json=data)
    assert res.status_code == 201

    det_res = client.get("/api/traces/trace-protected-overwrite-003/detections")
    assert det_res.status_code == 200
    detections = det_res.json()
    rule_ids = [d["rule_id"] for d in detections]
    assert "RULE-002" in rule_ids


def test_rule_003_invalid_tool_arguments(client):
    with open(FIXTURES_DIR / "invalid-tool-arguments.json", "r") as f:
        data = json.load(f)

    res = client.post("/api/traces/import?overwrite=true&run_detect=true", json=data)
    assert res.status_code == 201

    det_res = client.get("/api/traces/trace-invalid-arguments-005/detections")
    assert det_res.status_code == 200
    detections = det_res.json()
    rule_ids = [d["rule_id"] for d in detections]
    assert "RULE-003" in rule_ids


def test_rule_005_repeated_failure_loop(client):
    with open(FIXTURES_DIR / "repeated-tool-failure.json", "r") as f:
        data = json.load(f)

    res = client.post("/api/traces/import?overwrite=true&run_detect=true", json=data)
    assert res.status_code == 201

    det_res = client.get("/api/traces/trace-repeated-tool-failure-004/detections")
    assert det_res.status_code == 200
    detections = det_res.json()
    rule_ids = [d["rule_id"] for d in detections]
    assert "RULE-005" in rule_ids


def test_rule_006_false_success_claim(client):
    with open(FIXTURES_DIR / "false-success.json", "r") as f:
        data = json.load(f)

    res = client.post("/api/traces/import?overwrite=true&run_detect=true", json=data)
    assert res.status_code == 201

    det_res = client.get("/api/traces/trace-false-success-006/detections")
    assert det_res.status_code == 200
    detections = det_res.json()
    rule_ids = [d["rule_id"] for d in detections]
    assert "RULE-006" in rule_ids


def test_rule_007_missing_validation(client):
    with open(FIXTURES_DIR / "missing-validation.json", "r") as f:
        data = json.load(f)

    res = client.post("/api/traces/import?overwrite=true&run_detect=true", json=data)
    assert res.status_code == 201

    det_res = client.get("/api/traces/trace-missing-validation-007/detections")
    assert det_res.status_code == 200
    detections = det_res.json()
    rule_ids = [d["rule_id"] for d in detections]
    assert "RULE-007" in rule_ids


def test_rule_008_unexpected_file_change(client):
    with open(FIXTURES_DIR / "unexpected-file-change.json", "r") as f:
        data = json.load(f)

    res = client.post("/api/traces/import?overwrite=true&run_detect=true", json=data)
    assert res.status_code == 201

    det_res = client.get("/api/traces/trace-unexpected-file-change-008/detections")
    assert det_res.status_code == 200
    detections = det_res.json()
    rule_ids = [d["rule_id"] for d in detections]
    assert "RULE-008" in rule_ids


def test_negative_fixture_clean_run(client):
    with open(FIXTURES_DIR / "clean-run-positive.json", "r") as f:
        data = json.load(f)

    res = client.post("/api/traces/import?overwrite=true&run_detect=true", json=data)
    assert res.status_code == 201

    # Negative fixture: must produce 0 detections and 0 incidents
    det_res = client.get("/api/traces/trace-clean-positive-011/detections")
    assert det_res.status_code == 200
    assert len(det_res.json()) == 0


def test_detection_idempotency(client):
    with open(FIXTURES_DIR / "accidental-deletion.json", "r") as f:
        data = json.load(f)

    client.post("/api/traces/import?overwrite=true", json=data)

    # First run
    run1 = client.post("/api/traces/trace-accidental-deletion-001/detect").json()
    assert len(run1) == 1

    # Second run on same trace
    run2 = client.post("/api/traces/trace-accidental-deletion-001/detect").json()
    assert len(run2) == 1
    assert run2[0]["severity"] == "Critical"
    assert run2[0]["first_suspicious_event_id"] == "span-demo-006"


def test_incidents_api_endpoints(client):
    # Fetch list
    list_res = client.get("/api/incidents")
    assert list_res.status_code == 200
    incidents = list_res.json()
    assert len(incidents) >= 1

    inc_id = incidents[0]["id"]

    # Fetch detail
    detail_res = client.get(f"/api/incidents/{inc_id}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == inc_id
    assert "detections" in detail
    assert len(detail["detections"]) >= 1

    # Fetch evidence
    ev_res = client.get(f"/api/incidents/{inc_id}/evidence")
    assert ev_res.status_code == 200
    assert isinstance(ev_res.json(), list)

    # Summary
    summary_res = client.get("/api/detection/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_incidents"] >= 1
    assert "critical_incidents" in summary
