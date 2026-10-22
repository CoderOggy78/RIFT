import dagre from 'dagre';
import { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 250;
const NODE_HEIGHT = 90;

export interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  nodeSep?: number;
  rankSep?: number;
}

export function computeGraphLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  if (!nodes || nodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const {
    direction = 'TB',
    nodeWidth = NODE_WIDTH,
    nodeHeight = NODE_HEIGHT,
    nodeSep = 60,
    rankSep = 80,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSep,
    ranksep: rankSep,
    align: 'DL',
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    // Only add edge if both source and target exist
    if (dagreGraph.hasNode(edge.source) && dagreGraph.hasNode(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  try {
    dagre.layout(dagreGraph);
  } catch (err) {
    console.warn('[RIFT] Dagre layout warning (falling back to simple vertical grid):', err);
    // Safe deterministic fallback
    return {
      nodes: nodes.map((node, index) => ({
        ...node,
        position: { x: 50, y: index * 120 },
      })),
      edges,
    };
  }

  const positionedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) {
      return node;
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: positionedNodes, edges };
}
