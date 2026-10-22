import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GemmaInvestigationPanel } from '../features/investigation/components/GemmaInvestigationPanel';
import { api } from '../lib/api';
import { InvestigationDetail, ModelStatus } from '../types';

// Mock API client
vi.mock('../lib/api', () => ({
  api: {
    getModelStatus: vi.fn(),
    getIncidentInvestigations: vi.fn(),
    getInvestigationDetail: vi.fn(),
    getInvestigationStatus: vi.fn(),
    triggerInvestigation: vi.fn(),
    testModelConnection: vi.fn(),
  },
}));

const mockModelReady: ModelStatus = {
  status: 'ready',
  configured_model: 'gemma2:9b',
  available_models: ['gemma2:9b'],
  ollama_base_url: 'http://localhost:11434',
  message: 'Model is ready for inference',
  reachable: true,
  model_available: true,
  error_message: null,
  setup_instructions: [],
  installed_models: ['gemma2:9b'],
  recommended_spec: {
    tag: 'gemma2:9b',
    name: 'Google Gemma 2 (9B Instruct)',
    context_window: 8192,
    quantization: 'Q4_K_M',
    description: 'High-capability local reasoning model',
    recommended_gpu_ram_gb: 8,
  },
};

const mockModelOffline: ModelStatus = {
  status: 'ollama_unavailable',
  configured_model: 'gemma2:9b',
  available_models: [],
  ollama_base_url: 'http://localhost:11434',
  message: 'Cannot connect to Ollama daemon at http://localhost:11434',
  reachable: false,
  model_available: false,
  error_message: 'Cannot connect to Ollama daemon at http://localhost:11434',
  setup_instructions: [
    'Install Ollama from https://ollama.ai',
    'Start Ollama daemon: ollama serve',
    'Pull Gemma model: ollama pull gemma2:9b',
  ],
  installed_models: [],
};

