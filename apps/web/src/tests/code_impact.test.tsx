import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GraphifyPage } from '../pages/GraphifyPage';
import { IncidentDetailPage } from '../pages/IncidentDetailPage';
import { TraceDetailPage } from '../pages/TraceDetailPage';
import { CodeImpactPanel } from '../components/common/CodeImpactPanel';
import { CodeImpactResponse, ValidationRunResult } from '../types';
import { api } from '../lib/api';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    getCodeKnowledgeStatus: vi.fn(),
    getCodeKnowledgeCommunities: vi.fn(),
    getCodeKnowledgeGraph: vi.fn(),
    queryCodeKnowledge: vi.fn(),
    explainCodeKnowledge: vi.fn(),
    refreshCodeKnowledge: vi.fn(),
    previewSourceFile: vi.fn(),
    analyzeCodeImpact: vi.fn(),
    getIncidentCodeImpact: vi.fn(),
    getIncident: vi.fn(),
    getTrace: vi.fn(),
    getModelStatus: vi.fn(),
    getIncidentInvestigations: vi.fn(),
    getTraceCodeImpact: vi.fn(),
    getSpanCodeImpact: vi.fn(),
    validateImpact: vi.fn(),
    getTraceDetections: vi.fn(),
    runTraceDetection: vi.fn(),
  },
}));

const mockStatus = {
  status: 'ready' as const,
  is_enabled: true,
  is_installed: true,
  graphify_version: '0.9.92',
  graph_path: '/Users/oggy/RIFT/graphify-out/graph.json',
  schema_version: 1,
  node_count: 1254,
  edge_count: 3532,
  community_count: 72,
  last_updated_at: '2026-10-22T12:00:00Z',
  message: 'Graphify codebase knowledge graph is ready and verified.',
};

const mockImpactResult = {
  target: 'apps/api/app/services/detection/engine.py',
  target_type: 'file' as const,
  change_type: 'modify',
  status: 'success' as const,
  direct_impact_count: 23,
  transitive_impact_count: 1,
  affected_files: ['apps/api/app/api/endpoints.py', 'apps/api/tests/test_detection.py'],
  affected_symbols: ['endpoints.py', 'test_detection.py', 'DetectionEngine'],
  relationships: [
    {
      source: 'endpoints.py',
      target: 'DetectionEngine',
      relation: 'imports',
      direction: 'incoming' as const,
      depth: 1,
      confidence: 'EXTRACTED',
      confidence_score: 1.0,
      source_file: 'apps/api/app/api/endpoints.py',
      source_location: 'L73',
      target_file: 'apps/api/app/services/detection/engine.py',
      target_location: 'L17',
      relevance_explanation: "Modifying 'DetectionEngine' may affect 'endpoints.py' which imports it in apps/api/app/api/endpoints.py:L73 [EXTRACTED].",
    },
    {
      source: 'test_detection.py',
      target: 'DetectionEngine',
      relation: 'calls',
      direction: 'incoming' as const,
      depth: 2,
      confidence: 'INFERRED',
      confidence_score: 0.85,
      source_file: 'apps/api/tests/test_detection.py',
      source_location: 'L4',
      target_file: 'apps/api/app/services/detection/engine.py',
      target_location: 'L17',
      relevance_explanation: "Modifying 'DetectionEngine' may affect 'test_detection.py' which calls it in apps/api/tests/test_detection.py:L4 [INFERRED].",
    },
  ],
  summary: "Impact analysis for file 'apps/api/app/services/detection/engine.py' (modify): 23 direct dependent(s), 1 transitive dependent(s) across 2 file(s) and 3 symbol(s).",
  limitations: ['Static AST analysis only; dynamically imported modules are not captured.'],
  graph_freshness: '2026-10-22T12:00:00Z',
  duration_ms: 1.25,
};

