import json
from pathlib import Path
import pytest
from starlette.testclient import TestClient

FIXTURES_DIR = Path("/Users/oggy/RIFT/fixtures/incidents")


@pytest.fixture(autouse=True)
def seed_accidental_deletion_trace(client: TestClient):
    with open(FIXTURES_DIR / "accidental-deletion.json", "r") as f:
        data = json.load(f)
    res = client.post("/api/traces/import?overwrite=true&run_detect=true", json=data)
    assert res.status_code == 201


def test_get_execution_graph(client: TestClient):
    # Retrieve graph for seed trace
    res = client.get("/api/traces/trace-accidental-deletion-001/graph")
    assert res.status_code == 200
    graph = res.json()
    assert graph["trace_id"] == "trace-accidental-deletion-001"
    assert len(graph["nodes"]) > 0
    assert len(graph["edges"]) > 0

    # Verify semantic relationships
    relationships = {e["relationship"] for e in graph["edges"]}
    assert "parent_child" in relationships
    assert "tool_execution" in relationships

    # Verify first suspicious node is marked
    first_suspicious_nodes = [n for n in graph["nodes"] if n["is_first_suspicious"]]
    assert len(first_suspicious_nodes) > 0
    assert first_suspicious_nodes[0]["id"] == "span-demo-006"


def test_get_investigation_context(client: TestClient):
    res = client.get("/api/traces/trace-accidental-deletion-001/investigation-context")
    assert res.status_code == 200
    ctx = res.json()

    assert ctx["trace"]["id"] == "trace-accidental-deletion-001"
    assert ctx["first_suspicious_event_id"] == "span-demo-006"
    assert ctx["highest_severity"] == "Critical"
    assert ctx["stats"]["total_spans"] == 9
    assert ctx["stats"]["incident_count"] >= 1

    # Intent vs execution
    intent_vs_exec = ctx["intent_vs_execution"]
    assert intent_vs_exec["has_deviations"] is True
    assert len(intent_vs_exec["observed"]["destructive_operations"]) > 0
    assert len(intent_vs_exec["observed"]["findings"]) > 0


def test_get_event_detail_with_ancestry(client: TestClient):
    res = client.get("/api/traces/trace-accidental-deletion-001/events/span-demo-006")
    assert res.status_code == 200
    detail = res.json()

    assert detail["span"]["id"] == "span-demo-006"
    assert detail["is_first_suspicious"] is True
    assert "span-demo-005" in detail["ancestor_ids"]
    assert "span-demo-001" in detail["ancestor_ids"]
    assert "span-demo-007" in detail["child_ids"]
    assert len(detail["cited_in_detections"]) > 0


def test_graph_not_found_returns_404(client: TestClient):
    res = client.get("/api/traces/nonexistent-trace-id/graph")
    assert res.status_code == 404
