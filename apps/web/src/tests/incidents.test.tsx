import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { IncidentsPage } from '../pages/IncidentsPage';
import { IncidentDetailPage } from '../pages/IncidentDetailPage';
import { api } from '../lib/api';

// Mock the API client
vi.mock('../lib/api', () => ({
  api: {
    getDetectionSummary: vi.fn(),
    listIncidents: vi.fn(),
    getIncident: vi.fn(),
    getTrace: vi.fn(),
    runTraceDetection: vi.fn(),
    getTraceDetections: vi.fn(),
    getModelStatus: vi.fn(),
    getIncidentInvestigations: vi.fn(),
    investigateIncident: vi.fn(),
  },
}));

const mockSummary = {
  total_incidents: 2,
  critical_incidents: 1,
  high_incidents: 1,
  open_incidents: 2,
  resolved_incidents: 0,
  traces_with_incidents: 2,
};

const mockIncidents = [
  {
    id: 'inc-001',
    trace_id: 'trace-demo-1',
    title: "Unsafe Deletion of 'src/config.ts'",
    description: 'Agent called delete_file on protected file src/config.ts.',
    severity: 'Critical',
    status: 'open',
    first_suspicious_event_id: 'span-003',
    created_at: '2026-10-19T10:00:00Z',
    updated_at: '2026-10-19T10:00:00Z',
    agent_name: 'Cleaner Bot',
    project_name: 'Core API',
    detection_count: 2,
  },
  {
    id: 'inc-002',
    trace_id: 'trace-demo-2',
    title: 'Repeated Tool Failure Loop',
    description: '3 consecutive tool failures detected.',
    severity: 'High',
    status: 'open',
    first_suspicious_event_id: 'span-005',
    created_at: '2026-10-19T11:00:00Z',
    updated_at: '2026-10-19T11:00:00Z',
    agent_name: 'Migration Worker',
    project_name: 'DB Microservice',
    detection_count: 1,
  },
];

const mockIncidentDetail = {
  id: 'inc-001',
  trace_id: 'trace-demo-1',
  title: "Unsafe Deletion of 'src/config.ts'",
  description: 'Deterministic incident triggered by 2 detections. Agent called delete_file on protected file.',
  severity: 'Critical',
  status: 'open',
  first_suspicious_event_id: 'span-003',
  created_at: '2026-10-19T10:00:00Z',
  updated_at: '2026-10-19T10:00:00Z',
  agent_id: 'agent-1',
  agent_name: 'Cleaner Bot',
  agent_framework: 'LangGraph',
  project_id: 'proj-1',
  project_name: 'Core API',
  trace_objective: 'Clean workspace caches',
  detections: [
    {
      id: 'det-001',
      incident_id: 'inc-001',
      trace_id: 'trace-demo-1',
      rule_id: 'RULE-001',
      title: "Unsafe Deletion of 'src/config.ts'",
      description: 'Agent called deletion tool delete_file on protected location src/config.ts.',
      severity: 'Critical',
      verification_status: 'CONFIRMED',
      details: {},
      created_at: '2026-10-19T10:00:00Z',
      evidence: [
        {
          id: 'ev-1',
          detection_id: 'det-001',
          trace_id: 'trace-demo-1',
          event_id: 'span-003',
          evidence_type: 'DESTRUCTIVE_CALL',
          description: "Tool call 'delete_file' targeted protected path 'src/config.ts'.",
        },
      ],
    },
  ],
};

