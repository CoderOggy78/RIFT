from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict, model_validator


# ==========================================
# Ingestion Schemas
# ==========================================

class ProjectImportInput(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class AgentImportInput(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., min_length=1, max_length=255)
    framework: Optional[str] = None


class SpanImportInput(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    parent_span_id: Optional[str] = None
    event_type: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=255)
    timestamp: datetime
    duration_ms: Optional[float] = None
    status: str = Field(default="success")
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Dict[str, Any] = Field(default_factory=dict)
    error_data: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TraceInfoImportInput(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    objective: str = Field(..., min_length=1)
    status: str = Field(default="running")
    started_at: datetime
    ended_at: Optional[datetime] = None


class TraceImportPayload(BaseModel):
    project: ProjectImportInput
    agent: AgentImportInput
    trace: TraceInfoImportInput
    spans: List[SpanImportInput] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def convert_otlp_if_present(cls, data: Any) -> Any:
        if isinstance(data, dict) and ("resourceSpans" in data or "scopeSpans" in data):
            from app.services.otlp_adapter import otlp_to_rift_payload
            return otlp_to_rift_payload(data)
        return data

    @model_validator(mode="after")
    def validate_trace_payload(self) -> "TraceImportPayload":
        # 1. Enforce span limits
        if len(self.spans) > 2000:
            raise ValueError(f"Trace exceeds maximum span limit of 2000 (received {len(self.spans)})")

        # 2. Check timestamps
        if self.trace.ended_at and self.trace.ended_at < self.trace.started_at:
            raise ValueError("Trace ended_at cannot be prior to started_at")

        # 3. Check unique span IDs
        span_ids = set()
        for span in self.spans:
            if span.id in span_ids:
                raise ValueError(f"Duplicate span ID detected in trace: {span.id}")
            span_ids.add(span.id)

        # 4. Check parent-child references
        for span in self.spans:
            if span.parent_span_id:
                if span.parent_span_id == span.id:
                    raise ValueError(f"Span {span.id} cannot be its own parent")
                if span.parent_span_id not in span_ids:
                    raise ValueError(
                        f"Span {span.id} references non-existent parent_span_id '{span.parent_span_id}'"
                    )

        # 5. Cycle detection using DFS
        adjacency: Dict[str, List[str]] = {s.id: [] for s in self.spans}
        for span in self.spans:
            if span.parent_span_id:
                adjacency[span.parent_span_id].append(span.id)

        # Detect cycle in DAG (0 = unvisited, 1 = visiting, 2 = visited)
        visited: Dict[str, int] = {s.id: 0 for s in self.spans}

        def dfs(node: str) -> bool:
            visited[node] = 1
            for child in adjacency.get(node, []):
                if visited[child] == 1:
                    return True  # Cycle detected
                if visited[child] == 0:
                    if dfs(child):
                        return True
            visited[node] = 2
            return False

        for span in self.spans:
            if visited[span.id] == 0:
                if dfs(span.id):
                    raise ValueError("Cyclic span hierarchy detected in trace")

        return self


# ==========================================
# Response Schemas
# ==========================================

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentResponse(BaseModel):
    id: str
    project_id: str
    name: str
    framework: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SpanResponse(BaseModel):
    id: str
    trace_id: str
    parent_span_id: Optional[str] = None
    event_type: str
    name: str
    timestamp: datetime
    duration_ms: Optional[float] = None
    status: str
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    error_data: Dict[str, Any]
    metadata_payload: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)


class TraceSummaryResponse(BaseModel):
    id: str
    project_id: str
    project_name: str
    agent_id: str
    agent_name: str
    objective: str
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    span_count: int
    incident_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TraceDetailResponse(BaseModel):
    id: str
    project_id: str
    project_name: str
    agent_id: str
    agent_name: str
    agent_framework: Optional[str] = None
    objective: str
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    created_at: datetime
    spans: List[SpanResponse] = []
    incident_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class TraceImportResponse(BaseModel):
    trace_id: str
    status: str  # "imported" or "already_exists"
    span_count: int
    message: str


class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str
    environment: str
    database: str


class SystemStatusResponse(BaseModel):
    status: str = "operational"
    version: str
    database_connected: bool
    total_traces: int
    total_agents: int
    total_projects: int
    total_incidents: int = 0
    total_investigations: int = 0
    total_replays: int = 0
    ollama_status: str
    configured_model: str


class DemoLoadResponse(BaseModel):
    trace_id: str
    incident_id: Optional[str] = None
    title: str = "Accidental Source Deletion"
    is_synthetic_demo: bool = True
    status: str = "ready"
    message: str


class DemoStatusResponse(BaseModel):
    is_loaded: bool
    trace_id: Optional[str] = None
    incident_id: Optional[str] = None
    title: str = "Accidental Source Deletion"
    is_synthetic_demo: bool = True


class ModelStatusResponse(BaseModel):
    status: str  # "ready", "connected", "model_missing", "ollama_unavailable", "not_configured"
    configured_model: str
    available_models: List[str]
    ollama_base_url: str
    message: str
    setup_instructions: Optional[str] = None
    model_spec: Optional[Dict[str, Any]] = None
    provider: str = "local"
    ollama_version: Optional[str] = None
    hardware_info: Optional[Dict[str, Any]] = None


class ModelSettingsInput(BaseModel):
    model_name: str
    provider: Literal["local", "cloud"] = "local"
    api_key: Optional[str] = None
    cloud_consent_acknowledged: bool = False


class ModelSettingsResponse(BaseModel):
    configured_model: str
    provider: str
    ollama_base_url: str
    available_models: List[str]
    is_model_installed: bool
    cloud_configured: bool
    message: str


# ==========================================
# Phase 2: Detection & Incident Schemas
# ==========================================

class EvidenceReferenceResponse(BaseModel):
    id: str
    detection_id: str
    trace_id: str
    event_id: str
    evidence_type: str
    description: str

    model_config = ConfigDict(from_attributes=True)


class DetectionResponse(BaseModel):
    id: str
    incident_id: str
    trace_id: str
    rule_id: str
    title: str
    description: str
    severity: str
    verification_status: str
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    evidence: List[EvidenceReferenceResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class IncidentResponse(BaseModel):
    id: str
    trace_id: str
    title: str
    description: str
    severity: str
    status: str
    first_suspicious_event_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    agent_name: str
    project_name: str
    detection_count: int

    model_config = ConfigDict(from_attributes=True)


class IncidentDetailResponse(BaseModel):
    id: str
    trace_id: str
    title: str
    description: str
    severity: str
    status: str
    first_suspicious_event_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    agent_id: str
    agent_name: str
    agent_framework: Optional[str] = None
    project_id: str
    project_name: str
    trace_objective: str
    detections: List[DetectionResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class DetectionRuleResponse(BaseModel):
    rule_id: str
    name: str
    description: str
    default_severity: str

    model_config = ConfigDict(from_attributes=True)


class DetectionSummaryResponse(BaseModel):
    total_incidents: int
    critical_incidents: int
    high_incidents: int
    open_incidents: int
    resolved_incidents: int
    traces_with_incidents: int


# ==========================================
# Phase 3: Investigation Workspace Schemas
# ==========================================

class GraphNodeResponse(BaseModel):
    id: str
    label: str
    event_type: str
    status: str
    duration_ms: Optional[float] = None
    timestamp: datetime
    tool_name: Optional[str] = None
    is_suspicious: bool = False
    severity: Optional[str] = None
    rule_ids: List[str] = Field(default_factory=list)
    is_first_suspicious: bool = False
    incident_id: Optional[str] = None
    parent_span_id: Optional[str] = None
    depth: int = 0


class GraphEdgeResponse(BaseModel):
    id: str
    source: str
    target: str
    relationship: str  # "parent_child", "tool_execution", "validation_dependency", "sequence", "inferred_causal"
    label: Optional[str] = None
    is_flagged: bool = False


class ExecutionGraphResponse(BaseModel):
    trace_id: str
    nodes: List[GraphNodeResponse]
    edges: List[GraphEdgeResponse]
    root_event_ids: List[str]


class IntentDataResponse(BaseModel):
    user_objective: str
    explicit_instructions: List[str] = Field(default_factory=list)
    declared_plan: Optional[str] = None


class ObservedExecutionResponse(BaseModel):
    destructive_operations: List[Dict[str, Any]] = Field(default_factory=list)
    failed_operations: List[Dict[str, Any]] = Field(default_factory=list)
    failed_validations: List[Dict[str, Any]] = Field(default_factory=list)
    unexpected_state_changes: List[Dict[str, Any]] = Field(default_factory=list)
    findings: List[Dict[str, Any]] = Field(default_factory=list)


class IntentVsExecutionResponse(BaseModel):
    intent: IntentDataResponse
    observed: ObservedExecutionResponse
    has_deviations: bool = False


class InvestigationStatsResponse(BaseModel):
    total_spans: int
    failed_spans: int
    suspicious_spans: int
    incident_count: int


class InvestigationContextResponse(BaseModel):
    trace: TraceDetailResponse
    incidents: List[IncidentResponse] = Field(default_factory=list)
    detections: List[DetectionResponse] = Field(default_factory=list)
    first_suspicious_event_id: Optional[str] = None
    highest_severity: Optional[str] = None
    intent_vs_execution: IntentVsExecutionResponse
    stats: InvestigationStatsResponse


class EventDetailResponse(BaseModel):
    span: SpanResponse
    ancestor_ids: List[str] = Field(default_factory=list)
    child_ids: List[str] = Field(default_factory=list)
    descendant_ids: List[str] = Field(default_factory=list)
    cited_in_detections: List[DetectionResponse] = Field(default_factory=list)
    is_first_suspicious: bool = False


# ==========================================
# Phase 4: Gemma AI Investigation Schemas
# ==========================================

class InvestigationEvidenceResponse(BaseModel):
    id: str
    investigation_id: str
    hypothesis_id: str
    event_id: str
    relationship: str  # supporting, contradicting, contextual
    explanation: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class HypothesisResponse(BaseModel):
    id: str
    investigation_id: str
    title: str
    explanation: str
    confidence_level: str  # high, medium, low
    verification_status: str  # supported, partially_supported, unverified, contradicted
    suggested_check: Optional[str] = None
    rank: int = 1
    missing_evidence: List[str] = Field(default_factory=list)
    evidence: List[InvestigationEvidenceResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class RemediationResponse(BaseModel):
    id: str
    investigation_id: str
    description: str
    rationale: Optional[str] = None
    risk_level: str  # low, medium, high
    verification_method: Optional[str] = None
    requires_human_approval: bool = True

    model_config = ConfigDict(from_attributes=True)


class InvestigationResponse(BaseModel):
    id: str
    incident_id: str
    trace_id: str
    status: str  # queued, running, completed, failed, cancelled
    model_name: str
    prompt_version: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    failure_code: Optional[str] = None
    failure_message: Optional[str] = None
    created_at: datetime
    summary: Optional[str] = None
    observed_failure: Optional[str] = None
    first_suspicious_event_id: Optional[str] = None
    conclusion_status: Optional[str] = None
    evidence_count: int = 0
    is_truncated: bool = False

    model_config = ConfigDict(from_attributes=True)


class InvestigationDetailResponse(InvestigationResponse):
    hypotheses: List[HypothesisResponse] = Field(default_factory=list)
    evidence_items: List[InvestigationEvidenceResponse] = Field(default_factory=list)
    remediation_suggestions: List[RemediationResponse] = Field(default_factory=list)
    incident: Optional[IncidentResponse] = None
    trace: Optional[TraceSummaryResponse] = None


class InvestigationStatusResponse(BaseModel):
    id: str
    incident_id: str
    status: str
    duration_ms: Optional[float] = None
    failure_code: Optional[str] = None
    failure_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ModelTestResponse(BaseModel):
    success: bool
    status: str  # ready, not_configured, ollama_unavailable, model_missing, invalid_output, inference_timed_out
    model_name: Optional[str] = None
    response_snippet: Optional[str] = None
    duration_ms: Optional[float] = None
    message: str
    setup_instructions: Optional[str] = None


# ==========================================
# Phase 5: Counterfactual Replay Schemas
# ==========================================

class ReplayPreviewRequest(BaseModel):
    counterfactual_operation: str = Field(..., description="delete_file, write_file, move_file, run_validation")
    counterfactual_arguments: Dict[str, Any] = Field(default_factory=dict)
    fixture_id: Optional[str] = None


class ReplayPreviewResponse(BaseModel):
    incident_id: str
    incident_title: str
    original_event_id: str
    fixture: Dict[str, Any]
    original_preview: Dict[str, Any]
    counterfactual_preview: Dict[str, Any]
    sandbox_capabilities: Dict[str, Any]
    can_execute: bool
    requires_explicit_approval: bool = True


class ReplayCreateRequest(BaseModel):
    counterfactual_operation: str
    counterfactual_arguments: Dict[str, Any]
    fixture_id: Optional[str] = None
    approved_by_user: bool = False
    investigation_id: Optional[str] = None


class ReplayVariantResponse(BaseModel):
    id: str
    variant_type: str  # original, counterfactual
    operation_type: str
    validated_arguments: Dict[str, Any]
    execution_status: str
    validation_status: str
    duration_ms: Optional[float] = None
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReplayComparisonResponse(BaseModel):
    id: str
    original_validation_status: str
    counterfactual_validation_status: str
    changed_files: List[str]
    removed_files: List[str]
    added_files: List[str]
    conclusion: str
    details: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class ReplayResponse(BaseModel):
    id: str
    incident_id: str
    investigation_id: Optional[str] = None
    original_event_id: str
    status: str
    fixture_id: str
    approved_by_user: bool
    approved_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    failure_code: Optional[str] = None
    failure_message: Optional[str] = None
    created_at: datetime
    variants: List[ReplayVariantResponse] = Field(default_factory=list)
    comparison: Optional[ReplayComparisonResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ReplayStatusResponse(BaseModel):
    id: str
    status: str
    failure_code: Optional[str] = None
    failure_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ReplayCapabilitiesResponse(BaseModel):
    available: bool
    runtime: str
    message: str
    reason: Optional[str] = None
    supported_operations: List[str]
    setup_instructions: Optional[str] = None
    security_constraints: Dict[str, Any]


# ==========================================
# System Diagnostics & Reports Schemas
# ==========================================

class DiagnosticCheckItem(BaseModel):
    name: str
    subsystem: str
    status: Literal["operational", "degraded", "failed", "disabled"]
    latency_ms: Optional[float] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    message: str
    actionable_remediation: Optional[str] = None


class SystemDiagnosticsResponse(BaseModel):
    overall_status: Literal["operational", "degraded", "failed"]
    timestamp: datetime
    checks: List[DiagnosticCheckItem]
    hardware_summary: Dict[str, Any]


class ReportItemResponse(BaseModel):
    investigation_id: str
    incident_id: str
    trace_id: str
    title: str
    severity: str
    status: str
    conclusion_status: Optional[str] = None
    model_name: str
    duration_ms: Optional[float] = None
    created_at: datetime
    evidence_count: int = 0
    has_replay: bool = False
    markdown_url: str
    json_url: str


# ==========================================
# Codebase Knowledge (Graphify) Schemas
# ==========================================

class CodeCitation(BaseModel):
    file_path: str
    line_number: Optional[int] = None
    symbol: Optional[str] = None
    verified: bool = False
    notes: Optional[str] = None


class CodeKnowledgeStatusResponse(BaseModel):
    status: Literal["disabled", "not_installed", "graph_not_generated", "ready", "updating", "error"]
    is_enabled: bool
    is_installed: bool
    graphify_version: Optional[str] = None
    graph_path: Optional[str] = None
    schema_version: Optional[int] = None
    node_count: int = 0
    edge_count: int = 0
    community_count: int = 0
    last_updated_at: Optional[str] = None
    message: str


class CodeKnowledgeNode(BaseModel):
    id: str
    label: str
    file_type: Optional[str] = None
    source_file: Optional[str] = None
    source_location: Optional[str] = None
    community: Optional[int] = None
    community_name: Optional[str] = None
    degree: Optional[int] = None
    is_callable: Optional[bool] = Field(default=None, alias="_callable")
    is_class: Optional[bool] = Field(default=None, alias="_callable_class")
    origin: Optional[str] = Field(default=None, alias="_origin")
    norm_label: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class CodeKnowledgeEdge(BaseModel):
    source: str
    target: str
    relation: str
    confidence: str = "EXTRACTED"  # EXTRACTED, INFERRED, AMBIGUOUS
    confidence_score: float = 1.0
    source_file: Optional[str] = None
    source_location: Optional[str] = None
    context: Optional[str] = None
    weight: float = 1.0


class CodeCommunitySummary(BaseModel):
    id: int
    name: str
    node_count: int
    top_symbols: List[str] = Field(default_factory=list)


class CodeKnowledgeGraphResponse(BaseModel):
    status: str
    nodes: List[CodeKnowledgeNode] = Field(default_factory=list)
    edges: List[CodeKnowledgeEdge] = Field(default_factory=list)
    total_nodes: int = 0
    total_edges: int = 0
    communities: List[CodeCommunitySummary] = Field(default_factory=list)
    duration_ms: float = 0.0
    message: Optional[str] = None


class CodeKnowledgeQueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    seed: Optional[str] = None
    budget: int = Field(default=2000, ge=100, le=10000)


class CodeKnowledgeQueryResponse(BaseModel):
    query: str
    status: str
    nodes: List[CodeKnowledgeNode] = Field(default_factory=list)
    edges: List[CodeKnowledgeEdge] = Field(default_factory=list)
    raw_summary: Optional[str] = None
    duration_ms: Optional[float] = None


class CodeKnowledgeExplainResponse(BaseModel):
    symbol: str
    node: Optional[CodeKnowledgeNode] = None
    incoming_edges: List[CodeKnowledgeEdge] = Field(default_factory=list)
    outgoing_edges: List[CodeKnowledgeEdge] = Field(default_factory=list)
    raw_output: Optional[str] = None


class CodeKnowledgeRefreshResponse(BaseModel):
    success: bool
    message: str
    duration_ms: Optional[float] = None
    node_count: int = 0
    edge_count: int = 0


class FilePreviewResponse(BaseModel):
    file_path: str
    line_number: Optional[int] = None
    total_lines: int
    content_snippet: str
    start_line: int
    end_line: int


class ImpactStatus(str, Enum):
    POTENTIAL_IMPACT = "POTENTIAL IMPACT"
    CHANGE_OBSERVED = "CHANGE OBSERVED"
    VALIDATION_FAILED = "VALIDATION FAILED"
    REGRESSION_CONFIRMED = "REGRESSION CONFIRMED"
    UNVERIFIED = "UNVERIFIED"
    NO_FAILURE_OBSERVED = "NO FAILURE OBSERVED"


class OperationType(str, Enum):
    CREATE = "create"
    MODIFY = "modify"
    DELETE = "delete"
    MOVE = "move"
    UNKNOWN = "unknown"


class FileOperationEvent(BaseModel):
    span_id: str
    trace_id: str
    timestamp: Optional[datetime] = None
    operation: str = "modify"  # create, modify, delete, move, unknown
    tool_name: str
    raw_path: str
    normalized_path: Optional[str] = None
    is_valid_path: bool = True
    invalidation_reason: Optional[str] = None
    execution_status: str = "success"  # success, error, attempted, confirmed


class DiscoveredTestSuite(BaseModel):
    test_id: str
    test_file: str
    framework: str = "pytest"  # pytest, vitest
    relationship_to_target: str = "direct_import"  # direct_import, tested_module, naming_convention
    command: str
    status: str = "UNVERIFIED"


class ValidationRunRequest(BaseModel):
    test_id: str
    confirm: bool = False
    compare_baseline: bool = False


class ValidationRunResult(BaseModel):
    test_id: str
    test_file: str
    command: List[str]
    confirmed: bool
    exit_code: int
    passed: bool
    stdout: str = ""
    stderr: str = ""
    duration_ms: float = 0.0
    status: str = "UNVERIFIED"  # NO FAILURE OBSERVED, VALIDATION FAILED, REGRESSION CONFIRMED, UNVERIFIED
    attribution_explanation: str
    disclaimer: str = (
        "Validation completed without detecting a failure; this does not prove absence of regression."
    )


class CodeImpactRelationship(BaseModel):
    source: str
    target: str
    relation: str  # imports, calls, uses, re_exports, inherits, etc.
    direction: Literal["incoming", "outgoing"]  # incoming: target depends on source
    depth: int = 1  # 1 = direct, 2+ = transitive
    confidence: str = "EXTRACTED"  # EXTRACTED, INFERRED, AMBIGUOUS
    confidence_score: float = 1.0
    source_file: Optional[str] = None
    source_location: Optional[str] = None
    target_file: Optional[str] = None
    target_location: Optional[str] = None
    relevance_explanation: str
    impact_status: str = "POTENTIAL IMPACT"
    dependency_path: List[str] = Field(default_factory=list)


class CodeImpactRequest(BaseModel):
    target: str = Field(..., min_length=1, max_length=500, description="Repository-relative file path or symbol name")
    change_type: Optional[Literal["create", "modify", "delete", "move"]] = Field(default="modify", description="Type of code mutation")
    max_depth: int = Field(default=2, ge=1, le=5, description="Maximum traversal depth")
    max_results: int = Field(default=50, ge=1, le=200, description="Maximum number of relationships to return")


class CodeImpactResponse(BaseModel):
    target: str
    target_type: Literal["file", "symbol", "unknown"]
    target_node: Optional[CodeKnowledgeNode] = None
    change_type: str = "modify"
    status: Literal["success", "not_found", "disabled", "unavailable", "error"]
    direct_impact_count: int = 0
    transitive_impact_count: int = 0
    affected_files: List[str] = Field(default_factory=list)
    affected_symbols: List[str] = Field(default_factory=list)
    relationships: List[CodeImpactRelationship] = Field(default_factory=list)
    summary: str
    limitations: List[str] = Field(default_factory=list)
    graph_freshness: Optional[str] = None
    duration_ms: float = 0.0
    triggering_event: Optional[FileOperationEvent] = None
    agent_run_id: Optional[str] = None
    impact_status: str = "POTENTIAL IMPACT"
    discovered_tests: List[DiscoveredTestSuite] = Field(default_factory=list)
    validation_results: List[ValidationRunResult] = Field(default_factory=list)


class IncidentCodeImpactResponse(BaseModel):
    incident_id: str
    trace_id: str
    status: Literal["ready", "no_file_operations", "disabled", "unavailable", "error"]
    touched_files: List[str] = Field(default_factory=list)
    impacts: List[CodeImpactResponse] = Field(default_factory=list)
    total_affected_files: int = 0
    total_affected_symbols: int = 0
    discovered_tests: List[DiscoveredTestSuite] = Field(default_factory=list)
    validation_results: List[ValidationRunResult] = Field(default_factory=list)
    summary: str
    evidence_provenance: Dict[str, str] = Field(
        default_factory=lambda: {
            "observed_trace_event": "Telemetry event captured during agent execution",
            "extracted_ast_relationship": "Direct AST syntax relationship extracted from codebase",
            "inferred_relationship": "Semantic or heuristic relationship discovered in code graph",
            "model_hypothesis": "Gemma AI root-cause hypothesis",
            "replay_verification": "Safe sandboxed counterfactual reproduction result",
        }
    )


class TraceCodeImpactResponse(BaseModel):
    trace_id: str
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    project_id: Optional[str] = None
    status: Literal["ready", "no_file_operations", "disabled", "unavailable", "error"]
    file_operations: List[FileOperationEvent] = Field(default_factory=list)
    impacts: List[CodeImpactResponse] = Field(default_factory=list)
    total_file_operations: int = 0
    total_affected_files: int = 0
    total_affected_symbols: int = 0
    discovered_tests: List[DiscoveredTestSuite] = Field(default_factory=list)
    validation_results: List[ValidationRunResult] = Field(default_factory=list)
    summary: str
    evidence_provenance: Dict[str, str] = Field(
        default_factory=lambda: {
            "observed_trace_event": "Telemetry event captured during agent execution",
            "extracted_ast_relationship": "Direct AST syntax relationship extracted from codebase",
            "inferred_relationship": "Semantic or heuristic relationship discovered in code graph",
            "model_hypothesis": "Gemma AI root-cause hypothesis",
            "replay_verification": "Safe sandboxed counterfactual reproduction result",
        }
    )





