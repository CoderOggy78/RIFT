import json
from pathlib import Path
import pytest
from unittest.mock import patch, AsyncMock
from app.schemas.schemas import ModelStatusResponse

FIXTURE_PATH = Path("/Users/oggy/RIFT/fixtures/incidents/accidental-deletion.json")


def test_health_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert data["database"] == "connected"


def test_system_status_endpoint(client):
    res = client.get("/api/system/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ("operational", "degraded")
    assert "total_traces" in data
    assert "total_agents" in data


def test_import_demo_trace_successfully(client):
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)

    res = client.post("/api/traces/import?overwrite=true", json=payload)
    assert res.status_code in (200, 201)
    data = res.json()
    assert data["trace_id"] == "trace-accidental-deletion-001"
    assert data["span_count"] == 9
    assert data["status"] == "imported"


def test_idempotent_duplicate_import(client):
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)

    # First import
    res1 = client.post("/api/traces/import?overwrite=false", json=payload)
    assert res1.status_code in (200, 201)

    # Second import without overwrite -> idempotent status 'already_exists'
    res2 = client.post("/api/traces/import?overwrite=false", json=payload)
    assert res2.status_code in (200, 201)
    assert res2.json()["status"] == "already_exists"
    assert res2.json()["span_count"] == 9


def test_get_traces_list(client):
    res = client.get("/api/traces")
    assert res.status_code == 200
    traces = res.json()
    assert len(traces) >= 1
    demo = next(t for t in traces if t["id"] == "trace-accidental-deletion-001")
    assert demo["agent_name"] == "DevOps Janitor Agent"
    assert demo["project_name"] == "E-Commerce Checkout API"
    assert demo["span_count"] == 9


def test_get_trace_detail_and_spans(client):
    res = client.get("/api/traces/trace-accidental-deletion-001")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "trace-accidental-deletion-001"
    assert len(data["spans"]) == 9
    assert data["spans"][0]["id"] == "span-demo-001"
    assert data["spans"][0]["event_type"] == "user_prompt"

    # Spans endpoint
    spans_res = client.get("/api/traces/trace-accidental-deletion-001/spans")
    assert spans_res.status_code == 200
    spans = spans_res.json()
    assert len(spans) == 9


def test_reject_missing_required_fields(client):
    invalid_payload = {
        "project": {"name": "Test"},
        # missing agent and trace
    }
    res = client.post("/api/traces/import", json=invalid_payload)
    assert res.status_code == 422


def test_reject_duplicate_span_ids(client):
    payload = {
        "project": {"name": "Dup Test"},
        "agent": {"name": "Bot"},
        "trace": {
            "id": "trace-dup-spans",
            "objective": "Test duplicate span IDs",
            "started_at": "2026-10-19T10:00:00Z",
        },
        "spans": [
            {
                "id": "span-dup-1",
                "event_type": "user_prompt",
                "name": "Step 1",
                "timestamp": "2026-10-19T10:00:01Z",
            },
            {
                "id": "span-dup-1",  # Duplicate ID
                "event_type": "tool_call",
                "name": "Step 2",
                "timestamp": "2026-10-19T10:00:02Z",
            },
        ],
    }
    res = client.post("/api/traces/import", json=payload)
    assert res.status_code == 422
    assert "Duplicate span ID" in res.text


def test_reject_invalid_parent_reference(client):
    payload = {
        "project": {"name": "Bad Parent Test"},
        "agent": {"name": "Bot"},
        "trace": {
            "id": "trace-bad-parent",
            "objective": "Test bad parent span reference",
            "started_at": "2026-10-19T10:00:00Z",
        },
        "spans": [
            {
                "id": "span-1",
                "parent_span_id": "span-ghost-999",  # Non-existent parent
                "event_type": "tool_call",
                "name": "Step 1",
                "timestamp": "2026-10-19T10:00:01Z",
            }
        ],
    }
    res = client.post("/api/traces/import", json=payload)
    assert res.status_code == 422
    assert "references non-existent parent_span_id" in res.text


