import { GraphNodeData, GraphEdgeData, ExecutionGraph, InvestigationContext, EventDetail } from '../../../types';

export type InvestigationViewMode = 'graph' | 'intent_diff';

export interface GraphFilterState {
  searchQuery: string;
  statusFilter: string; // 'all' | 'error' | 'success'
  typeFilter: string; // 'all' | 'tool_call' | 'validation' | 'agent_plan' | etc.
  suspiciousOnly: boolean;
  focusedPathNodeId: string | null;
}

export interface NodeSelectionState {
  selectedEventId: string | null;
  ancestorIds: Set<string>;
  descendantIds: Set<string>;
}
