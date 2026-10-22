export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Agent {
  id: string;
  project_id: string;
  name: string;
  framework?: string;
  created_at: string;
}

export interface Span {
  id: string;
  trace_id: string;
  parent_span_id?: string | null;
  event_type: string; // 'user_prompt' | 'agent_plan' | 'model_call' | 'tool_call' | 'tool_result' | 'validation' | 'error'
  name: string;
  timestamp: string;
  duration_ms?: number | null;
  status: 'success' | 'error' | 'running' | 'cancelled' | string;
  input_data: Record<string, any>;
  output_data: Record<string, any>;
  error_data: Record<string, any>;
  metadata_payload: Record<string, any>;
}

export interface TraceSummary {
  id: string;
  project_id: string;
  project_name: string;
  agent_id: string;
  agent_name: string;
  objective: string;
  status: 'running' | 'success' | 'error' | 'failed' | 'completed' | string;
  started_at: string;
  ended_at?: string | null;
  duration_ms?: number | null;
  span_count: number;
  incident_count?: number;
  created_at: string;
}

export interface TraceDetail {
  id: string;
  project_id: string;
  project_name: string;
  agent_id: string;
  agent_name: string;
  agent_framework?: string | null;
  objective: string;
  status: string;
  started_at: string;
  ended_at?: string | null;
  duration_ms?: number | null;
  created_at: string;
  spans: Span[];
}

export interface HealthStatus {
  status: string;
  version: string;
  environment: string;
  database: string;
}

export interface SystemStatus {
  status: string;
  version: string;
  database_connected: boolean;
  total_traces: number;
  total_agents: number;
  total_projects: number;
  total_incidents: number;
  total_investigations: number;
  total_replays: number;
  ollama_status: 'connected' | 'model_missing' | 'ollama_unavailable' | 'not_configured' | string;
  configured_model: string;
}

export interface DemoLoadResponse {
  trace_id: string;
  incident_id?: string | null;
  title: string;
  is_synthetic_demo: boolean;
  status: string;
  message: string;
}

export interface DemoStatusResponse {
  is_loaded: boolean;
  trace_id?: string | null;
  incident_id?: string | null;
  title: string;
  is_synthetic_demo: boolean;
}

export interface ModelHardwareInfo {
  chip: string;
  memory_total_gb: number;
  os: string;
  os_version: string;
  arch: string;
  is_apple_silicon: boolean;
  disk_free_gb?: number | null;
}

export interface ModelStatus {
  status: 'ready' | 'connected' | 'model_missing' | 'ollama_unavailable' | 'not_configured' | string;
  configured_model: string;
  available_models: string[];
  ollama_base_url: string;
  message: string;
  provider?: 'local' | 'cloud' | string;
  ollama_version?: string | null;
  hardware_info?: ModelHardwareInfo | null;
  error_message?: string | null;
  setup_instructions?: string | string[] | null;
  installed_models?: string[];
  recommended_spec?: any;
  reachable?: boolean;
  model_available?: boolean;
  model_spec?: {
    display_name: string;
    parameter_size: string;
    recommended_context_tokens: number;
  } | null;
}

export interface ModelSettings {
  configured_model: string;
  provider: 'local' | 'cloud' | string;
  ollama_base_url: string;
  available_models: string[];
  is_model_installed: boolean;
  cloud_configured: boolean;
  message: string;
}

export interface ModelSettingsUpdate {
  model_name: string;
  provider: 'local' | 'cloud';
  api_key?: string;
  cloud_consent_acknowledged: boolean;
}

export interface TraceImportResponse {
  trace_id: string;
  status: 'imported' | 'already_exists';
  span_count: number;
  message: string;
}

export interface EvidenceReference {
  id: string;
  detection_id: string;
  trace_id: string;
  event_id: string;
  evidence_type: string;
  description: string;
}

export interface Detection {
  id: string;
  incident_id: string;
  trace_id: string;
  rule_id: string;
  title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational' | string;
  verification_status: 'CONFIRMED' | 'SUSPECTED' | 'DISPROVED' | 'UNKNOWN' | string;
  details: Record<string, any>;
  created_at: string;
  evidence: EvidenceReference[];
}

