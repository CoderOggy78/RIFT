import {
  TraceSummary,
  TraceDetail,
  Span,
  HealthStatus,
  SystemStatus,
  ModelStatus,
  TraceImportResponse,
  Incident,
  IncidentDetail,
  EvidenceReference,
  Detection,
  DetectionRule,
  DetectionSummary,
  ExecutionGraph,
  InvestigationContext,
  EventDetail,
  Investigation,
  InvestigationDetail,
  InvestigationEvidenceItem,
  InvestigationStatusUpdate,
  ModelTestResult,
  ModelSettings,
  ModelSettingsUpdate,
  SystemDiagnostics,
  ReportItem,
  DemoLoadResponse,
  DemoStatusResponse,
  CodeKnowledgeStatus,
  CodeKnowledgeQueryResult,
  CodeKnowledgeExplainResult,
  CodeCommunitySummary,
  CodeKnowledgeGraphResponse,
  FilePreview,
  CodeImpactResult,
  IncidentCodeImpactResult,
  TraceCodeImpactResult,
  ValidationRunRequest,
  ValidationRunResult,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : '/api';

class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    let data;
    try {
      data = await res.json();
      if (data?.detail) {
        errorDetail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // not JSON
    }
    throw new ApiError(errorDetail, res.status, data);
  }
  return res.json();
}

