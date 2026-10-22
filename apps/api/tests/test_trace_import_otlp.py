import json
from pathlib import Path
import pytest
from app.services.otlp_adapter import extract_otlp_value, parse_otlp_attributes, otlp_to_rift_payload

SAMPLE_TRACE_PATH = Path("/Users/oggy/RIFT/fixtures/sample-trace.json")


def test_import_real_sample_trace_fixture(client):
    """Verify that importing the real sample-trace.json persists all 6 execution spans."""
    assert SAMPLE_TRACE_PATH.exists(), f"Fixture file not found at {SAMPLE_TRACE_PATH}"
    with open(SAMPLE_TRACE_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)

    res = client.post("/api/traces/import?overwrite=true", json=payload)
    assert res.status_code in (200, 201), f"Import failed: {res.text}"
    data = res.json()
    assert data["trace_id"] == "6e6c5404138b726863003f3a62e062b3"
    assert data["span_count"] == 6
    assert data["status"] == "imported"


def test_trace_detail_api_returns_imported_spans(client):
    """Verify trace detail endpoint returns all 6 spans with preserved IDs, parents, timestamps, and attributes."""
    with open(SAMPLE_TRACE_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)
    client.post("/api/traces/import?overwrite=true", json=payload)

    res = client.get("/api/traces/6e6c5404138b726863003f3a62e062b3")
    assert res.status_code == 200, f"Get trace failed: {res.text}"
    detail = res.json()

    assert detail["id"] == "6e6c5404138b726863003f3a62e062b3"
    assert detail["objective"] == "Remove temporary files without modifying source code"
    assert detail["agent_name"] == "cleanup-agent"
    assert detail["project_name"] == "rift-demo-agent"

    spans = detail["spans"]
    assert len(spans) == 6, f"Expected 6 spans, got {len(spans)}"

    # Span IDs preserved
    span_ids = [s["id"] for s in spans]
    expected_ids = [
        "9cb203489b2cbab7",
        "0f02669337ed36b1",
        "e556b11dcbfc452c",
        "c052a0d0e840f5ca",
        "c5cd98f7ca5d0247",
        "cd6fa3ea7b755528",
    ]
    for exp_id in expected_ids:
        assert exp_id in span_ids, f"Expected span ID {exp_id} to be preserved"

    # Hierarchy: root span has no parent, all other 5 spans point to root
    root_span = next(s for s in spans if s["id"] == "9cb203489b2cbab7")
    assert root_span["parent_span_id"] is None

    child_spans = [s for s in spans if s["id"] != "9cb203489b2cbab7"]
    for cs in child_spans:
        assert cs["parent_span_id"] == "9cb203489b2cbab7", (
            f"Expected child span {cs['id']} to reference parent 9cb203489b2cbab7, got {cs['parent_span_id']}"
        )

    # Timestamps are non-null and ISO-formatted
    for s in spans:
        assert s["timestamp"] is not None

    # Check Deletion Span attributes
    delete_span = next(s for s in spans if s["id"] == "c052a0d0e840f5ca")
    assert delete_span["input_data"]["path"] == "src/config.ts"
    assert delete_span["input_data"]["tool"] == "delete_file"
    assert delete_span["metadata_payload"]["file.deletion_reason"] == "Incorrectly selected as a cleanup target"
    assert delete_span["metadata_payload"]["security.risk"] == "high"

    # Check Validation Span error attributes
    val_span = next(s for s in spans if s["id"] == "c5cd98f7ca5d0247")
    assert val_span["status"] == "error"
    assert val_span["output_data"]["exit_code"] == 1
    assert "Cannot find module './config'" in str(val_span["output_data"].get("failure", ""))
    assert val_span["event_type"] == "validation"

    # Check Final Response Span success claim
    summary_span = next(s for s in spans if s["id"] == "cd6fa3ea7b755528")
    assert summary_span["output_data"]["claimed_success"] is True
    assert "Cleanup completed successfully" in summary_span["output_data"]["output"]