export interface Incident {
  id: string;
  trace_id: string;
  title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational' | string;
  status: 'open' | 'investigating' | 'resolved' | 'closed' | string;
  first_suspicious_event_id?: string | null;
  created_at: string;
  updated_at: string;
  agent_name: string;
  project_name: string;
  detection_count: number;
}

export interface IncidentDetail {
  id: string;
  trace_id: string;
  title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational' | string;
  status: 'open' | 'investigating' | 'resolved' | 'closed' | string;
  first_suspicious_event_id?: string | null;
  created_at: string;
  updated_at: string;
  agent_id: string;
  agent_name: string;
  agent_framework?: string | null;
  project_id: string;
  project_name: string;
  trace_objective: string;
  detections: Detection[];
}

export interface DetectionRule {
  rule_id: string;
  name: string;
  description: string;
  default_severity: string;
}

export interface DetectionSummary {
  total_incidents: number;
  critical_incidents: number;
  high_incidents: number;
  open_incidents: number;
  resolved_incidents: number;
  traces_with_incidents: number;
}

// ==========================================
// Phase 3: Investigation Workspace Types
// ==========================================

export interface GraphNodeData {
  id: string;
  label: string;
  event_type: string;
  status: string;
  duration_ms?: number | null;
  timestamp: string;
  tool_name?: string | null;
  is_suspicious: boolean;
  severity?: string | null;
  rule_ids: string[];
  is_first_suspicious: boolean;
  incident_id?: string | null;
  parent_span_id?: string | null;
  depth: number;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  relationship: 'parent_child' | 'tool_execution' | 'validation_dependency' | 'sequence' | 'inferred_causal' | string;
  label?: string | null;
  is_flagged: boolean;
}

export interface ExecutionGraph {
  trace_id: string;
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  root_event_ids: string[];
}

export interface IntentData {
  user_objective: string;
  explicit_instructions: string[];
  declared_plan?: string | null;
}

export interface ObservedExecution {
  destructive_operations: Array<{
    event_id: string;
    tool: string;
    target_path: string;
    timestamp: string;
    status: string;
    is_protected: boolean;
  }>;
  failed_operations: Array<{
    event_id: string;
    name: string;
    event_type: string;
    status: string;
    error: any;
    timestamp: string;
  }>;
  failed_validations: Array<{
    event_id: string;
    name: string;
    output: any;
    timestamp: string;
  }>;
  unexpected_state_changes: Array<{
    event_id: string;
    name: string;
    data: any;
  }>;
  findings: Array<{
    rule_id: string;
    title: string;
    severity: string;
    description: string;
    verification_status: string;
    evidence_events: string[];
  }>;
}

export interface IntentVsExecution {
  intent: IntentData;
  observed: ObservedExecution;
  has_deviations: boolean;
}

export interface InvestigationStats {
  total_spans: number;
  failed_spans: number;
  suspicious_spans: number;
  incident_count: number;
}

export interface InvestigationContext {
  trace: TraceDetail;
  incidents: Incident[];
  detections: Detection[];
  first_suspicious_event_id?: string | null;
  highest_severity?: string | null;
  intent_vs_execution: IntentVsExecution;
  stats: InvestigationStats;
}

export interface EventDetail {
  span: Span;
  ancestor_ids: string[];
  child_ids: string[];
  descendant_ids: string[];
  cited_in_detections: Detection[];
  is_first_suspicious: boolean;
}

// ==========================================
// Phase 4: Gemma AI Investigation Types
// ==========================================

export interface ModelTestResult {
  success: boolean;
  status: string;
  model_name?: string | null;
  response_snippet?: string | null;
  duration_ms?: number | null;
  message: string;
  setup_instructions?: string | null;
}

export interface InvestigationEvidenceItem {
  id: string;
  investigation_id: string;
  hypothesis_id: string;
  event_id: string;
  relationship: 'supporting' | 'contradicting' | 'contextual' | string;
  explanation?: string | null;
}

export interface HypothesisItem {
  id: string;
  investigation_id: string;
  title: string;
  explanation: string;
  confidence_level: 'high' | 'medium' | 'low' | string;
  verification_status: 'supported' | 'partially_supported' | 'unverified' | 'contradicted' | string;
  suggested_check?: string | null;
  rank: number;
  missing_evidence: string[];
  evidence: InvestigationEvidenceItem[];
}

