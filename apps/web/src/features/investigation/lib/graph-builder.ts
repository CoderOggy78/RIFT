import { Node, Edge, MarkerType } from '@xyflow/react';
import { ExecutionGraph, GraphNodeData, GraphEdgeData } from '../../../types';
import { computeGraphLayout } from './graph-layout';

export interface GraphBuilderOptions {
  selectedEventId?: string | null;
  focusedPathNodeId?: string | null;
  ancestorIds?: Set<string>;
  descendantIds?: Set<string>;
  onSelectNode?: (id: string) => void;
}

export function buildReactFlowGraph(
  graphData: ExecutionGraph,
  options: GraphBuilderOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    selectedEventId,
    focusedPathNodeId,
    ancestorIds = new Set(),
    descendantIds = new Set(),
    onSelectNode,
  } = options;

  const isPathFocusActive = !!focusedPathNodeId;
  const activePathSet = new Set<string>();
  if (isPathFocusActive && focusedPathNodeId) {
    activePathSet.add(focusedPathNodeId);
    ancestorIds.forEach((id) => activePathSet.add(id));
    descendantIds.forEach((id) => activePathSet.add(id));
  }

  // Build React Flow nodes
  const rawNodes: Node[] = graphData.nodes.map((nodeData: GraphNodeData) => {
    const isSelected = selectedEventId === nodeData.id;
    const isDimmed = isPathFocusActive && !activePathSet.has(nodeData.id);

    return {
      id: nodeData.id,
      type: 'executionNode',
      position: { x: 0, y: 0 },
      data: {
        ...nodeData,
        isSelected,
        isDimmed,
        onSelect: onSelectNode,
      },
    };
  });

  // Build React Flow edges with distinct visual semantics
  const rawEdges: Edge[] = graphData.edges.map((edgeData: GraphEdgeData) => {
    const isConnectingActivePath =
      isPathFocusActive &&
      activePathSet.has(edgeData.source) &&
      activePathSet.has(edgeData.target);
    const isDimmed = isPathFocusActive && !isConnectingActivePath;

    let strokeColor = '#323B4E'; // default subtle border
    let strokeWidth = 1.5;
    let strokeDasharray = undefined;
    let isAnimated = false;
    let markerColor = '#4B5563';

    switch (edgeData.relationship) {
      case 'tool_execution':
        strokeColor = '#818CF8';
        markerColor = '#818CF8';
        strokeWidth = 1.8;
        break;

      case 'validation_dependency':
        strokeColor = '#FBBF24';
        markerColor = '#FBBF24';
        strokeDasharray = '4 3';
        strokeWidth = 1.8;
        break;

      case 'sequence':
        strokeColor = '#4B5563';
        strokeDasharray = '3 3';
        strokeWidth = 1.2;
        break;

      case 'inferred_causal':
        strokeColor = '#FB7185';
        markerColor = '#FB7185';
        strokeDasharray = '5 4';
        isAnimated = true;
        strokeWidth = 2;
        break;

      case 'parent_child':
      default:
        strokeColor = edgeData.is_flagged ? '#FB7185' : '#323B4E';
        markerColor = edgeData.is_flagged ? '#FB7185' : '#4B5563';
        strokeWidth = edgeData.is_flagged ? 2 : 1.5;
        break;
    }

    if (edgeData.is_flagged && edgeData.relationship !== 'inferred_causal') {
      strokeColor = '#FB7185';
      markerColor = '#FB7185';
    }

    return {
      id: edgeData.id,
      source: edgeData.source,
      target: edgeData.target,
      type: 'smoothstep',
      animated: isAnimated,
      label: edgeData.label || undefined,
      labelStyle: {
        fill: '#9299AA',
        fontSize: 10,
        fontFamily: 'monospace',
      },
      labelBgStyle: {
        fill: '#11151D',
        fillOpacity: 0.9,
      },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      style: {
        stroke: strokeColor,
        strokeWidth,
        strokeDasharray,
        opacity: isDimmed ? 0.15 : 1,
        transition: 'opacity 0.2s ease, stroke 0.2s ease',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: markerColor,
        width: 14,
        height: 14,
      },
    };
  });

  // Calculate layout
  return computeGraphLayout(rawNodes, rawEdges);
}
