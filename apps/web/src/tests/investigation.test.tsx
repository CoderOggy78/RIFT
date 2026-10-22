import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { computeGraphLayout } from '../features/investigation/lib/graph-layout';
import { buildReactFlowGraph } from '../features/investigation/lib/graph-builder';
import { ExecutionGraph, Span, Detection, IntentVsExecution } from '../types';
import { ExecutionTimeline } from '../features/investigation/components/ExecutionTimeline';
import { IntentExecutionView } from '../features/investigation/components/IntentExecutionView';
import { EvidenceInspector } from '../features/investigation/components/EvidenceInspector';
import { EventOverview } from '../features/investigation/components/EventOverview';

// Mock sample execution graph data
const sampleGraph: ExecutionGraph = {
  trace_id: 'trace-test-123',
  nodes: [
    {
      id: 'span-1',
      label: 'User Prompt',
      event_type: 'user_prompt',
      status: 'success',
      duration_ms: 12,
      timestamp: '2026-10-19T10:00:00Z',
      tool_name: null,
      is_suspicious: false,
      severity: null,
      rule_ids: [],
      is_first_suspicious: false,
      depth: 0,
    },
    {
      id: 'span-2',
      label: 'Plan Operations',
      event_type: 'agent_plan',
      status: 'success',
      duration_ms: 85,
      timestamp: '2026-10-19T10:00:01Z',
      tool_name: null,
      is_suspicious: false,
      severity: null,
      rule_ids: [],
      is_first_suspicious: false,
      parent_span_id: 'span-1',
      depth: 1,
    },
    {
      id: 'span-3',
      label: 'Delete Source File',
      event_type: 'tool_call',
      status: 'error',
      duration_ms: 210,
      timestamp: '2026-10-19T10:00:02Z',
      tool_name: 'delete_file',
      is_suspicious: true,
      severity: 'Critical',
      rule_ids: ['RIFT-001'],
      is_first_suspicious: true,
      parent_span_id: 'span-2',
      depth: 2,
    },
    {
      id: 'span-4',
      label: 'Tool Result: Failure',
      event_type: 'tool_result',
      status: 'error',
      duration_ms: 5,
      timestamp: '2026-10-19T10:00:03Z',
      tool_name: 'delete_file',
      is_suspicious: true,
      severity: 'Critical',
      rule_ids: ['RIFT-001'],
      is_first_suspicious: false,
      parent_span_id: 'span-3',
      depth: 3,
    },
  ],
  edges: [
    {
      id: 'e-1-2',
      source: 'span-1',
      target: 'span-2',
      relationship: 'parent_child',
      is_flagged: false,
    },
    {
      id: 'e-2-3',
      source: 'span-2',
      target: 'span-3',
      relationship: 'parent_child',
      is_flagged: true,
    },
    {
      id: 'e-3-4',
      source: 'span-3',
      target: 'span-4',
      relationship: 'tool_execution',
      is_flagged: true,
    },
  ],
  root_event_ids: ['span-1'],
};

const sampleSpans: Span[] = [
  {
    id: 'span-1',
    trace_id: 'trace-test-123',
    parent_span_id: null,
    event_type: 'user_prompt',
    name: 'User Prompt',
    timestamp: '2026-10-19T10:00:00Z',
    duration_ms: 12,
    status: 'success',
    input_data: { prompt: 'Clean temporary files in /tmp without modifying src' },
    output_data: {},
    error_data: {},
    metadata_payload: {},
  },
  {
    id: 'span-2',
    trace_id: 'trace-test-123',
    parent_span_id: 'span-1',
    event_type: 'agent_plan',
    name: 'Plan Operations',
    timestamp: '2026-10-19T10:00:01Z',
    duration_ms: 85,
    status: 'success',
    input_data: {},
    output_data: { plan: 'Find and remove temporary files' },
    error_data: {},
    metadata_payload: {},
  },
  {
    id: 'span-3',
    trace_id: 'trace-test-123',
    parent_span_id: 'span-2',
    event_type: 'tool_call',
    name: 'delete_file("src/config.ts")',
    timestamp: '2026-10-19T10:00:02Z',
    duration_ms: 210,
    status: 'error',
    input_data: { path: 'src/config.ts' },
    output_data: {},
    error_data: { message: 'Permission denied / protected file targeted' },
    metadata_payload: {},
  },
];