def test_otlp_detection_engine_findings(client):
    """Verify that deterministic detection flags Unsafe Deletion and False Success on imported OTLP spans."""
    with open(SAMPLE_TRACE_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)
    client.post("/api/traces/import?overwrite=true", json=payload)

    res = client.post("/api/traces/6e6c5404138b726863003f3a62e062b3/detect")
    assert res.status_code == 200
    incidents = res.json()
    assert len(incidents) >= 1
    assert "Unsafe Deletion" in incidents[0]["title"] or "config.ts" in incidents[0]["title"]

    # Verify underlying detections
    det_res = client.get("/api/traces/6e6c5404138b726863003f3a62e062b3/detections")
    assert det_res.status_code == 200
    detections = det_res.json()
    rule_ids = [d["rule_id"] for d in detections]

    # RULE-001 (Unsafe Deletion) and RULE-006 (False Success) must be detected
    assert "RULE-001" in rule_ids, f"Expected RULE-001 in detected rules, got: {rule_ids}"
    assert "RULE-006" in rule_ids, f"Expected RULE-006 in detected rules, got: {rule_ids}"


def test_otlp_upload_file_endpoint(client):
    """Verify uploading raw sample-trace.json file via multipart POST /api/traces/upload."""
    with open(SAMPLE_TRACE_PATH, "rb") as f:
        res = client.post(
            "/api/traces/upload?overwrite=true",
            files={"file": ("sample-trace.json", f, "application/json")},
        )
    assert res.status_code == 201
    data = res.json()
    assert data["trace_id"] == "6e6c5404138b726863003f3a62e062b3"
    assert data["span_count"] == 6
    assert data["status"] == "imported"


def test_idempotent_duplicate_otlp_import(client):
    """Verify duplicate import without overwrite returns already_exists status preserving records."""
    with open(SAMPLE_TRACE_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)

    # Initial import
    res1 = client.post("/api/traces/import?overwrite=true", json=payload)
    assert res1.status_code in (200, 201)

    # Duplicate import without overwrite
    res2 = client.post("/api/traces/import?overwrite=false", json=payload)
    assert res2.status_code in (200, 201)
    data = res2.json()
    assert data["status"] == "already_exists"
    assert data["trace_id"] == "6e6c5404138b726863003f3a62e062b3"
    assert data["span_count"] == 6


def test_malformed_json_and_missing_spans(client):
    """Verify that malformed JSON or payloads without spans produce informative error responses."""
    # 1. Empty resourceSpans
    empty_payload = {"resourceSpans": []}
    res = client.post("/api/traces/import?overwrite=true", json=empty_payload)
    assert res.status_code == 422
    assert "No spans found" in res.text

    # 2. Upload invalid json bytes
    res_upload = client.post(
        "/api/traces/upload",
        files={"file": ("corrupt.json", b"{not valid json", "application/json")},
    )
    assert res_upload.status_code == 400
    assert "Invalid JSON" in res_upload.text


def test_extract_otlp_value_types():
    """Verify extract_otlp_value handles stringValue, intValue, boolValue, doubleValue, arrayValue, kvlistValue."""
    assert extract_otlp_value({"stringValue": "hello"}) == "hello"
    assert extract_otlp_value({"intValue": "42"}) == 42
    assert extract_otlp_value({"intValue": 100}) == 100
    assert extract_otlp_value({"boolValue": True}) is True
    assert extract_otlp_value({"boolValue": False}) is False
    assert extract_otlp_value({"doubleValue": "3.1415"}) == 3.1415
    assert extract_otlp_value({"bytesValue": "dGVzdA=="}) == "dGVzdA=="

    array_val = {"arrayValue": {"values": [{"stringValue": "a"}, {"intValue": 2}]}}
    assert extract_otlp_value(array_val) == ["a", 2]

    kvlist_val = {
        "kvlistValue": {
            "values": [
                {"key": "foo", "value": {"stringValue": "bar"}},
                {"key": "count", "value": {"intValue": 10}},
            ]
        }
    }
    assert extract_otlp_value(kvlist_val) == {"foo": "bar", "count": 10}
