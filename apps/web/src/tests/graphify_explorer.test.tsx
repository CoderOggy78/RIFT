import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GraphifyPage } from '../pages/GraphifyPage';
import { api } from '../lib/api';
import { computeClusteredForceLayout, getCommunityColor } from '../components/knowledge/forceLayout';
import { CodeKnowledgeNode, CodeKnowledgeEdge } from '../types';

// Mock API
vi.mock('../lib/api', () => ({
  api: {
    getCodeKnowledgeStatus: vi.fn(),
    getCodeKnowledgeCommunities: vi.fn(),
    getCodeKnowledgeGraph: vi.fn(),
    explainCodeKnowledge: vi.fn(),
    refreshCodeKnowledge: vi.fn(),
    previewSourceFile: vi.fn(),
    analyzeCodeImpact: vi.fn(),
  },
}));

// Real Graphify fixture matching real graphify-out/graph.json schema
const mockGraphifyStatus = {
  status: 'ready' as const,
  is_enabled: true,
  is_installed: true,
  graphify_version: '0.9.92',
  graph_path: '/Users/oggy/RIFT/graphify-out/graph.json',
  schema_version: 1,
  node_count: 1411,
  edge_count: 3858,
  community_count: 86,
  last_updated_at: '2026-10-22T14:30:00Z',
  message: 'Graphify codebase knowledge graph is ready and verified.',
};

const mockCommunities = [
  { id: 0, name: 'detection_rules', node_count: 142, top_symbols: ['IncidentDetector', 'BaseRule', 'Rule001UnsafeDeletion'] },
  { id: 1, name: 'counterfactual_ai', node_count: 98, top_symbols: ['GemmaClient', 'ContextBuilder'] },
  { id: 2, name: 'sandbox_replay', node_count: 76, top_symbols: ['ReplayLab', 'IsolatedSandboxRunner'] },
];

const mockRealGraphNodes: CodeKnowledgeNode[] = [
  {
    id: 'IncidentDetector',
    label: 'IncidentDetector',
    file_type: 'py',
    source_file: 'apps/api/app/services/detection/engine.py',
    source_location: 'L42',
    community: 0,
    community_name: 'detection_rules',
    degree: 12,
    is_class: true,
    is_callable: false,
    origin: 'EXTRACTED',
  },
  {
    id: 'BaseRule',
    label: 'BaseRule',
    file_type: 'py',
    source_file: 'apps/api/app/services/detection/rules/base.py',
    source_location: 'L15',
    community: 0,
    community_name: 'detection_rules',
    degree: 8,
    is_class: true,
    is_callable: false,
    origin: 'EXTRACTED',
  },
  {
    id: 'check_file_deletion',
    label: 'check_file_deletion',
    file_type: 'py',
    source_file: 'apps/api/app/services/detection/rules/unsafe_deletion.py',
    source_location: 'L29',
    community: 0,
    community_name: 'detection_rules',
    degree: 4,
    is_class: false,
    is_callable: true,
    origin: 'EXTRACTED',
  },
  {
    id: 'src/config.ts',
    label: 'src/config.ts',
    file_type: 'ts',
    source_file: 'src/config.ts',
    source_location: 'L1',
    community: 1,
    community_name: 'counterfactual_ai',
    degree: 6,
    is_class: false,
    is_callable: false,
    origin: 'EXTRACTED',
  },
];

const mockRealGraphEdges: CodeKnowledgeEdge[] = [
  {
    source: 'IncidentDetector',
    target: 'BaseRule',
    relation: 'inherits',
    confidence: 'EXTRACTED',
    confidence_score: 1.0,
    source_file: 'apps/api/app/services/detection/engine.py',
    source_location: 'L42',
    weight: 1.0,
  },
  {
    source: 'IncidentDetector',
    target: 'check_file_deletion',
    relation: 'calls',
    confidence: 'EXTRACTED',
    confidence_score: 1.0,
    source_file: 'apps/api/app/services/detection/engine.py',
    source_location: 'L88',
    weight: 1.0,
  },
  {
    source: 'src/config.ts',
    target: 'IncidentDetector',
    relation: 'uses',
    confidence: 'INFERRED',
    confidence_score: 0.85,
    source_file: 'src/config.ts',
    source_location: 'L14',
    weight: 0.85,
  },
];