export interface RemediationItem {
  id: string;
  investigation_id: string;
  description: string;
  rationale?: string | null;
  risk_level: 'low' | 'medium' | 'high' | string;
  verification_method?: string | null;
  requires_human_approval: boolean;
}

export interface Investigation {
  id: string;
  incident_id: string;
  trace_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  model_name: string;
  prompt_version: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration_ms?: number | null;
  failure_code?: string | null;
  failure_message?: string | null;
  created_at: string;
  summary?: string | null;
  observed_failure?: string | null;
  first_suspicious_event_id?: string | null;
  conclusion_status?: 'conclusive' | 'partially_conclusive' | 'inconclusive' | string | null;
  evidence_count: number;
  is_truncated: boolean;
}

export interface InvestigationDetail extends Investigation {
  hypotheses: HypothesisItem[];
  evidence_items: InvestigationEvidenceItem[];
  remediation_suggestions: RemediationItem[];
  incident?: Incident | null;
  trace?: TraceSummary | null;
}

export interface InvestigationStatusUpdate {
  id: string;
  incident_id: string;
  status: string;
  duration_ms?: number | null;
  failure_code?: string | null;
  failure_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

// ==========================================
// Phase 5: Counterfactual Replay Types
// ==========================================

export interface ReplayCapabilities {
  available: boolean;
  runtime: string;
  message: string;
  reason?: string | null;
  supported_operations: string[];
  setup_instructions?: string | null;
  security_constraints: {
    no_host_execution: boolean;
    unprivileged_user: string;
    network_mode: string;
    read_only_root: boolean;
    cap_drop: string[];
    memory_limit: string;
    cpu_limit: number;
    timeout_seconds: number;
  };
}

export interface ReplayFixture {
  fixture_id: string;
  title: string;
  description: string;
  incident_id?: string | null;
  original_event_id?: string | null;
  allowed_operations: string[];
  protected_paths: string[];
  permitted_paths: string[];
  initial_file_count: number;
  snapshot_integrity_hash?: string | null;
}

export interface ReplayPreview {
  incident_id: string;
  incident_title: string;
  original_event_id: string;
  fixture: {
    fixture_id: string;
    title: string;
    description: string;
    protected_paths: string[];
    permitted_paths: string[];
    initial_files: string[];
  };
  original_preview: {
    operation: string;
    arguments: Record<string, any>;
    target_paths: string[];
    affects_protected: boolean;
    matching_protected_rule?: string | null;
  };
  counterfactual_preview: {
    operation: string;
    arguments: Record<string, any>;
    target_paths: string[];
    affects_protected: boolean;
    matching_protected_rule?: string | null;
  };
  sandbox_capabilities: ReplayCapabilities;
  can_execute: boolean;
  requires_explicit_approval: boolean;
}

export interface ReplayVariant {
  id: string;
  replay_id: string;
  variant_type: 'original' | 'counterfactual' | string;
  operation_type: 'delete_file' | 'write_file' | 'move_file' | 'run_validation' | string;
  validated_arguments: Record<string, any>;
  execution_status: 'pending' | 'success' | 'failed' | 'skipped' | string;
  validation_status: 'pending' | 'passed' | 'failed' | 'skipped' | string;
  duration_ms?: number | null;
  error_message?: string | null;
}

export interface ReplayComparison {
  id: string;
  replay_id: string;
  original_validation_status: 'passed' | 'failed' | 'skipped' | string;
  counterfactual_validation_status: 'passed' | 'failed' | 'skipped' | string;
  changed_files: string[];
  removed_files: string[];
  added_files: string[];
  conclusion:
    | 'counterfactual_passed_original_failed'
    | 'both_failed'
    | 'both_passed'
    | 'counterfactual_introduced_failures'
    | 'safety_violation'
    | 'inconclusive'
    | string;
  details: {
    original_execution_status?: string;
    counterfactual_execution_status?: string;
    original_operation_error?: string | null;
    counterfactual_operation_error?: string | null;
    original_diff?: {
      added_files: string[];
      removed_files: string[];
      modified_files: string[];
      unchanged_files: string[];
      file_diffs: Record<string, { pre_hash?: string; post_hash?: string; diff?: string | null }>;
    };
    counterfactual_diff?: {
      added_files: string[];
      removed_files: string[];
      modified_files: string[];
      unchanged_files: string[];
      file_diffs: Record<string, { pre_hash?: string; post_hash?: string; diff?: string | null }>;
    };
  };
}

export interface Replay {
  id: string;
  incident_id: string;
  investigation_id?: string | null;
  original_event_id: string;
  status: 'pending' | 'approved' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  fixture_id: string;
  approved_by_user: boolean;
  approved_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  created_at: string;
  variants: ReplayVariant[];
  comparison?: ReplayComparison | null;
}

// ==========================================
// System Diagnostics & Reports Types
// ==========================================

export interface DiagnosticCheckItem {
  name: string;
  subsystem: string;
  status: 'operational' | 'degraded' | 'failed' | 'disabled';
  latency_ms?: number | null;
  details: Record<string, any>;
  message: string;
  actionable_remediation?: string | null;
}

export interface SystemDiagnostics {
  overall_status: 'operational' | 'degraded' | 'failed';
  timestamp: string;
  checks: DiagnosticCheckItem[];
  hardware_summary: {
    os?: string;
    os_version?: string;
    arch?: string;
    chip?: string;
    memory_total_gb?: number;
    is_apple_silicon?: boolean;
    disk_free_gb?: number;
  };
}

export interface ReportItem {
  investigation_id: string;
  incident_id: string;
  trace_id: string;
  title: string;
  severity: string;
  status: string;
  conclusion_status?: string | null;
  model_name: string;
  duration_ms?: number | null;
  created_at: string;
  evidence_count: number;
  has_replay: boolean;
  markdown_url: string;
  json_url: string;
}

// ==========================================
// Codebase Knowledge (Graphify) Types
// ==========================================

export interface CodeKnowledgeStatus {
  status: 'disabled' | 'not_installed' | 'graph_not_generated' | 'ready' | 'updating' | 'error';
  is_enabled: boolean;
  is_installed: boolean;
  graphify_version?: string | null;
  graph_path?: string | null;
  schema_version?: number | null;
  node_count: number;
  edge_count: number;
  community_count: number;
  last_updated_at?: string | null;
  message: string;
}

export interface CodeKnowledgeNode {
  id: string;
  label: string;
  file_type?: string | null;
  source_file?: string | null;
  source_location?: string | null;
  community?: number | null;
  community_name?: string | null;
  degree?: number | null;
  is_callable?: boolean | null;
  is_class?: boolean | null;
  origin?: string | null;
  norm_label?: string | null;
}

export interface CodeKnowledgeEdge {
  source: string;
  target: string;
  relation: string;
  confidence: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS' | string;
  confidence_score: number;
  source_file?: string | null;
  source_location?: string | null;
  context?: string | null;
  weight?: number;
}

export interface CodeCommunitySummary {
  id: number;
  name: string;
  node_count: number;
  top_symbols: string[];
}

export interface CodeKnowledgeGraphResponse {
  status: string;
  nodes: CodeKnowledgeNode[];
  edges: CodeKnowledgeEdge[];
  total_nodes: number;
  total_edges: number;
  communities: CodeCommunitySummary[];
  duration_ms: number;
  message?: string | null;
}

export interface CodeKnowledgeQueryResult {
  query: string;
  status: string;
  nodes: CodeKnowledgeNode[];
  edges: CodeKnowledgeEdge[];
  raw_summary?: string | null;
  duration_ms?: number | null;
}

export interface CodeKnowledgeExplainResult {
  symbol: string;
  node?: CodeKnowledgeNode | null;
  incoming_edges: CodeKnowledgeEdge[];
  outgoing_edges: CodeKnowledgeEdge[];
  raw_output?: string | null;
}

export interface CodeCitation {
  file_path: string;
  line_number?: number | null;
  symbol?: string | null;
  verified: boolean;
  notes?: string | null;
}

export interface FilePreview {
  file_path: string;
  line_number?: number | null;
  total_lines: number;
  content_snippet: string;
  start_line: number;
  end_line: number;
}

export type ImpactStatus =
  | 'POTENTIAL IMPACT'
  | 'CHANGE OBSERVED'
  | 'VALIDATION FAILED'
  | 'REGRESSION CONFIRMED'
  | 'UNVERIFIED'
  | 'NO FAILURE OBSERVED';

export interface FileOperationEvent {
  event_id?: string;
  span_id: string;
  trace_id: string;
  timestamp?: string | null;
  operation: 'create' | 'modify' | 'delete' | 'move' | string;
  operation_type?: string;
  tool_name?: string;
  raw_path?: string;
  file_path?: string;
  normalized_path?: string | null;
  is_valid_path?: boolean;
  invalidation_reason?: string | null;
  execution_status?: 'success' | 'error' | 'attempted' | 'confirmed' | string;
  agent_name?: string | null;
}

export interface DiscoveredTestSuite {
  test_id: string;
  test_file: string;
  framework?: 'pytest' | 'vitest' | string;
  relationship_to_target?: string;
  command: string | string[];
  status?: ImpactStatus | string;
  test_name?: string;
  test_type?: string;
  relevance?: string;
  exists_on_disk?: boolean;
}

export interface ValidationRunRequest {
  test_id: string;
  confirm: boolean;
  compare_baseline?: boolean;
}

export interface ValidationRunResult {
  test_id: string;
  test_file?: string;
  command: string[] | string;
  confirmed?: boolean;
  exit_code: number;
  passed: boolean;
  stdout?: string;
  stdout_snippet?: string;
  stderr?: string;
  stderr_snippet?: string;
  duration_ms: number;
  status: ImpactStatus | string;
  attribution_explanation?: string;
  attribution_notes?: string;
  disclaimer?: string;
  comparison_to_baseline?: string;
  executed_at?: string;
}

export interface CodeImpactRelationship {
  source: string;
  target: string;
  relation: string;
  direction: 'incoming' | 'outgoing';
  depth: number;
  confidence: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS' | string;
  confidence_score: number;
  source_file?: string | null;
  source_location?: string | null;
  target_file?: string | null;
  target_location?: string | null;
  relevance_explanation: string;
  impact_status?: ImpactStatus | string;
  dependency_path?: string[] | string;
}

export interface CodeImpactDependent {
  name: string;
  type: string;
  file_path?: string;
  depth: number;
  is_direct: boolean;
  relation: string;
  provenance: string;
  dependency_path?: string | string[];
  impact_status?: string;
}

export interface CodeImpactResult {
  target: string;
  target_type: 'file' | 'symbol' | 'unknown' | string;
  target_node?: CodeKnowledgeNode | null;
  change_type: string;
  status: 'success' | 'not_found' | 'disabled' | 'unavailable' | 'error';
  direct_impact_count: number;
  transitive_impact_count: number;
  affected_files: string[];
  affected_symbols: string[];
  relationships: CodeImpactRelationship[];
  summary: string;
  limitations: string[];
  graph_freshness?: string | null;
  duration_ms: number;
  triggering_event?: FileOperationEvent | null;
  file_operation?: FileOperationEvent | null;
  available?: boolean;
  agent_run_id?: string | null;
  impact_status?: ImpactStatus | string;
  discovered_tests?: DiscoveredTestSuite[];
  validation_results?: ValidationRunResult[];
  dependents?: CodeImpactDependent[];
  total_dependents?: number;
  direct_dependents?: number;
  transitive_dependents?: number;
}

export type CodeImpactResponse = CodeImpactResult;

export interface IncidentCodeImpactResult {
  incident_id: string;
  trace_id: string;
  status: 'ready' | 'no_file_operations' | 'disabled' | 'unavailable' | 'error';
  touched_files: string[];
  impacts: CodeImpactResult[];
  total_affected_files: number;
  total_affected_symbols: number;
  discovered_tests?: DiscoveredTestSuite[];
  validation_results?: ValidationRunResult[];
  summary: string;
  evidence_provenance?: Record<string, string>;
}

export interface TraceCodeImpactResult {
  trace_id: string;
  agent_id?: string | null;
  agent_name?: string | null;
  project_id?: string | null;
  status: 'ready' | 'no_file_operations' | 'disabled' | 'unavailable' | 'error';
  file_operations: FileOperationEvent[];
  impacts: CodeImpactResult[];
  total_file_operations: number;
  total_affected_files: number;
  total_affected_symbols: number;
  discovered_tests?: DiscoveredTestSuite[];
  validation_results?: ValidationRunResult[];
  summary: string;
  evidence_provenance?: Record<string, string>;
  graph_freshness?: string | null;
  available?: boolean;
}