const mockCompletedInvestigation: InvestigationDetail = {
  id: 'inv-100',
  incident_id: 'inc-001',
  trace_id: 'trace-demo-1',
  status: 'completed',
  model_name: 'gemma2:9b',
  prompt_version: 'v1.0.0',
  conclusion_status: 'conclusive',
  summary: 'The agent failed due to an unauthorized file deletion outside of allowed working directories.',
  observed_failure: 'Unexpected removal of src/config.ts',
  first_suspicious_event_id: 'span-003',
  started_at: '2026-10-19T10:00:00Z',
  completed_at: '2026-10-19T10:00:04Z',
  duration_ms: 4120,
  failure_code: null,
  failure_message: null,
  evidence_count: 3,
  evidence_items: [],
  is_truncated: false,
  created_at: '2026-10-19T10:00:00Z',
  hypotheses: [
    {
      id: 'hyp-1',
      investigation_id: 'inv-100',
      title: 'Path Normalization Bug',
      explanation: 'The agent used relative path resolution that stripped the parent directory prefix.',
      confidence_level: 'high',
      verification_status: 'supported',
      suggested_check: 'Inspect tool arguments in span-003',
      rank: 1,
      missing_evidence: ['Disk snapshot before delete'],
      evidence: [
        {
          id: 'ev-1',
          investigation_id: 'inv-100',
          hypothesis_id: 'hyp-1',
          event_id: 'span-003',
          relationship: 'supporting',
          explanation: 'Tool call delete_file explicitly passed src/config.ts',
        },
        {
          id: 'ev-2',
          investigation_id: 'inv-100',
          hypothesis_id: 'hyp-1',
          event_id: 'span-001',
          relationship: 'contradicting',
          explanation: 'User prompt specified only clean build artifacts',
        },
      ],
    },
    {
      id: 'hyp-2',
      investigation_id: 'inv-100',
      title: 'Missing Tool Sandbox Policy',
      explanation: 'The tool execution layer permitted absolute path deletion without sandbox confinement.',
      confidence_level: 'medium',
      verification_status: 'partially_supported',
      suggested_check: 'Review sandbox configuration',
      rank: 2,
      missing_evidence: ['Sandbox security rules'],
      evidence: [],
    },
  ],
  remediation_suggestions: [
    {
      id: 'rem-1',
      investigation_id: 'inv-100',
      description: 'Implement directory allowlist for file deletion tools',
      rationale: 'Restricts destructive file mutations strictly to build/ or tmp/ subpaths.',
      risk_level: 'low',
      verification_method: 'Run unit test with prohibited path parameter',
      requires_human_approval: true,
    },
  ],
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('GemmaInvestigationPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders model offline banner and instructions when Ollama is unavailable', async () => {
    (api.getModelStatus as any).mockResolvedValue(mockModelOffline);
    (api.getIncidentInvestigations as any).mockResolvedValue([]);

    renderWithProviders(
      <GemmaInvestigationPanel
        incidentId="inc-001"
        traceId="trace-demo-1"
        incidentTitle="Unsafe Deletion"
        incidentSeverity="Critical"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Gemma AI Investigation/i)).toBeInTheDocument();
      expect(screen.getByText('Local Gemma Model Inference Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/Start Ollama daemon: ollama serve/i)).toBeInTheDocument();
    });
  });

  it('displays completed investigation results, hypotheses, and transparency metadata', async () => {
    (api.getModelStatus as any).mockResolvedValue(mockModelReady);
    (api.getIncidentInvestigations as any).mockResolvedValue([mockCompletedInvestigation]);
    (api.getInvestigationDetail as any).mockResolvedValue(mockCompletedInvestigation);

    const onNavigateMock = vi.fn();

    renderWithProviders(
      <GemmaInvestigationPanel
        incidentId="inc-001"
        traceId="trace-demo-1"
        incidentTitle="Unsafe Deletion"
        incidentSeverity="Critical"
        onNavigateToEvent={onNavigateMock}
      />
    );

    // Verify executive summary
    await waitFor(() => {
      expect(screen.getByText(/Path Normalization Bug/i)).toBeInTheDocument();
      expect(screen.getByText(/Unexpected removal of src\/config.ts/i)).toBeInTheDocument();
      expect(screen.getAllByText('span-003').length).toBeGreaterThan(0);
      expect(screen.getByText(/conclusive/i)).toBeInTheDocument();
    });

    // Verify model transparency metadata
    expect(screen.getAllByText('gemma2:9b').length).toBeGreaterThan(0);
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByText('4120ms')).toBeInTheDocument();

    // Verify hypothesis details
    expect(screen.getByText('supported')).toBeInTheDocument();
    expect(screen.getByText(/The agent used relative path resolution/i)).toBeInTheDocument();

    // Test evidence navigation
    const jumpBtn = screen.getByText('Jump to event');
    fireEvent.click(jumpBtn);
    expect(onNavigateMock).toHaveBeenCalledWith('span-003');
  });

  it('switches between Hypotheses, Evidence Matrix, and Remediation tabs', async () => {
    (api.getModelStatus as any).mockResolvedValue(mockModelReady);
    (api.getIncidentInvestigations as any).mockResolvedValue([mockCompletedInvestigation]);
    (api.getInvestigationDetail as any).mockResolvedValue(mockCompletedInvestigation);

    renderWithProviders(
      <GemmaInvestigationPanel
        incidentId="inc-001"
        traceId="trace-demo-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Path Normalization Bug')).toBeInTheDocument();
    });

    // Switch to Evidence Matrix tab
    const matrixTab = screen.getByRole('button', { name: /Evidence Matrix/i });
    fireEvent.click(matrixTab);

    await waitFor(() => {
      expect(screen.getByText('Supporting Events')).toBeInTheDocument();
      expect(screen.getByText('Contradicting Events')).toBeInTheDocument();
      expect(screen.getByText('Missing Tool Sandbox Policy')).toBeInTheDocument();
    });

    // Switch to Remediation Suggestions tab
    const remediationTab = screen.getByRole('button', { name: /Remediation Suggestions/i });
    fireEvent.click(remediationTab);

    await waitFor(() => {
      expect(screen.getByText('Implement directory allowlist for file deletion tools')).toBeInTheDocument();
      expect(screen.getByText(/low risk/i)).toBeInTheDocument();
      expect(screen.getByText(/Human-in-the-Loop Safe Remediation/i)).toBeInTheDocument();
      expect(screen.getByText('Action #1')).toBeInTheDocument();
    });
  });

  it('handles investigation trigger and displays loading state', async () => {
    (api.getModelStatus as any).mockResolvedValue(mockModelReady);
    (api.getIncidentInvestigations as any).mockResolvedValue([]);
    (api.triggerInvestigation as any).mockResolvedValue({
      id: 'inv-queued-1',
      incident_id: 'inc-001',
      trace_id: 'trace-demo-1',
      status: 'queued',
      model_name: 'gemma2:9b',
      prompt_version: 'v1.0.0',
      created_at: '2026-10-19T10:00:00Z',
    });

    renderWithProviders(
      <GemmaInvestigationPanel
        incidentId="inc-001"
        traceId="trace-demo-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigate with Gemma')).toBeInTheDocument();
    });

    const triggerBtn = screen.getByText('Investigate with Gemma');
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      expect(api.triggerInvestigation).toHaveBeenCalledWith('inc-001');
    });
  });

  it('handles failed investigation state and displays failure code & message', async () => {
    const mockFailedInvestigation: InvestigationDetail = {
      ...mockCompletedInvestigation,
      id: 'inv-failed-1',
      status: 'failed',
      failure_code: 'INFERENCE_TIMEOUT',
      failure_message: 'Ollama inference timed out after 180 seconds.',
      hypotheses: [],
      remediation_suggestions: [],
    };

    (api.getModelStatus as any).mockResolvedValue(mockModelReady);
    (api.getIncidentInvestigations as any).mockResolvedValue([mockFailedInvestigation]);
    (api.getInvestigationDetail as any).mockResolvedValue(mockFailedInvestigation);

    renderWithProviders(
      <GemmaInvestigationPanel
        incidentId="inc-001"
        traceId="trace-demo-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Investigation Job Failed')).toBeInTheDocument();
      expect(screen.getByText(/INFERENCE_TIMEOUT/i)).toBeInTheDocument();
      expect(screen.getByText(/Ollama inference timed out after 180 seconds/i)).toBeInTheDocument();
      expect(screen.getByText('Retry Investigation')).toBeInTheDocument();
    });
  });
});