const mockIncidentImpact = {
  incident_id: 'inc-001',
  trace_id: 'trace-001',
  status: 'ready' as const,
  touched_files: ['src/config.ts'],
  impacts: [
    {
      target: 'src/config.ts',
      target_type: 'file' as const,
      change_type: 'delete',
      status: 'success' as const,
      direct_impact_count: 5,
      transitive_impact_count: 2,
      affected_files: ['src/server.ts', 'src/app.ts'],
      affected_symbols: ['server.ts', 'app.ts'],
      relationships: [
        {
          source: 'src/server.ts',
          target: 'src/config.ts',
          relation: 'imports',
          direction: 'incoming' as const,
          depth: 1,
          confidence: 'EXTRACTED',
          confidence_score: 1.0,
          source_file: 'src/server.ts',
          source_location: 'L3',
          relevance_explanation: "Deleting 'src/config.ts' will break 'src/server.ts' which imports it in src/server.ts:L3 [EXTRACTED].",
        },
      ],
      summary: "Impact analysis for file 'src/config.ts' (delete): 5 direct dependent(s), 2 transitive dependent(s) across 2 file(s).",
      limitations: ['Static AST analysis only.'],
      graph_freshness: '2026-10-22T12:00:00Z',
      duration_ms: 1.1,
    },
  ],
  total_affected_files: 2,
  total_affected_symbols: 2,
  summary: "Incident 'Unsafe Deletion' touched 1 file(s). Impact blast radius involves 2 dependent file(s).",
  evidence_provenance: {
    observed_trace_event: 'Telemetry event captured during agent execution',
    extracted_ast_relationship: 'Direct AST syntax relationship extracted from codebase',
  },
};