const sampleDetections: Detection[] = [
  {
    id: 'det-1',
    incident_id: 'inc-1',
    trace_id: 'trace-test-123',
    rule_id: 'RIFT-001',
    title: 'Accidental Source File Deletion',
    description: 'Agent attempted to delete protected repository source file src/config.ts',
    severity: 'Critical',
    verification_status: 'CONFIRMED',
    details: {},
    created_at: '2026-10-19T10:05:00Z',
    evidence: [
      {
        id: 'ev-1',
        detection_id: 'det-1',
        trace_id: 'trace-test-123',
        event_id: 'span-3',
        evidence_type: 'tool_call_argument',
        description: 'delete_file invoked with path src/config.ts',
      },
    ],
  },
];

const sampleIntentVsExecution: IntentVsExecution = {
  intent: {
    user_objective: 'Clean temporary files without modifying source files',
    explicit_instructions: ['Do not touch src/ directory', 'Only delete .tmp files'],
    declared_plan: '1. Scan /tmp for scratch files\n2. Delete detected scratch files',
  },
  observed: {
    destructive_operations: [
      {
        event_id: 'span-3',
        tool: 'delete_file',
        target_path: 'src/config.ts',
        timestamp: '2026-10-19T10:00:02Z',
        status: 'error',
        is_protected: true,
      },
    ],
    failed_operations: [],
    failed_validations: [],
    unexpected_state_changes: [],
    findings: [
      {
        rule_id: 'RIFT-001',
        title: 'Accidental Source File Deletion',
        severity: 'Critical',
        description: 'Agent attempted to delete protected source file src/config.ts',
        verification_status: 'CONFIRMED',
        evidence_events: ['span-3'],
      },
    ],
  },
  has_deviations: true,
};

describe('Investigation Graph Engine', () => {
  it('computes deterministic Dagre layout with ordered coordinates', () => {
    const rawNodes = sampleGraph.nodes.map((n) => ({
      id: n.id,
      data: n,
      position: { x: 0, y: 0 },
    }));
    const rawEdges = sampleGraph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: e,
    }));

    const { nodes: layoutNodes, edges: layoutEdges } = computeGraphLayout(rawNodes as any, rawEdges as any);

    expect(layoutNodes).toHaveLength(4);
    expect(layoutEdges).toHaveLength(3);

    // Root node should have lower y position than its children in TB layout
    const node1 = layoutNodes.find((n) => n.id === 'span-1')!;
    const node2 = layoutNodes.find((n) => n.id === 'span-2')!;
    const node3 = layoutNodes.find((n) => n.id === 'span-3')!;

    expect(node1.position.y).toBeLessThan(node2.position.y);
    expect(node2.position.y).toBeLessThan(node3.position.y);
  });

  it('handles empty graphs and disconnected nodes without throwing', () => {
    const emptyResult = computeGraphLayout([], []);
    expect(emptyResult.nodes).toEqual([]);
    expect(emptyResult.edges).toEqual([]);

    const singleNodeResult = computeGraphLayout(
      [{ id: 'lonely', data: {} as any, position: { x: 0, y: 0 } }],
      []
    );
    expect(singleNodeResult.nodes).toHaveLength(1);
    expect(singleNodeResult.nodes[0].position.x).toBeDefined();
  });

  it('builds React Flow graph with correct node semantics and dimmed unselected path', () => {
    const { nodes, edges } = buildReactFlowGraph(sampleGraph, {
      selectedEventId: 'span-3',
      focusedPathNodeId: 'span-3',
      ancestorIds: new Set(['span-1', 'span-2']),
      descendantIds: new Set(['span-4']),
    });

    expect(nodes).toHaveLength(4);
    expect(edges).toHaveLength(3);

    const node3 = nodes.find((n) => n.id === 'span-3')!;
    expect(node3.data.isSelected).toBe(true);
    expect(node3.data.isDimmed).toBe(false);

    // Edge styling
    const edgeTool = edges.find((e) => e.id === 'e-3-4')!;
    expect(edgeTool.style?.stroke).toBe('#FB7185'); // Flagged edge takes critical color
  });
});