def test_reject_cyclic_span_hierarchy(client):
    payload = {
        "project": {"name": "Cycle Test"},
        "agent": {"name": "Bot"},
        "trace": {
            "id": "trace-cycle",
            "objective": "Test cycle detection",
            "started_at": "2026-10-19T10:00:00Z",
        },
        "spans": [
            {
                "id": "span-a",
                "parent_span_id": "span-b",  # A -> B
                "event_type": "tool_call",
                "name": "Step A",
                "timestamp": "2026-10-19T10:00:01Z",
            },
            {
                "id": "span-b",
                "parent_span_id": "span-a",  # B -> A (Cycle!)
                "event_type": "tool_result",
                "name": "Step B",
                "timestamp": "2026-10-19T10:00:02Z",
            },
        ],
    }
    res = client.post("/api/traces/import", json=payload)
    assert res.status_code == 422
    assert "Cyclic span hierarchy" in res.text


def test_sensitive_credentials_redacted(client):
    payload = {
        "project": {"name": "Secret Test"},
        "agent": {"name": "Bot"},
        "trace": {
            "id": "trace-secret-redaction",
            "objective": "Verify credentials are not stored in raw text",
            "started_at": "2026-10-19T10:00:00Z",
        },
        "spans": [
            {
                "id": "span-sec-1",
                "event_type": "tool_call",
                "name": "api_call",
                "timestamp": "2026-10-19T10:00:01Z",
                "input_data": {
                    "api_key": "sk-123456789012345678901234567890",
                    "password": "SuperSecretPassword123!",
                    "headers": {
                        "Authorization": "Bearer super-secret-jwt-token-value"
                    },
                    "safe_query": "hello world"
                },
            }
        ],
    }
    res = client.post("/api/traces/import?overwrite=true", json=payload)
    assert res.status_code in (200, 201)

    # Fetch stored span and verify redaction
    detail = client.get("/api/traces/trace-secret-redaction").json()
    stored_input = detail["spans"][0]["input_data"]
    assert stored_input["api_key"] == "[REDACTED_SENSITIVE_FIELD]"
    assert stored_input["password"] == "[REDACTED_SENSITIVE_FIELD]"
    assert "[REDACTED_SECRET]" in stored_input["headers"]["Authorization"] or stored_input["headers"]["Authorization"] == "[REDACTED_SENSITIVE_FIELD]"
    assert stored_input["safe_query"] == "hello world"


@pytest.mark.asyncio
async def test_ollama_status_unavailable(client):
    res = client.get("/api/models/status")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert data["status"] in ("ready", "connected", "model_missing", "ollama_unavailable", "not_configured")


def test_system_diagnostics_endpoint(client):
    res = client.get("/api/system/diagnostics")
    assert res.status_code == 200
    data = res.json()
    assert data["overall_status"] in ("operational", "degraded", "failed")
    assert len(data["checks"]) == 6
    subsystems = [c["subsystem"] for c in data["checks"]]
    assert "api" in subsystems
    assert "database" in subsystems
    assert "ollama" in subsystems
    assert "gemma" in subsystems
    assert "replay" in subsystems
    assert "reports" in subsystems
    assert "hardware_summary" in data


def test_reports_list_endpoint(client):
    res = client.get("/api/reports")
    assert res.status_code == 200
    reports = res.json()
    assert isinstance(reports, list)


def test_reject_activating_undownloaded_model(client):
    res = client.post(
        "/api/models/settings",
        json={"model_name": "gemma4:e4b-nonexistent", "provider": "local"}
    )
    assert res.status_code == 400
    assert "not downloaded" in res.json()["detail"].lower()


def test_synthetic_demo_lifecycle(client):
    # 1. Reset first to ensure clean state
    reset_res = client.post("/api/demo/reset")
    assert reset_res.status_code == 200

    # 2. Check status when not loaded
    status_res = client.get("/api/demo/status")
    assert status_res.status_code == 200
    assert status_res.json()["is_loaded"] is False

    # 3. Load synthetic demo
    load_res = client.post("/api/demo/load")
    assert load_res.status_code == 200
    demo_data = load_res.json()
    assert demo_data["trace_id"] == "trace-accidental-deletion-001"
    assert demo_data["is_synthetic_demo"] is True
    assert demo_data["incident_id"] is not None

    # 4. Status is now loaded
    status_after = client.get("/api/demo/status").json()
    assert status_after["is_loaded"] is True
    assert status_after["trace_id"] == "trace-accidental-deletion-001"

    # 5. Idempotent load twice does not fail or duplicate
    load_res2 = client.post("/api/demo/load")
    assert load_res2.status_code == 200
    assert load_res2.json()["trace_id"] == "trace-accidental-deletion-001"

    # 6. Reset removes demo records cleanly
    reset_res2 = client.post("/api/demo/reset")
    assert reset_res2.status_code == 200
    assert client.get("/api/demo/status").json()["is_loaded"] is False