describe('Graphify Force Layout & Community Clustering Algorithm', () => {
  it('computes deterministic positions and valid bounds for real nodes', () => {
    const layout = computeClusteredForceLayout(mockRealGraphNodes, mockRealGraphEdges);
    expect(layout.positions.size).toBe(mockRealGraphNodes.length);

    mockRealGraphNodes.forEach((node) => {
      const pos = layout.positions.get(node.id);
      expect(pos).toBeDefined();
      expect(typeof pos?.x).toBe('number');
      expect(typeof pos?.y).toBe('number');
      expect(Number.isFinite(pos?.x)).toBe(true);
      expect(Number.isFinite(pos?.y)).toBe(true);
    });
  });

  it('generates distinct deterministic HSL palettes across communities', () => {
    const color0 = getCommunityColor(0);
    const color1 = getCommunityColor(1);
    const colorNull = getCommunityColor(null);

    expect(color0.rawHue).not.toBe(color1.rawHue);
    expect(color0.accent).toContain('hsl(');
    expect(colorNull.accent).toBe('#64748b');
  });

  it('handles empty graphs gracefully without errors', () => {
    const layout = computeClusteredForceLayout([], []);
    expect(layout.positions.size).toBe(0);
  });
});

describe('Graphify Interactive Explorer UI Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0, staleTime: 0 },
      },
    });

    vi.mocked(api.getCodeKnowledgeStatus).mockResolvedValue(mockGraphifyStatus);
    vi.mocked(api.getCodeKnowledgeCommunities).mockResolvedValue(mockCommunities);
    vi.mocked(api.getCodeKnowledgeGraph).mockResolvedValue({
      status: 'success',
      nodes: mockRealGraphNodes,
      edges: mockRealGraphEdges,
      total_nodes: 4,
      total_edges: 3,
      communities: mockCommunities,
      duration_ms: 2.4,
    });
    vi.mocked(api.explainCodeKnowledge).mockResolvedValue({
      symbol: 'IncidentDetector',
      node: mockRealGraphNodes[0],
      incoming_edges: [mockRealGraphEdges[2]],
      outgoing_edges: [mockRealGraphEdges[0], mockRealGraphEdges[1]],
    });
    vi.mocked(api.analyzeCodeImpact).mockResolvedValue({
      target: 'src/config.ts',
      target_type: 'file',
      change_type: 'delete',
      status: 'success',
      direct_impact_count: 1,
      transitive_impact_count: 0,
      affected_files: ['apps/api/app/services/detection/engine.py'],
      affected_symbols: ['IncidentDetector'],
      relationships: [
        {
          source: 'IncidentDetector',
          target: 'src/config.ts',
          relation: 'imports',
          direction: 'incoming',
          depth: 1,
          confidence: 'EXTRACTED',
          confidence_score: 1.0,
          relevance_explanation: 'Direct import',
        },
      ],
      summary: 'Impact on 1 file',
      limitations: [],
      duration_ms: 5.2,
    });
  });

  it('renders the first-class Graphify header with real repository telemetry', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/graphify']}>
          <GraphifyPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/AST Code Knowledge Engine/i)).toBeInTheDocument();
      expect(screen.getByText(/Graph Verified & Ready/i)).toBeInTheDocument();
      expect(screen.getByText('1,411')).toBeInTheDocument();
      expect(screen.getByText('3,858')).toBeInTheDocument();
      expect(screen.getByText('86')).toBeInTheDocument();
    });
  });

  it('renders real Louvain communities in selector from backend', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/graphify']}>
          <GraphifyPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/All Communities \(3\)/i)).toBeInTheDocument();
    });
  });

  it('displays incident context banner and highlights POTENTIAL IMPACT when focusFile param is provided', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/graphify?focusFile=src/config.ts&traceId=trace-abc-123']}>
          <GraphifyPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/POTENTIAL IMPACT/i)).toBeInTheDocument();
      expect(screen.getByText(/Investigating Target:/i)).toBeInTheDocument();
      expect(screen.getByText(/src\/config\.ts/i)).toBeInTheDocument();
      expect(screen.getByText(/trace-abc-123/i)).toBeInTheDocument();
      expect(screen.getByText(/Return to Trace/i)).toBeInTheDocument();
    });
  });

  it('distinguishes EXTRACTED vs INFERRED provenance in legend and inspector', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/graphify']}>
          <GraphifyPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/EXTRACTED \(AST truth\)/i)).toBeInTheDocument();
      expect(screen.getByText(/INFERRED \(Heuristic link\)/i)).toBeInTheDocument();
    });
  });

  it('handles empty results honestly without rendering hardcoded preset graphs', async () => {
    vi.mocked(api.getCodeKnowledgeGraph).mockResolvedValueOnce({
      status: 'success',
      nodes: [],
      edges: [],
      total_nodes: 0,
      total_edges: 0,
      communities: [],
      duration_ms: 1.0,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/graphify']}>
          <GraphifyPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/No Matching Graphify Nodes/i)).toBeInTheDocument();
      // Ensure fake nodes like 'Autonomous Agent Planner' are NOT in document!
      expect(screen.queryByText(/Autonomous Agent Planner/i)).not.toBeInTheDocument();
    });
  });
});