describe('Execution Timeline Component', () => {
  it('renders events with timestamps and tool names', () => {
    const onSelect = vi.fn();
    render(
      <ExecutionTimeline
        spans={sampleSpans}
        detections={sampleDetections}
        firstSuspiciousEventId="span-3"
        selectedEventId="span-3"
        onSelectEvent={onSelect}
      />
    );

    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('delete_file("src/config.ts")')).toBeInTheDocument();
  });

  it('filters timeline events via search input', () => {
    const onSelect = vi.fn();
    render(
      <ExecutionTimeline
        spans={sampleSpans}
        detections={sampleDetections}
        firstSuspiciousEventId="span-3"
        selectedEventId={null}
        onSelectEvent={onSelect}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search events/i);
    fireEvent.change(searchInput, { target: { value: 'config.ts' } });

    expect(screen.getByText('delete_file("src/config.ts")')).toBeInTheDocument();
    expect(screen.queryByText('Plan Operations')).not.toBeInTheDocument();
  });

  it('selects event when timeline entry is clicked', () => {
    const onSelect = vi.fn();
    render(
      <ExecutionTimeline
        spans={sampleSpans}
        detections={sampleDetections}
        firstSuspiciousEventId="span-3"
        selectedEventId={null}
        onSelectEvent={onSelect}
      />
    );

    const item = screen.getByText('Plan Operations');
    fireEvent.click(item);

    expect(onSelect).toHaveBeenCalledWith('span-2');
  });
});

describe('Intent vs Execution View', () => {
  it('renders user intent alongside observed destructive operations and findings', () => {
    const onSelect = vi.fn();
    render(
      <IntentExecutionView
        data={sampleIntentVsExecution}
        onSelectEvent={onSelect}
      />
    );

    expect(screen.getByText('Intent vs Execution Analysis')).toBeInTheDocument();
    expect(screen.getByText('Agent Intent')).toBeInTheDocument();
    expect(screen.getByText('Observed Execution')).toBeInTheDocument();
    expect(screen.getByText('Clean temporary files without modifying source files')).toBeInTheDocument();
    expect(screen.getByText('delete_file()')).toBeInTheDocument();
    expect(screen.getByText('PROTECTED')).toBeInTheDocument();
    expect(screen.getByText('Accidental Source File Deletion')).toBeInTheDocument();
  });

  it('triggers onSelectEvent when clicking a destructive operation', () => {
    const onSelect = vi.fn();
    render(
      <IntentExecutionView
        data={sampleIntentVsExecution}
        onSelectEvent={onSelect}
      />
    );

    const opCard = screen.getByText('delete_file()').closest('div');
    if (opCard) fireEvent.click(opCard);

    expect(onSelect).toHaveBeenCalledWith('span-3');
  });
});

describe('Evidence Inspector Panel', () => {
  it('displays event overview, inputs, and errors across tabs', () => {
    const onNavigate = vi.fn();
    render(
      <MemoryRouter>
        <EvidenceInspector
          span={sampleSpans[2]}
          traceId="trace-test-123"
          ancestorIds={['span-2', 'span-1']}
          childIds={[]}
          allDetections={sampleDetections}
          isFirstSuspicious={true}
          onNavigateToEvent={onNavigate}
        />
      </MemoryRouter>
    );

    // Initial Overview tab
    expect(screen.getAllByText('delete_file("src/config.ts")').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('First Suspicious Event')).toBeInTheDocument();

    // Click Inputs tab
    const inputsTab = screen.getByText('Inputs');
    fireEvent.click(inputsTab);
    expect(screen.getByText('Structured Tool Arguments / Prompts')).toBeInTheDocument();

    // Click Errors tab
    const errorsTab = screen.getByText('Errors');
    fireEvent.click(errorsTab);
    expect(screen.getByText('Execution Error Detected')).toBeInTheDocument();
    expect(screen.getByText('Permission denied / protected file targeted')).toBeInTheDocument();

    // Click Evidence tab
    const evidenceTab = screen.getByText('Evidence');
    fireEvent.click(evidenceTab);
    expect(screen.getByText('Accidental Source File Deletion')).toBeInTheDocument();
    expect(screen.getByText('delete_file invoked with path src/config.ts')).toBeInTheDocument();
  });

  it('renders clean empty state when no event is selected', () => {
    render(
      <MemoryRouter>
        <EvidenceInspector
          span={null}
          traceId="trace-test-123"
          ancestorIds={[]}
          childIds={[]}
          allDetections={[]}
          isFirstSuspicious={false}
          onNavigateToEvent={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('No Event Selected')).toBeInTheDocument();
  });
});