export const api = {
  getHealth: async (): Promise<HealthStatus> => {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<HealthStatus>(res);
  },

  getSystemStatus: async (): Promise<SystemStatus> => {
    const res = await fetch(`${API_BASE}/system/status`);
    return handleResponse<SystemStatus>(res);
  },

  getModelStatus: async (): Promise<ModelStatus> => {
    const res = await fetch(`${API_BASE}/models/status`);
    return handleResponse<ModelStatus>(res);
  },

  getSyntheticDemoStatus: async (): Promise<DemoStatusResponse> => {
    const res = await fetch(`${API_BASE}/demo/status`);
    return handleResponse<DemoStatusResponse>(res);
  },

  loadSyntheticDemo: async (): Promise<DemoLoadResponse> => {
    const res = await fetch(`${API_BASE}/demo/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<DemoLoadResponse>(res);
  },

  resetSyntheticDemo: async (): Promise<{ status: string; message: string }> => {
    const res = await fetch(`${API_BASE}/demo/reset`, {
      method: 'POST',
    });
    return handleResponse<{ status: string; message: string }>(res);
  },

  listTraces: async (params?: {
    status?: string;
    search?: string;
    limit?: number;
  }): Promise<TraceSummary[]> => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') {
      query.append('status', params.status);
    }
    if (params?.search) {
      query.append('search', params.search);
    }
    if (params?.limit) {
      query.append('limit', String(params.limit));
    }
    const res = await fetch(`${API_BASE}/traces?${query.toString()}`);
    return handleResponse<TraceSummary[]>(res);
  },

  getTrace: async (traceId: string): Promise<TraceDetail> => {
    const res = await fetch(`${API_BASE}/traces/${encodeURIComponent(traceId)}`);
    return handleResponse<TraceDetail>(res);
  },

  getTraceSpans: async (traceId: string): Promise<Span[]> => {
    const res = await fetch(`${API_BASE}/traces/${encodeURIComponent(traceId)}/spans`);
    return handleResponse<Span[]>(res);
  },

  importTrace: async (payload: any, overwrite = false): Promise<TraceImportResponse> => {
    const res = await fetch(`${API_BASE}/traces/import?overwrite=${overwrite}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<TraceImportResponse>(res);
  },

  uploadTraceFile: async (file: File, overwrite = false): Promise<TraceImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/traces/upload?overwrite=${overwrite}`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<TraceImportResponse>(res);
  },

  // Phase 2: Detection & Incident APIs
  listIncidents: async (params?: {
    severity?: string;
    status?: string;
    project_id?: string;
    search?: string;
    offset?: number;
    limit?: number;
  }): Promise<Incident[]> => {
    const query = new URLSearchParams();
    if (params?.severity && params.severity !== 'all') {
      query.append('severity', params.severity);
    }
    if (params?.status && params.status !== 'all') {
      query.append('status', params.status);
    }
    if (params?.project_id) {
      query.append('project_id', params.project_id);
    }
    if (params?.search) {
      query.append('search', params.search);
    }
    if (params?.offset !== undefined) {
      query.append('offset', String(params.offset));
    }
    if (params?.limit !== undefined) {
      query.append('limit', String(params.limit));
    }
    const res = await fetch(`${API_BASE}/incidents?${query.toString()}`);
    return handleResponse<Incident[]>(res);
  },

  getIncident: async (incidentId: string): Promise<IncidentDetail> => {
    const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}`);
    return handleResponse<IncidentDetail>(res);
  },

  getIncidentEvidence: async (incidentId: string): Promise<EvidenceReference[]> => {
    const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}/evidence`);
    return handleResponse<EvidenceReference[]>(res);
  },

  runTraceDetection: async (traceId: string): Promise<Detection[]> => {
    const res = await fetch(`${API_BASE}/traces/${encodeURIComponent(traceId)}/detect`, {
      method: 'POST',
    });
    return handleResponse<Detection[]>(res);
  },

  getTraceDetections: async (traceId: string): Promise<Detection[]> => {
    const res = await fetch(`${API_BASE}/traces/${encodeURIComponent(traceId)}/detections`);
    return handleResponse<Detection[]>(res);
  },

  getDetectionRules: async (): Promise<DetectionRule[]> => {
    const res = await fetch(`${API_BASE}/detection-rules`);
    return handleResponse<DetectionRule[]>(res);
  },

  getDetectionSummary: async (): Promise<DetectionSummary> => {
    const res = await fetch(`${API_BASE}/detection/summary`);
    return handleResponse<DetectionSummary>(res);
  },

  // Phase 3: Investigation Workspace APIs
  getExecutionGraph: async (traceId: string): Promise<ExecutionGraph> => {
    const res = await fetch(`${API_BASE}/traces/${encodeURIComponent(traceId)}/graph`);
    return handleResponse<ExecutionGraph>(res);
  },

  getInvestigationContext: async (traceId: string): Promise<InvestigationContext> => {
    const res = await fetch(`${API_BASE}/traces/${encodeURIComponent(traceId)}/investigation-context`);
    return handleResponse<InvestigationContext>(res);
  },

  getEventDetail: async (traceId: string, eventId: string): Promise<EventDetail> => {
    const res = await fetch(
      `${API_BASE}/traces/${encodeURIComponent(traceId)}/events/${encodeURIComponent(eventId)}`
    );
    return handleResponse<EventDetail>(res);
  },

  // Phase 4: Gemma AI Investigation APIs
  testModelConnection: async (): Promise<ModelTestResult> => {
    const res = await fetch(`${API_BASE}/models/test`, {
      method: 'POST',
    });
    return handleResponse<ModelTestResult>(res);
  },

  getModelSettings: async (): Promise<ModelSettings> => {
    const res = await fetch(`${API_BASE}/models/settings`);
    return handleResponse<ModelSettings>(res);
  },

  updateModelSettings: async (settings: ModelSettingsUpdate): Promise<ModelSettings> => {
    const res = await fetch(`${API_BASE}/models/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return handleResponse<ModelSettings>(res);
  },

  triggerInvestigation: async (incidentId: string): Promise<Investigation> => {
    const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}/investigate`, {
      method: 'POST',
    });
    return handleResponse<Investigation>(res);
  },

  getIncidentInvestigations: async (incidentId: string): Promise<Investigation[]> => {
    const res = await fetch(
      `${API_BASE}/incidents/${encodeURIComponent(incidentId)}/investigations`
    );
    return handleResponse<Investigation[]>(res);
  },

  getInvestigationDetail: async (investigationId: string): Promise<InvestigationDetail> => {
    const res = await fetch(
      `${API_BASE}/investigations/${encodeURIComponent(investigationId)}`
    );
    return handleResponse<InvestigationDetail>(res);
  },

  getInvestigationStatus: async (investigationId: string): Promise<InvestigationStatusUpdate> => {
    const res = await fetch(
      `${API_BASE}/investigations/${encodeURIComponent(investigationId)}/status`
    );
    return handleResponse<InvestigationStatusUpdate>(res);
  },

  getInvestigationEvidence: async (investigationId: string): Promise<InvestigationEvidenceItem[]> => {
    const res = await fetch(
      `${API_BASE}/investigations/${encodeURIComponent(investigationId)}/evidence`
    );
    return handleResponse<InvestigationEvidenceItem[]>(res);
  },

  // Phase 5: Counterfactual Replay APIs
  getReplayCapabilities: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/replay/capabilities`);
    return handleResponse<any>(res);
  },

  listReplayFixtures: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/replay/fixtures`);
    return handleResponse<any[]>(res);
  },

  previewReplay: async (incidentId: string, payload: { counterfactual_operation: string; counterfactual_arguments: any; fixture_id?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}/replay/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(res);
  },

  createReplay: async (incidentId: string, payload: { counterfactual_operation: string; counterfactual_arguments: any; fixture_id?: string; approved_by_user: boolean; investigation_id?: string }): Promise<any> => {
    const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<any>(res);
  },

  listReplays: async (incidentId?: string, statusFilter?: string): Promise<any[]> => {
    const params = new URLSearchParams();
    if (incidentId) params.append('incident_id', incidentId);
    if (statusFilter) params.append('status', statusFilter);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/replays${qs}`);
    return handleResponse<any[]>(res);
  },

  getReplayDetail: async (replayId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/replays/${encodeURIComponent(replayId)}`);
    return handleResponse<any>(res);
  },

  getReplayStatus: async (replayId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/replays/${encodeURIComponent(replayId)}/status`);
    return handleResponse<any>(res);
  },

  getReplayComparison: async (replayId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/replays/${encodeURIComponent(replayId)}/comparison`);
    return handleResponse<any>(res);
  },

  getReplayManifest: async (replayId: string): Promise<any> => {
    const res = await fetch(`${API_BASE}/replays/${encodeURIComponent(replayId)}/manifest`);
    return handleResponse<any>(res);
  },

  // Phase 6: System Diagnostics & Reports APIs
  getSystemDiagnostics: async (): Promise<SystemDiagnostics> => {
    const res = await fetch(`${API_BASE}/system/diagnostics`);
    return handleResponse<SystemDiagnostics>(res);
  },

  getReports: async (): Promise<ReportItem[]> => {
    const res = await fetch(`${API_BASE}/reports`);
    return handleResponse<ReportItem[]>(res);
  },

  exportReport: async (investigationId: string, format: 'markdown' | 'json'): Promise<string | any> => {
    const res = await fetch(`${API_BASE}/reports/${encodeURIComponent(investigationId)}/export?format=${format}`);
    if (!res.ok) {
      throw new Error(`Failed to export report: ${res.statusText}`);
    }
    if (format === 'json') {
      return res.json();
    }
    return res.text();
  },

  // Phase 7: Codebase Knowledge (Graphify) APIs
  getCodeKnowledgeStatus: async (): Promise<CodeKnowledgeStatus> => {
    const res = await fetch(`${API_BASE}/knowledge/status`);
    return handleResponse<CodeKnowledgeStatus>(res);
  },

  getCodeKnowledgeCommunities: async (): Promise<CodeCommunitySummary[]> => {
    const res = await fetch(`${API_BASE}/knowledge/communities`);
    return handleResponse<CodeCommunitySummary[]>(res);
  },

  getCodeKnowledgeGraph: async (params?: {
    max_nodes?: number;
    community?: number;
    search?: string;
    node_type?: string;
    relation_type?: string;
    confidence?: string;
    focus_file?: string;
    focus_node?: string;
    depth?: number;
  }): Promise<CodeKnowledgeGraphResponse> => {
    const urlParams = new URLSearchParams();
    if (params) {
      if (params.max_nodes !== undefined && params.max_nodes !== null) {
        urlParams.append('max_nodes', String(params.max_nodes));
      }
      if (params.community !== undefined && params.community !== null) {
        urlParams.append('community', String(params.community));
      }
      if (params.search) {
        urlParams.append('search', params.search);
      }
      if (params.node_type) {
        urlParams.append('node_type', params.node_type);
      }
      if (params.relation_type) {
        urlParams.append('relation_type', params.relation_type);
      }
      if (params.confidence) {
        urlParams.append('confidence', params.confidence);
      }
      if (params.focus_file) {
        urlParams.append('focus_file', params.focus_file);
      }
      if (params.focus_node) {
        urlParams.append('focus_node', params.focus_node);
      }
      if (params.depth !== undefined && params.depth !== null) {
        urlParams.append('depth', String(params.depth));
      }
    }
    const queryString = urlParams.toString();
    const url = queryString ? `${API_BASE}/knowledge/graph?${queryString}` : `${API_BASE}/knowledge/graph`;
    const res = await fetch(url);
    return handleResponse<CodeKnowledgeGraphResponse>(res);
  },

  queryCodeKnowledge: async (query: string, seed?: string, budget: number = 2000): Promise<CodeKnowledgeQueryResult> => {
    const res = await fetch(`${API_BASE}/knowledge/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, seed, budget }),
    });
    return handleResponse<CodeKnowledgeQueryResult>(res);
  },

  explainCodeKnowledge: async (symbol: string): Promise<CodeKnowledgeExplainResult> => {
    const res = await fetch(`${API_BASE}/knowledge/explain/${encodeURIComponent(symbol)}`);
    return handleResponse<CodeKnowledgeExplainResult>(res);
  },

  refreshCodeKnowledge: async (): Promise<{
    success: boolean;
    message: string;
    duration_ms?: number;
    node_count: number;
    edge_count: number;
  }> => {
    const res = await fetch(`${API_BASE}/knowledge/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<any>(res);
  },

  previewSourceFile: async (path: string, line?: number, context: number = 25): Promise<FilePreview> => {
    const params = new URLSearchParams({ path, context: String(context) });
    if (line !== undefined && line !== null) {
      params.append('line', String(line));
    }
    const res = await fetch(`${API_BASE}/knowledge/file-preview?${params.toString()}`);
    return handleResponse<FilePreview>(res);
  },

  analyzeCodeImpact: async (
    target: string,
    changeType: 'modify' | 'delete' | 'create' = 'modify',
    depth: number = 2,
    limit: number = 50
  ): Promise<CodeImpactResult> => {
    const res = await fetch(`${API_BASE}/knowledge/impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target,
        change_type: changeType,
        max_depth: depth,
        max_results: limit,
      }),
    });
    return handleResponse<CodeImpactResult>(res);
  },

  getIncidentCodeImpact: async (incidentId: string): Promise<IncidentCodeImpactResult> => {
    const res = await fetch(
      `${API_BASE}/incidents/${encodeURIComponent(incidentId)}/code-impact`
    );
    return handleResponse<IncidentCodeImpactResult>(res);
  },

  getTraceCodeImpact: async (traceId: string): Promise<TraceCodeImpactResult> => {
    const res = await fetch(
      `${API_BASE}/traces/${encodeURIComponent(traceId)}/code-impact`
    );
    return handleResponse<TraceCodeImpactResult>(res);
  },

  getSpanCodeImpact: async (spanId: string): Promise<CodeImpactResult> => {
    const res = await fetch(
      `${API_BASE}/spans/${encodeURIComponent(spanId)}/code-impact`
    );
    return handleResponse<CodeImpactResult>(res);
  },

  validateImpact: async (payload: ValidationRunRequest): Promise<ValidationRunResult> => {
    const res = await fetch(`${API_BASE}/knowledge/validate-impact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<ValidationRunResult>(res);
  },
};