describe('Code Impact Analysis Frontend', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
      },
    });
    vi.mocked(api.getCodeKnowledgeStatus).mockResolvedValue(mockStatus);
    vi.mocked(api.getCodeKnowledgeCommunities).mockResolvedValue([
      { id: 0, name: 'detection', node_count: 50, top_symbols: ['IncidentDetector', 'BaseRule'] },
      { id: 1, name: 'investigation', node_count: 40, top_symbols: ['GemmaClient'] },
    ]);
    vi.mocked(api.getCodeKnowledgeGraph).mockResolvedValue({
      status: 'success',
      nodes: [
        { id: 'IncidentDetector', label: 'IncidentDetector', is_class: true, community: 0, degree: 5 },
        { id: 'BaseRule', label: 'BaseRule', is_class: true, community: 0, degree: 3 },
      ],
      edges: [
        { source: 'IncidentDetector', target: 'BaseRule', relation: 'inherits', confidence: 'EXTRACTED', confidence_score: 1.0, weight: 1.0 },
      ],
      total_nodes: 2,
      total_edges: 1,
      communities: [],
      duration_ms: 1.5,
    });
    vi.mocked(api.analyzeCodeImpact).mockResolvedValue(mockImpactResult);
    vi.mocked(api.getIncidentCodeImpact).mockResolvedValue(mockIncidentImpact);
    vi.mocked(api.explainCodeKnowledge).mockResolvedValue({
      symbol: 'TraceContext',
      incoming_edges: [],
      outgoing_edges: [],
    });
    vi.mocked(api.getModelStatus).mockResolvedValue({
      status: 'ready',
      configured_model: 'gemma2:9b',
      available_models: ['gemma2:9b'],
      ollama_base_url: 'http://localhost:11434',
      message: 'Model is ready',
      reachable: true,
      model_available: true,
      error_message: null,
      setup_instructions: [],
      installed_models: ['gemma2:9b'],
    });
    vi.mocked(api.getIncidentInvestigations).mockResolvedValue([]);
  });

  it('renders Graphify status, node/edge telemetry metrics, controls, and verified impact results', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <GraphifyPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/AST Code Knowledge Engine/i)).toBeInTheDocument();
      expect(screen.getByText(/1,254/i)).toBeInTheDocument();
      expect(screen.getByText(/3,532/i)).toBeInTheDocument();
      expect(screen.getByText(/Graph Verified & Ready/i)).toBeInTheDocument();
      expect(screen.getByText(/Code Impact Analysis & Blast Radius Explorer/i)).toBeInTheDocument();
      expect(screen.getByText(/Mutation Type/i)).toBeInTheDocument();
      expect(screen.getByText(/Traversal Depth/i)).toBeInTheDocument();
      expect(screen.getByText(/engine.py \(File\)/i)).toBeInTheDocument();
      expect(screen.getByText(/DetectionEngine \(Symbol\)/i)).toBeInTheDocument();
    });

    // Wait for the query to finish loading
    await waitFor(() => {
      expect(screen.queryByText(/Computing AST blast radius/i)).not.toBeInTheDocument();
    });

    // Verify impact results and provenance badges
    expect(screen.getByText('23')).toBeInTheDocument(); // direct impact count
    expect(screen.getAllByText('1').length).toBeGreaterThan(0); // transitive impact count
    expect(screen.getAllByText(/EXTRACTED/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/INFERRED/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Direct \(Depth 1\)/i)).toBeInTheDocument();
  });

  it('renders Incident Codebase Impact & Blast Radius card on IncidentDetailPage', async () => {
    vi.mocked(api.getIncident).mockResolvedValue({
      id: 'inc-001',
      trace_id: 'trace-001',
      title: "Unsafe Deletion of 'src/config.ts'",
      description: 'Agent deleted src/config.ts',
      severity: 'Critical',
      status: 'open',
      first_suspicious_event_id: 'span-001',
      created_at: '2026-10-19T10:00:00Z',
      updated_at: '2026-10-19T10:00:00Z',
      agent_name: 'Cleaner Bot',
      agent_id: 'ag-1',
      project_name: 'Core API',
      project_id: 'proj-1',
      trace_objective: 'Clean tmp files',
      detections: [],
    });

    vi.mocked(api.getTrace).mockResolvedValue({
      id: 'trace-001',
      project_id: 'proj-1',
      project_name: 'Core API',
      agent_id: 'ag-1',
      agent_name: 'Cleaner Bot',
      agent_framework: 'LangChain',
      objective: 'Clean tmp files',
      status: 'error',
      started_at: '2026-10-19T10:00:00Z',
      ended_at: '2026-10-19T10:01:00Z',
      duration_ms: 60000,
      created_at: '2026-10-19T10:00:00Z',
      spans: [],
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/incidents/inc-001']}>
          <Routes>
            <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('inc-001')).toBeInTheDocument();
      expect(screen.getByText(/Codebase Impact & Blast Radius/i)).toBeInTheDocument();
      expect(screen.getAllByText(/src\/config\.ts/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Open Code Knowledge Explorer/i)).toBeInTheDocument();
    });
  });

  it('renders CodeImpactPanel with status taxonomy, filters, test execution modal, and result verification', async () => {
    const mockPanelImpact: CodeImpactResponse = {
      target: 'apps/api/app/services/detection/engine.py',
      target_type: 'file',
      change_type: 'modify',
      status: 'success',
      impact_status: 'POTENTIAL IMPACT',
      direct_impact_count: 1,
      transitive_impact_count: 1,
      affected_files: ['apps/api/app/api/endpoints.py', 'apps/api/tests/test_detection.py'],
      affected_symbols: ['endpoints.py', 'test_detection.py'],
      relationships: [
        {
          source: 'endpoints.py',
          target: 'DetectionEngine',
          relation: 'imports',
          direction: 'incoming',
          depth: 1,
          confidence: 'EXTRACTED',
          confidence_score: 1.0,
          source_file: 'apps/api/app/api/endpoints.py',
          source_location: 'L73',
          target_file: 'apps/api/app/services/detection/engine.py',
          target_location: 'L17',
          relevance_explanation: "Modifying 'DetectionEngine' may affect 'endpoints.py' which imports it in apps/api/app/api/endpoints.py:L73 [EXTRACTED].",
          dependency_path: 'apps/api/app/services/detection/engine.py -> imported_by -> apps/api/app/api/endpoints.py',
          impact_status: 'POTENTIAL IMPACT',
        },
        {
          source: 'test_detection.py',
          target: 'DetectionEngine',
          relation: 'calls',
          direction: 'incoming',
          depth: 2,
          confidence: 'INFERRED',
          confidence_score: 0.85,
          source_file: 'apps/api/tests/test_detection.py',
          source_location: 'L4',
          target_file: 'apps/api/app/services/detection/engine.py',
          target_location: 'L17',
          relevance_explanation: "Modifying 'DetectionEngine' may affect 'test_detection.py' which calls it in apps/api/tests/test_detection.py:L4 [INFERRED].",
          dependency_path: 'apps/api/app/services/detection/engine.py -> imported_by -> endpoints.py -> called_by -> test_detection.py',
          impact_status: 'POTENTIAL IMPACT',
        },
      ],
      dependents: [
        {
          name: 'endpoints.py',
          type: 'module',
          file_path: 'apps/api/app/api/endpoints.py',
          depth: 1,
          is_direct: true,
          relation: 'imports',
          provenance: 'EXTRACTED',
          dependency_path: 'apps/api/app/services/detection/engine.py -> imported_by -> apps/api/app/api/endpoints.py',
          impact_status: 'POTENTIAL IMPACT',
        },
        {
          name: 'test_detection.py',
          type: 'module',
          file_path: 'apps/api/tests/test_detection.py',
          depth: 2,
          is_direct: false,
          relation: 'calls',
          provenance: 'INFERRED',
          dependency_path: 'apps/api/app/services/detection/engine.py -> imported_by -> endpoints.py -> called_by -> test_detection.py',
          impact_status: 'POTENTIAL IMPACT',
        },
      ],
      triggering_event: {
        span_id: 'span-file-01',
        event_id: 'span-file-01',
        agent_name: 'Code Refactor Agent',
        operation: 'modify',
        operation_type: 'modify',
        file_path: 'apps/api/app/services/detection/engine.py',
        timestamp: '2026-10-22T10:00:00Z',
        trace_id: 'trace-test-1',
      },
      discovered_tests: [
        {
          test_id: 'apps/api/tests/test_detection.py',
          test_name: 'test_detection.py',
          test_file: 'apps/api/tests/test_detection.py',
          test_type: 'unit',
          command: 'pytest apps/api/tests/test_detection.py',
          relevance: 'AST dependent test file covering modified symbol',
          exists_on_disk: true,
        },
      ],
      validation_results: [],
      summary: "Observed modification of 'apps/api/app/services/detection/engine.py': 1 direct dependent(s), 1 transitive dependent(s).",
      limitations: ['Static AST analysis only; dynamic imports not resolved.'],
      graph_freshness: '2026-10-22T12:00:00Z',
      duration_ms: 1.5,
    };

    const mockValidationResult: ValidationRunResult = {
      test_id: 'apps/api/tests/test_detection.py',
      command: 'pytest apps/api/tests/test_detection.py',
      exit_code: 0,
      passed: true,
      status: 'NO FAILURE OBSERVED',
      duration_ms: 450,
      executed_at: '2026-10-22T12:05:00Z',
      stdout_snippet: '==== 8 passed in 0.45s ====',
      stderr_snippet: '',
      comparison_to_baseline: 'No pre-change regression baseline available for comparison.',
      attribution_notes: 'Available validation completed without detecting a failure. Note: This does not guarantee absence of subtle regressions.',
    };

    vi.mocked(api.validateImpact).mockResolvedValue(mockValidationResult);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CodeImpactPanel impact={mockPanelImpact} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Mandatory Taxonomy Badges
    expect(screen.getByText('CHANGE OBSERVED')).toBeInTheDocument();
    expect(screen.getAllByText('POTENTIAL IMPACT').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/apps\/api\/app\/services\/detection\/engine\.py/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/span-file-01/i)).toBeInTheDocument();

    // 2. Direct vs Transitive Filter Tabs
    expect(screen.getByText(/All Dependents \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Direct \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Transitive \(1\)/i)).toBeInTheDocument();

    // Verify dependencies are visible initially
    expect(screen.getByText('endpoints.py')).toBeInTheDocument();
    expect(screen.getByText('test_detection.py')).toBeInTheDocument();

    // Click Direct tab
    fireEvent.click(screen.getByText(/Direct \(1\)/i));
    expect(screen.getByText('endpoints.py')).toBeInTheDocument();
    expect(screen.queryByText('test_detection.py')).not.toBeInTheDocument();

    // Click All tab back
    fireEvent.click(screen.getByText(/All Dependents \(2\)/i));
    expect(screen.getByText('test_detection.py')).toBeInTheDocument();

    // 3. Discovered Test Suites & Validation Execution
    expect(screen.getByText(/Verified Test Suites/i)).toBeInTheDocument();
    expect(screen.getByText('pytest apps/api/tests/test_detection.py')).toBeInTheDocument();

    // Click "Run Validation" button to open confirmation modal
    const runBtn = screen.getByRole('button', { name: /Run Validation/i });
    fireEvent.click(runBtn);

    // Safety Modal checks
    expect(screen.getByText(/Confirm Isolated Test Execution/i)).toBeInTheDocument();
    expect(screen.getByText(/Safeguard Notice/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm & Run Validation/i })).toBeInTheDocument();

    // Confirm execution
    fireEvent.click(screen.getByRole('button', { name: /Confirm & Run Validation/i }));

    await waitFor(() => {
      expect(api.validateImpact).toHaveBeenCalledWith({
        test_id: 'apps/api/tests/test_detection.py',
        confirm: true,
        compare_baseline: true,
      });
    });

    // 4. Assert Validation Results Card
    await waitFor(() => {
      expect(screen.getByText('NO FAILURE OBSERVED')).toBeInTheDocument();
      expect(screen.getByText(/==== 8 passed in 0\.45s ====/i)).toBeInTheDocument();
      expect(screen.getByText(/Exit Code: 0/i)).toBeInTheDocument();
      expect(screen.getAllByText(/does not guarantee absence of subtle regressions/i).length).toBeGreaterThan(0);
    });
  });

  it('renders TraceDetailPage with file operation badge, Blast Radius header button, and Code Impact tab', async () => {
    const mockTraceWithFileOp = {
      id: 'trace-test-1',
      project_id: 'proj-1',
      project_name: 'RIFT Core',
      agent_id: 'ag-1',
      agent_name: 'Code Refactor Agent',
      agent_framework: 'LangChain',
      objective: 'Refactor detection engine',
      status: 'success',
      started_at: '2026-10-22T10:00:00Z',
      ended_at: '2026-10-22T10:02:00Z',
      duration_ms: 120000,
      created_at: '2026-10-22T10:00:00Z',
      spans: [
        {
          id: 'span-file-01',
          trace_id: 'trace-test-1',
          parent_span_id: null,
          name: 'edit_file',
          event_type: 'tool_call',
          status: 'success',
          timestamp: '2026-10-22T10:00:05Z',
          duration_ms: 1500,
          input_data: { target_file: 'apps/api/app/services/detection/engine.py', content: '# new' },
          output_data: { success: true },
          error_data: {},
          metadata_payload: {},
        },
      ],
    };

    const mockTraceImpact = {
      trace_id: 'trace-test-1',
      available: true,
      summary: 'Trace modified 1 file(s).',
      file_operations: [
        {
          event_id: 'span-file-01',
          agent_name: 'Code Refactor Agent',
          operation_type: 'modify',
          file_path: 'apps/api/app/services/detection/engine.py',
          timestamp: '2026-10-22T10:00:05Z',
          trace_id: 'trace-test-1',
        },
      ],
      impacts: [
        {
          target: 'apps/api/app/services/detection/engine.py',
          target_type: 'file',
          change_type: 'modify',
          status: 'success',
          impact_status: 'POTENTIAL IMPACT',
          direct_impact_count: 1,
          transitive_impact_count: 0,
          affected_files: ['apps/api/app/api/endpoints.py'],
          affected_symbols: ['endpoints.py'],
          relationships: [],
          dependents: [
            {
              name: 'endpoints.py',
              type: 'module',
              file_path: 'apps/api/app/api/endpoints.py',
              depth: 1,
              is_direct: true,
              relation: 'imports',
              provenance: 'EXTRACTED',
              dependency_path: 'apps/api/app/services/detection/engine.py -> imported_by -> endpoints.py',
              impact_status: 'POTENTIAL IMPACT',
            },
          ],
          discovered_tests: [],
          validation_results: [],
          summary: "Observed modification of 'apps/api/app/services/detection/engine.py'",
          limitations: [],
          graph_freshness: '2026-10-22T12:00:00Z',
          duration_ms: 1.0,
        },
      ],
      graph_freshness: '2026-10-22T12:00:00Z',
    };

    const mockSpanImpact = {
      span_id: 'span-file-01',
      trace_id: 'trace-test-1',
      available: true,
      summary: "File modification observed on 'apps/api/app/services/detection/engine.py'",
      file_operation: {
        event_id: 'span-file-01',
        agent_name: 'Code Refactor Agent',
        operation_type: 'modify',
        file_path: 'apps/api/app/services/detection/engine.py',
        timestamp: '2026-10-22T10:00:05Z',
        trace_id: 'trace-test-1',
      },
      target: 'apps/api/app/services/detection/engine.py',
      change_type: 'modify',
      impact_status: 'POTENTIAL IMPACT',
      total_dependents: 1,
      direct_dependents: 1,
      transitive_dependents: 0,
      dependents: [
        {
          name: 'endpoints.py',
          type: 'module',
          file_path: 'apps/api/app/api/endpoints.py',
          depth: 1,
          is_direct: true,
          relation: 'imports',
          provenance: 'EXTRACTED',
          dependency_path: 'apps/api/app/services/detection/engine.py -> imported_by -> endpoints.py',
          impact_status: 'POTENTIAL IMPACT',
        },
      ],
      discovered_tests: [],
      validation_results: [],
      limitations: [],
      graph_freshness: '2026-10-22T12:00:00Z',
      duration_ms: 1.0,
    };

    vi.mocked(api.getTrace).mockResolvedValue(mockTraceWithFileOp as any);
    vi.mocked(api.getTraceDetections).mockResolvedValue([]);
    vi.mocked(api.getTraceCodeImpact).mockResolvedValue(mockTraceImpact as any);
    vi.mocked(api.getSpanCodeImpact).mockResolvedValue(mockSpanImpact as any);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/traces/trace-test-1']}>
          <Routes>
            <Route path="/traces/:traceId" element={<TraceDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // 1. Blast Radius header button
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Blast Radius \(1\)/i })).toBeInTheDocument();
    });

    // 2. Timeline file badge
    expect(screen.getByText(/modify: engine\.py/i)).toBeInTheDocument();

    // 3. Span Inspector Code Impact Tab
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Code Impact/i })).toBeInTheDocument();
    });

    // Click "Code Impact" tab
    fireEvent.click(screen.getByRole('button', { name: /Code Impact/i }));

    // Verify CodeImpactPanel renders inside tab
    await waitFor(() => {
      expect(screen.getAllByText('CHANGE OBSERVED').length).toBeGreaterThan(0);
      expect(screen.getAllByText('POTENTIAL IMPACT').length).toBeGreaterThan(0);
      expect(screen.getAllByText('endpoints.py').length).toBeGreaterThan(0);
    });

    // 4. Test clicking Blast Radius header button opens modal
    fireEvent.click(screen.getByRole('button', { name: /Blast Radius \(1\)/i }));
    expect(screen.getByText(/Trace Codebase Blast Radius & Impact Analysis/i)).toBeInTheDocument();
  });
});