const mockTraceDetail = {
  id: 'trace-demo-1',
  project_id: 'proj-1',
  project_name: 'Core API',
  agent_id: 'agent-1',
  agent_name: 'Cleaner Bot',
  agent_framework: 'LangGraph',
  objective: 'Clean workspace caches',
  status: 'error',
  started_at: '2026-10-19T10:00:00Z',
  ended_at: '2026-10-19T10:00:05Z',
  duration_ms: 5000,
  created_at: '2026-10-19T10:00:00Z',
  spans: [
    {
      id: 'span-001',
      trace_id: 'trace-demo-1',
      parent_span_id: null,
      event_type: 'user_prompt',
      name: 'User Prompt',
      timestamp: '2026-10-19T10:00:00Z',
      duration_ms: 10,
      status: 'success',
      input_data: { prompt: 'Clean temp files' },
      output_data: {},
      error_data: {},
      metadata_payload: {},
    },
    {
      id: 'span-003',
      trace_id: 'trace-demo-1',
      parent_span_id: 'span-001',
      event_type: 'tool_call',
      name: 'tool:delete_file',
      timestamp: '2026-10-19T10:00:02Z',
      duration_ms: 45,
      status: 'success',
      input_data: { tool: 'delete_file', path: 'src/config.ts' },
      output_data: {},
      error_data: {},
      metadata_payload: {},
    },
  ],
};

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SeverityBadge', () => {
  it('renders Critical severity badge with correct styling', () => {
    render(<SeverityBadge severity="Critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders High severity badge', () => {
    render(<SeverityBadge severity="High" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders Medium severity badge', () => {
    render(<SeverityBadge severity="Medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });
});

describe('IncidentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getDetectionSummary as any).mockResolvedValue(mockSummary);
    (api.listIncidents as any).mockResolvedValue(mockIncidents);
  });

  it('renders KPI summary metrics from backend', async () => {
    renderWithProviders(<IncidentsPage />);

    expect(screen.getByText('Incident Management')).toBeInTheDocument();
    expect(screen.getByText('Rule-Based Engine')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total Incidents')).toBeInTheDocument();
      // Total count 2 appears in KPI cards
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });

  it('renders incident table with incident IDs, titles, and severities', async () => {
    renderWithProviders(<IncidentsPage />);

    await waitFor(() => {
      expect(screen.getByText('inc-001')).toBeInTheDocument();
      expect(screen.getByText('inc-002')).toBeInTheDocument();
      expect(screen.getAllByText("Unsafe Deletion of 'src/config.ts'").length).toBeGreaterThan(0);
      expect(screen.getByText('Repeated Tool Failure Loop')).toBeInTheDocument();
      expect(screen.getByText('Cleaner Bot')).toBeInTheDocument();
      expect(screen.getByText('span-003')).toBeInTheDocument();
    });
  });

  it('renders empty state when no incidents match', async () => {
    (api.listIncidents as any).mockResolvedValue([]);
    (api.getDetectionSummary as any).mockResolvedValue({
      total_incidents: 0,
      critical_incidents: 0,
      high_incidents: 0,
      open_incidents: 0,
      resolved_incidents: 0,
      traces_with_incidents: 0,
    });

    renderWithProviders(<IncidentsPage />);

    await waitFor(() => {
      expect(screen.getByText('No incidents found')).toBeInTheDocument();
    });
  });
});

describe('IncidentDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getIncident as any).mockResolvedValue(mockIncidentDetail);
    (api.getTrace as any).mockResolvedValue(mockTraceDetail);
    (api.getModelStatus as any).mockResolvedValue({
      status: 'ready',
      configured_model: 'gemma2:9b',
      reachable: true,
      model_available: true,
      error_message: null,
      setup_instructions: [],
      installed_models: ['gemma2:9b'],
    });
    (api.getIncidentInvestigations as any).mockResolvedValue([]);
  });

  it('renders incident detail header, rule-based summary, and first suspicious event', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
      </Routes>,
      '/incidents/inc-001'
    );

    await waitFor(() => {
      expect(screen.getAllByText("Unsafe Deletion of 'src/config.ts'").length).toBeGreaterThan(0);
      expect(screen.getByText('Rule-Based Detection Summary')).toBeInTheDocument();
      expect(screen.getByText('First Suspicious Event')).toBeInTheDocument();
      expect(screen.getByText('View in Trace')).toBeInTheDocument();
      expect(screen.getByText('RULE-001')).toBeInTheDocument();
      expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
      expect(screen.getByText('Investigate with Gemma')).toBeInTheDocument();
      expect(screen.getByText(/Gemma AI Investigation/i)).toBeInTheDocument();
    });
  });
});
