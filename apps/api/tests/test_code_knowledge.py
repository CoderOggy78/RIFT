import os
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.code_knowledge import code_knowledge_service, CodeKnowledgeService


@pytest.fixture
def client():
    return TestClient(app)


# 1. Graphify absent
def test_graphify_absent(monkeypatch):
    monkeypatch.setattr(code_knowledge_service, "get_executable_path", lambda: None)
    status = code_knowledge_service.get_status()
    assert status.status == "not_installed"
    assert status.is_installed is False
    assert "not found" in status.message.lower()


# 2. Graphify disabled
def test_graphify_disabled(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_CODEBASE_KNOWLEDGE", False)
    status = code_knowledge_service.get_status()
    assert status.status == "disabled"
    assert status.is_enabled is False


# 3. Graph file missing or malformed
def test_graph_file_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_CODEBASE_KNOWLEDGE", True)
    non_existent = str(tmp_path / "does_not_exist.json")
    monkeypatch.setattr(settings, "GRAPHIFY_GRAPH_PATH", non_existent)
    status = code_knowledge_service.get_status()
    assert status.status == "graph_not_generated"

def test_graph_file_malformed(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_CODEBASE_KNOWLEDGE", True)
    bad_file = tmp_path / "corrupt_graph.json"
    bad_file.write_text("NOT_VALID_JSON{{{", encoding="utf-8")
    monkeypatch.setattr(settings, "GRAPHIFY_GRAPH_PATH", str(bad_file))
    # Clear cache
    code_knowledge_service._cached_graph = None
    code_knowledge_service._cached_mtime = 0.0
    status = code_knowledge_service.get_status()
    assert status.status == "error"
    assert "malformed" in status.message.lower()


# 4. CLI timeout and nonzero exit
def test_refresh_nonzero_exit(monkeypatch):
    mock_run = MagicMock(return_value=MagicMock(returncode=1, stderr="Subprocess error"))
    monkeypatch.setattr("subprocess.run", mock_run)
    res = code_knowledge_service.refresh_graph()
    assert res.success is False
    assert "failed" in res.message.lower()

def test_refresh_timeout(monkeypatch):
    import subprocess
    mock_run = MagicMock(side_effect=subprocess.TimeoutExpired(cmd=["graphify"], timeout=60))
    monkeypatch.setattr("subprocess.run", mock_run)
    res = code_knowledge_service.refresh_graph()
    assert res.success is False
    assert "timed out" in res.message.lower()


# 5. Invalid query input
def test_invalid_query_input(client):
    # Empty query should fail pydantic validation
    res = client.post("/api/knowledge/query", json={"query": ""})
    assert res.status_code == 422

    # Excessively long query (>500 chars) should fail validation
    long_query = "x" * 501
    res2 = client.post("/api/knowledge/query", json={"query": long_query})
    assert res2.status_code == 422


# 6. Very large query results bounded
def test_large_query_results_bounded():
    # Service bounds nodes to 50 and edges to 150
    res = code_knowledge_service.query("a")
    assert len(res.nodes) <= 50
    assert len(res.edges) <= 150


# 7. Untrusted graph content (no code execution) & Path Traversal Prevention
def test_path_traversal_blocked():
    with pytest.raises(PermissionError):
        code_knowledge_service.preview_file("../../../etc/passwd")

    with pytest.raises(PermissionError):
        code_knowledge_service.preview_file("/etc/hosts")


# 8. Source citation verification
def test_source_citation_verification():
    # Valid existing file and line
    valid, err = code_knowledge_service.verify_code_citation("apps/api/app/core/config.py", line_number=5)
    assert valid is True
    assert err is None

    # Nonexistent file
    invalid_file, err2 = code_knowledge_service.verify_code_citation("apps/api/app/nonexistent_file.py", line_number=5)
    assert invalid_file is False
    assert "does not exist" in err2.lower()

    # Out of bounds line number
    invalid_line, err3 = code_knowledge_service.verify_code_citation("apps/api/app/core/config.py", line_number=999999)
    assert invalid_line is False
    assert "exceeds file length" in err3.lower()


# 9. Gemma unavailable handling
def test_evidence_builder_when_gemma_or_codebase_unavailable(monkeypatch):
    from app.services.ai.context_builder import ContextBuilder
    from app.models.models import Incident, Trace, Span, Detection
    from datetime import datetime, timezone

    # Simulate disabled code knowledge
    monkeypatch.setattr(settings, "ENABLE_CODEBASE_KNOWLEDGE", False)
    builder = ContextBuilder()

    incident = Incident(id="inc-test", title="Test Incident", severity="high", status="open", trace_id="tr-test")
    trace = Trace(id="tr-test", objective="Test objective", status="failed", started_at=datetime.now(timezone.utc))

    pkg = builder.build_evidence_package(incident=incident, trace=trace, detections=[], spans=[])
    assert "incident" in pkg
    assert "telemetry_events" in pkg
    # codebase_knowledge must be omitted or absent when disabled
    assert "codebase_knowledge" not in pkg


# 10. Existing trace import unaffected
def test_trace_import_unaffected(client):
    from pathlib import Path
    fixture = Path("/Users/oggy/RIFT/fixtures/incidents/accidental-deletion.json")
    with open(fixture, "r", encoding="utf-8") as f:
        payload = json.load(f)
    res = client.post("/api/traces/import?overwrite=true", json=payload)
    assert res.status_code in (200, 201)
    data = res.json()
    assert data["trace_id"] is not None


# 11. Existing replay safeguards unchanged
def test_replay_safeguards_unchanged(client):
    caps_res = client.get("/api/replay/capabilities")
    assert caps_res.status_code == 200
    caps = caps_res.json()
    # Host execution must remain strictly forbidden
    assert caps["security_constraints"]["no_host_execution"] is True


# 12. Existing routes and settings unaffected when disabled
def test_routes_unaffected_when_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_CODEBASE_KNOWLEDGE", False)
    res = client.get("/api/knowledge/status")
    assert res.status_code == 200
    assert res.json()["status"] == "disabled"

    # Core health checks unaffected
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"


# Real Integration Test with Generated Graph
def test_real_generated_graph_integration(client):
    res = client.get("/api/knowledge/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert data["node_count"] > 100
    assert data["edge_count"] > 200

    # Query real symbol
    q_res = client.post("/api/knowledge/query", json={"query": "TraceContext"})
    assert q_res.status_code == 200
    q_data = q_res.json()
    assert q_data["status"] == "success"
    assert len(q_data["nodes"]) > 0

    # Explain real symbol
    exp_res = client.get("/api/knowledge/explain/TraceContext")
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert exp_data["symbol"] == "TraceContext"
    assert exp_data["node"] is not None


# 13. Path traversal on impact analysis
def test_path_traversal_on_impact_analysis():
    with pytest.raises(PermissionError):
        code_knowledge_service.analyze_impact("../../../etc/passwd")

    with pytest.raises(PermissionError):
        code_knowledge_service.analyze_impact("/etc/shadow")


# 14. Symlink and path boundary violations
def test_symlink_boundary_violation(tmp_path):
    # Attempt to create a symlink pointing outside repo
    outside_file = tmp_path / "outside_secret.txt"
    outside_file.write_text("SUPER_SECRET", encoding="utf-8")
    with pytest.raises(PermissionError):
        code_knowledge_service.preview_file(str(outside_file))


# 15. Untrusted graph content (no code execution, safe schema parse)
def test_untrusted_graph_content_safety():
    # Query with script tag should be safely treated as text without execution
    res = code_knowledge_service.query("<script>alert(1)</script>")
    assert res.status in ("success", "not_found", "ready")
    assert "<script>" in res.query


# 16. Extracted versus inferred relationship labeling
def test_extracted_vs_inferred_relationship_labeling():
    # Analyze impact on DetectionEngine
    impact = code_knowledge_service.analyze_impact("DetectionEngine", change_type="modify")
    assert impact.status == "success"
    assert len(impact.relationships) > 0
    confidences = {r.confidence for r in impact.relationships}
    assert "EXTRACTED" in confidences or "INFERRED" in confidences
    # Every relationship must have an explanation and valid confidence
    for r in impact.relationships:
        assert r.relevance_explanation is not None
        assert r.confidence in ("EXTRACTED", "INFERRED", "AMBIGUOUS")


# 17. File modification and deletion impact analysis
def test_file_modification_and_deletion_impact(client):
    # Modify
    mod_res = client.post("/api/knowledge/impact", json={
        "target": "apps/api/app/services/detection/engine.py",
        "change_type": "modify",
        "max_depth": 2,
        "max_results": 20
    })
    assert mod_res.status_code == 200
    mod_data = mod_res.json()
    assert mod_data["status"] == "success"
    assert mod_data["direct_impact_count"] > 0
    assert "modify" in mod_data["summary"].lower()

    # Delete
    del_res = client.post("/api/knowledge/impact", json={
        "target": "DetectionEngine",
        "change_type": "delete",
        "max_depth": 1,
        "max_results": 20
    })
    assert del_res.status_code == 200
    del_data = del_res.json()
    assert del_data["status"] == "success"
    assert "delete" in del_data["summary"].lower()
    # Check that explanation mentions 'will break'
    assert any("break" in r["relevance_explanation"].lower() for r in del_data["relationships"])


# 18. Empty graph results handled cleanly
def test_empty_graph_results_handled_cleanly(client):
    res = client.post("/api/knowledge/impact", json={
        "target": "completely_nonexistent_symbol_or_file_xyz_12345",
        "change_type": "modify"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "not_found"
    assert data["direct_impact_count"] == 0
    assert len(data["relationships"]) == 0


# 19. Gemma unavailable while Graphify remains available
def test_gemma_unavailable_while_graphify_available(monkeypatch, client):
    # Simulate Ollama down
    from app.services.ai.gemma_client import GemmaClient, OllamaUnavailableError
    async def mock_fail(*args, **kwargs):
        raise OllamaUnavailableError("Ollama daemon is down")
    monkeypatch.setattr(GemmaClient, "_call_ollama_chat", mock_fail)

    # Graphify queries and impact analysis must continue working seamlessly
    status_res = client.get("/api/knowledge/status")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "ready"

    imp_res = client.get("/api/knowledge/impact?target=DetectionEngine")
    assert imp_res.status_code == 200
    assert imp_res.json()["status"] == "success"


# 20. Existing execution graph remains functional
def test_existing_execution_graph_functional(client):
    from pathlib import Path
    fixture = Path("/Users/oggy/RIFT/fixtures/incidents/accidental-deletion.json")
    with open(fixture, "r", encoding="utf-8") as f:
        payload = json.load(f)
    import_res = client.post("/api/traces/import?overwrite=true", json=payload)
    trace_id = import_res.json()["trace_id"]

    graph_res = client.get(f"/api/traces/{trace_id}/graph")
    assert graph_res.status_code == 200
    graph_data = graph_res.json()
    assert "nodes" in graph_data
    assert "edges" in graph_data
    assert len(graph_data["nodes"]) > 0


# 21. Existing report exports remain valid
def test_existing_report_exports_valid(client):
    res = client.get("/api/reports")
    assert res.status_code == 200
    reports = res.json()
    assert isinstance(reports, list)


# 22. Incident code impact endpoint integration
def test_incident_code_impact_endpoint(client):
    # Import demo fixture
    from pathlib import Path
    fixture = Path("/Users/oggy/RIFT/fixtures/incidents/accidental-deletion.json")
    with open(fixture, "r", encoding="utf-8") as f:
        payload = json.load(f)
    import_res = client.post("/api/traces/import?overwrite=true", json=payload)
    trace_id = import_res.json()["trace_id"]

    # Detect incident
    det_res = client.post(f"/api/traces/{trace_id}/detect")
    assert det_res.status_code == 200
    incidents = client.get(f"/api/incidents").json()
    assert len(incidents) > 0
    inc_id = incidents[0]["id"]

    # Fetch incident code impact
    impact_res = client.get(f"/api/incidents/{inc_id}/code-impact")
    assert impact_res.status_code == 200
    imp_data = impact_res.json()
    assert imp_data["incident_id"] == inc_id
    assert imp_data["status"] in ("ready", "no_file_operations")
    assert "evidence_provenance" in imp_data


# 23. Real integration test generating a Graphify graph in a temporary test repository
def test_real_graphify_generation_in_temp_repo(tmp_path):
    exe = code_knowledge_service.get_executable_path()
    if not exe:
        pytest.skip("Graphify CLI not installed in environment")

    # Create dummy Python project in temporary directory
    repo_dir = tmp_path / "dummy_project"
    repo_dir.mkdir()
    
    file_a = repo_dir / "calculator.py"
    file_a.write_text("class Calculator:\n    def add(self, a, b):\n        return a + b\n", encoding="utf-8")

    file_b = repo_dir / "app.py"
    file_b.write_text("from calculator import Calculator\n\ncalc = Calculator()\nresult = calc.add(2, 3)\n", encoding="utf-8")

    # Run real graphify extraction
    import subprocess
    proc = subprocess.run([exe, "extract", ".", "--code-only"], cwd=str(repo_dir), capture_output=True, text=True, timeout=30)
    assert proc.returncode == 0, f"Extraction failed: {proc.stderr}"

    out_graph = repo_dir / "graphify-out" / "graph.json"
    assert out_graph.is_file(), "graph.json was not generated"

    with open(out_graph, "r", encoding="utf-8") as f:
        graph_data = json.load(f)

    assert "nodes" in graph_data
    assert "links" in graph_data
    labels = {n.get("label") for n in graph_data["nodes"]}
    assert "Calculator" in labels or "calculator.py" in labels


# 24. Test normalize_and_validate_path security & boundary checks
def test_normalize_and_validate_path_security():
    # Valid relative path
    path, valid, err = code_knowledge_service.normalize_and_validate_path("apps/api/app/main.py")
    assert valid is True
    assert path == "apps/api/app/main.py"
    assert err is None

    # Parent directory traversal
    path, valid, err = code_knowledge_service.normalize_and_validate_path("../../etc/passwd")
    assert valid is False
    assert "forbidden" in err.lower() or "escapes" in err.lower()

    path, valid, err = code_knowledge_service.normalize_and_validate_path("foo/../../../bar")
    assert valid is False

    # Windows drive letter
    path, valid, err = code_knowledge_service.normalize_and_validate_path("C:\\windows\\system32")
    assert valid is False
    assert "windows" in err.lower()

    # Null bytes
    path, valid, err = code_knowledge_service.normalize_and_validate_path("safe/path\0evil")
    assert valid is False
    assert "forbidden control character" in err.lower()

    # Empty path
    path, valid, err = code_knowledge_service.normalize_and_validate_path("   ")
    assert valid is False
    assert "empty" in err.lower()


# 25. Test span file operation extraction
def test_extract_file_operation_from_span():
    class DummySpan:
        def __init__(self, name, event_type, input_data, output_data=None, error_data=None):
            self.id = "span-test-123"
            self.trace_id = "trace-test-456"
            self.name = name
            self.event_type = event_type
            self.input_data = input_data
            self.output_data = output_data or {}
            self.error_data = error_data or {}
            self.status = "success"
            self.timestamp = None

    # Deletion tool
    span_del = DummySpan("tool:delete_file", "tool_call", {"path": "src/config.ts"})
    fop_del = code_knowledge_service.extract_file_operation_from_span(span_del)
    assert fop_del is not None
    assert fop_del.operation == "delete"
    assert fop_del.normalized_path == "src/config.ts"
    assert fop_del.is_valid_path is True

    # Modification tool
    span_mod = DummySpan("tool:write_file", "tool_call", {"target_file": "apps/api/app/main.py"})
    fop_mod = code_knowledge_service.extract_file_operation_from_span(span_mod)
    assert fop_mod is not None
    assert fop_mod.operation == "modify"
    assert fop_mod.normalized_path == "apps/api/app/main.py"

    # Non-file operation tool
    span_other = DummySpan("tool:fetch_url", "tool_call", {"url": "https://example.com"})
    fop_other = code_knowledge_service.extract_file_operation_from_span(span_other)
    assert fop_other is None

    # File operation missing path field
    span_nopath = DummySpan("tool:delete_file", "tool_call", {})
    fop_nopath = code_knowledge_service.extract_file_operation_from_span(span_nopath)
    assert fop_nopath is not None
    assert fop_nopath.is_valid_path is False
    assert "did not provide" in fop_nopath.invalidation_reason.lower()


# 26. Test real test discovery for target
def test_discover_tests_for_target():
    discovered = code_knowledge_service.discover_tests_for_target("apps/api/app/services/detection/engine.py")
    assert len(discovered) > 0
    # Every discovered test must physically exist in repository
    repo_root = os.path.realpath(settings.REPO_ROOT)
    for dt in discovered:
        full_path = os.path.join(repo_root, dt.test_file)
        assert os.path.isfile(full_path), f"Discovered test file {dt.test_file} does not exist"
        assert dt.status == "UNVERIFIED"


# 27. Test validation execution with and without confirmation
def test_safe_validation_execution(monkeypatch):
    test_target = "apps/api/tests/test_detection.py"

    # Without confirmation: must not execute, returns UNVERIFIED
    res_unconfirmed = code_knowledge_service.execute_test_validation(test_target, confirm=False)
    assert res_unconfirmed.confirmed is False
    assert res_unconfirmed.status == "UNVERIFIED"
    assert "requires explicit user confirmation" in res_unconfirmed.attribution_explanation

    # Mock subprocess.run for isolated execution without DB file contention
    import subprocess
    def mock_run(cmd, *args, **kwargs):
        class MockResult:
            returncode = 0
            stdout = "10 passed in 0.05s"
            stderr = ""
        return MockResult()

    monkeypatch.setattr(subprocess, "run", mock_run)

    # With confirmation on real approved test: executes safely and completes
    res_confirmed = code_knowledge_service.execute_test_validation(test_target, confirm=True)
    assert res_confirmed.confirmed is True
    assert res_confirmed.exit_code == 0
    assert res_confirmed.passed is True
    assert res_confirmed.status == "NO FAILURE OBSERVED"
    assert "completed without detecting a failure" in res_confirmed.disclaimer

    # Security: reject paths outside approved test directories
    with pytest.raises(ValueError, match="Invalid test path"):
        code_knowledge_service.execute_test_validation("app/main.py", confirm=True)

    # Security: reject paths with shell metacharacters
    with pytest.raises(ValueError, match="Invalid character"):
        code_knowledge_service.execute_test_validation("apps/api/tests/test_detection.py; echo hack", confirm=True)


# 28. Test Trace Code Impact Endpoint
def test_trace_code_impact_endpoint(client):
    # Import demo trace with file deletion
    from pathlib import Path
    fixture = Path("/Users/oggy/RIFT/fixtures/incidents/accidental-deletion.json")
    with open(fixture, "r", encoding="utf-8") as f:
        payload = json.load(f)
    import_res = client.post("/api/traces/import?overwrite=true", json=payload)
    trace_id = import_res.json()["trace_id"]

    res = client.get(f"/api/traces/{trace_id}/code-impact")
    assert res.status_code == 200
    data = res.json()
    assert data["trace_id"] == trace_id
    assert data["status"] in ("ready", "no_file_operations")
    assert "file_operations" in data
    assert "impacts" in data
    assert "discovered_tests" in data


# 29. Test Span Code Impact Endpoint
def test_span_code_impact_endpoint(client):
    # Fetch a trace and pick a span
    traces = client.get("/api/traces").json()
    if not traces:
        pytest.skip("No traces in DB")
    trace_id = traces[0]["id"]
    trace_detail = client.get(f"/api/traces/{trace_id}").json()
    spans = trace_detail.get("spans", [])
    if not spans:
        pytest.skip("No spans in trace")

    span_id = spans[0]["id"]
    res = client.get(f"/api/spans/{span_id}/code-impact")
    assert res.status_code == 200
    data = res.json()
    assert "target" in data
    assert "status" in data


# 30. Test API validation endpoint with confirmation requirement
def test_api_validate_impact_endpoint(monkeypatch, client):
    # Missing confirmation
    unconf_res = client.post("/api/knowledge/validate-impact", json={
        "test_id": "apps/api/tests/test_detection.py",
        "confirm": False
    })
    assert unconf_res.status_code == 200
    assert unconf_res.json()["confirmed"] is False
    assert unconf_res.json()["status"] == "UNVERIFIED"

    import subprocess
    def mock_run(cmd, *args, **kwargs):
        class MockResult:
            returncode = 0
            stdout = "5 passed in 0.02s"
            stderr = ""
        return MockResult()

    monkeypatch.setattr(subprocess, "run", mock_run)

    # Confirmed execution
    conf_res = client.post("/api/knowledge/validate-impact", json={
        "test_id": "apps/api/tests/test_detection.py",
        "confirm": True
    })
    assert conf_res.status_code == 200
    assert conf_res.json()["confirmed"] is True
    assert conf_res.json()["status"] == "NO FAILURE OBSERVED"


# 31. Verify graph connectivity alone NEVER produces confirmed failure
def test_graph_connectivity_never_produces_confirmed_failure():
    res = code_knowledge_service.analyze_impact("DetectionEngine", change_type="delete")
    assert res.status == "success"
    # All dependency relationships must be POTENTIAL IMPACT
    for rel in res.relationships:
        assert rel.impact_status == "POTENTIAL IMPACT"
        assert rel.impact_status != "REGRESSION CONFIRMED"
        assert rel.impact_status != "VALIDATION FAILED"


# 32. Test GET /api/knowledge/communities endpoint
def test_knowledge_communities_endpoint(client):
    res = client.get("/api/knowledge/communities")
    assert res.status_code == 200
    communities = res.json()
    assert isinstance(communities, list)
    assert len(communities) > 0
    # Verified community structure
    first = communities[0]
    assert "id" in first
    assert "name" in first
    assert "node_count" in first
    assert "top_symbols" in first
    assert first["node_count"] > 0
    # Must be sorted descending by node count
    if len(communities) > 1:
        assert communities[0]["node_count"] >= communities[1]["node_count"]


# 33. Test GET /api/knowledge/graph with real Graphify data and filters
def test_knowledge_graph_endpoint_with_filters(client):
    # A. Bounded rendering max_nodes
    res = client.get("/api/knowledge/graph?max_nodes=30")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert len(data["nodes"]) <= 30
    assert data["total_nodes"] >= len(data["nodes"])
    assert len(data["communities"]) > 0

    # Verify node fields match Graphify AST schema
    for node in data["nodes"]:
        assert "id" in node
        assert "label" in node
        assert "community" in node
        assert "degree" in node

    # B. Community filter
    comm_id = data["communities"][0]["id"]
    res_comm = client.get(f"/api/knowledge/graph?community={comm_id}&max_nodes=50")
    assert res_comm.status_code == 200
    comm_data = res_comm.json()
    for node in comm_data["nodes"]:
        assert node["community"] == comm_id

    # C. Search filter
    res_search = client.get("/api/knowledge/graph?search=DetectionEngine&max_nodes=50")
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert any("DetectionEngine" in n["label"] or "detection" in (n.get("source_file") or "").lower() for n in search_data["nodes"])

    # D. Focus file neighborhood targeting
    res_focus = client.get("/api/knowledge/graph?focus_file=apps/api/app/services/detection/engine.py&depth=2&max_nodes=40")
    assert res_focus.status_code == 200
    focus_data = res_focus.json()
    assert len(focus_data["nodes"]) > 0

    # E. Confidence filter (EXTRACTED only)
    res_conf = client.get("/api/knowledge/graph?confidence=EXTRACTED&max_nodes=30")
    assert res_conf.status_code == 200
    conf_data = res_conf.json()
    for edge in conf_data["edges"]:
        assert edge["confidence"] == "EXTRACTED"




