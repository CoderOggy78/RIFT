import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { GraphifyNode, GraphifyNodeData } from './GraphifyNode';
import { GraphifyEdge, GraphifyEdgeData } from './GraphifyEdge';
import { computeClusteredForceLayout, getCommunityColor } from './forceLayout';
import { CodeKnowledgeNode, CodeKnowledgeEdge } from '../../types';
import {
  Maximize2,
  Minimize2,
  RotateCw,
  Search,
  Layers,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Filter,
  Sparkles,
} from 'lucide-react';

export interface CodeKnowledgeFlowGraphProps {
  nodes: CodeKnowledgeNode[];
  edges: CodeKnowledgeEdge[];
  selectedNodeId?: string | null;
  selectedEdge?: CodeKnowledgeEdge | null;
  onSelectNode?: (node: CodeKnowledgeNode | null) => void;
  onSelectEdge?: (edge: CodeKnowledgeEdge | null) => void;
  focusFile?: string | null;
  focusNodeId?: string | null;
  isLoading?: boolean;
}

const nodeTypes = {
  graphifyNode: GraphifyNode,
};

const edgeTypes = {
  graphifyEdge: GraphifyEdge,
};

const FlowGraphInner: React.FC<CodeKnowledgeFlowGraphProps> = ({
  nodes,
  edges,
  selectedNodeId,
  selectedEdge,
  onSelectNode,
  onSelectEdge,
  focusFile,
  focusNodeId,
  isLoading,
}) => {
  const { fitView, zoomIn, zoomOut, setCenter } = useReactFlow();
  const [layoutSeed, setLayoutSeed] = useState(0);

  // Compute 2D Positions using clustered force layout
  const layout = useMemo(() => {
    return computeClusteredForceLayout(nodes, edges, {
      iterations: 85,
      width: Math.max(1200, Math.sqrt(nodes.length) * 220),
      height: Math.max(900, Math.sqrt(nodes.length) * 170),
    });
  }, [nodes, edges, layoutSeed]);

  // Set of neighbor IDs for the currently selected node
  const neighborNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const neighbors = new Set<string>();
    edges.forEach((e) => {
      if (e.source === selectedNodeId) neighbors.add(e.target);
      if (e.target === selectedNodeId) neighbors.add(e.source);
    });
    return neighbors;
  }, [selectedNodeId, edges]);

  // Map nodes into React Flow format
  const flowNodes: Node<GraphifyNodeData>[] = useMemo(() => {
    const hasSelection = !!selectedNodeId || !!selectedEdge;

    return nodes.map((node) => {
      const pos = layout.positions.get(node.id) || { x: 0, y: 0 };
      const isSelected = selectedNodeId === node.id;
      const isNeighbor = neighborNodeIds.has(node.id);
      const isEdgeEndpoint =
        selectedEdge &&
        (selectedEdge.source === node.id || selectedEdge.target === node.id);

      const isFocusedImpact =
        (focusFile &&
          (node.source_file === focusFile ||
            node.id === focusFile ||
            (node.source_file && focusFile.endsWith(node.source_file)) ||
            (node.source_file && node.source_file.endsWith(focusFile)))) ||
        (focusNodeId && node.id === focusNodeId);

      const isDimmed =
        hasSelection && !isSelected && !isNeighbor && !isEdgeEndpoint;

      return {
        id: node.id,
        type: 'graphifyNode',
        position: pos,
        data: {
          node,
          isSelected,
          isNeighbor: isNeighbor || !!isEdgeEndpoint,
          isDimmed,
          isFocusedImpact: !!isFocusedImpact,
          degree: node.degree ?? undefined,
          onSelect: () => onSelectNode?.(node),
        },
      };
    });
  }, [
    nodes,
    layout,
    selectedNodeId,
    selectedEdge,
    neighborNodeIds,
    focusFile,
    focusNodeId,
    onSelectNode,
  ]);

  // Map edges into React Flow format
  const flowEdges: Edge<GraphifyEdgeData>[] = useMemo(() => {
    const hasSelection = !!selectedNodeId || !!selectedEdge;

    return edges.map((edge, idx) => {
      const edgeKey = `e-${edge.source}-${edge.target}-${edge.relation}-${idx}`;
      const isSelected =
        selectedEdge &&
        selectedEdge.source === edge.source &&
        selectedEdge.target === edge.target &&
        selectedEdge.relation === edge.relation;

      const isConnectedToSelectedNode =
        selectedNodeId &&
        (edge.source === selectedNodeId || edge.target === selectedNodeId);

      const isDimmed =
        hasSelection && !isSelected && !isConnectedToSelectedNode;

      return {
        id: edgeKey,
        source: edge.source,
        target: edge.target,
        type: 'graphifyEdge',
        data: {
          edge,
          isSelected: !!isSelected,
          isHighlighted: !!isConnectedToSelectedNode,
          isDimmed: !!isDimmed,
          onSelect: () => onSelectEdge?.(edge),
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: isSelected
            ? '#2563eb'
            : edge.confidence === 'INFERRED'
            ? '#c084fc'
            : '#94a3b8',
        },
      };
    });
  }, [edges, selectedNodeId, selectedEdge, onSelectEdge]);

  const [rfNodes, setNodes, onNodesChange] = useNodesState<Node<GraphifyNodeData>>(flowNodes);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState<Edge<GraphifyEdgeData>>(flowEdges);

  // Sync internal state with computed props
  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  // Auto-fit on initial render or when node count changes substantially
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.15, duration: 400 });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView, layoutSeed]);

  // When focusNodeId or focusFile changes, center on that node
  useEffect(() => {
    if (focusNodeId || focusFile) {
      const targetNode = nodes.find(
        (n) =>
          n.id === focusNodeId ||
          (focusFile &&
            (n.source_file === focusFile ||
              n.id === focusFile ||
              (n.source_file && n.source_file.endsWith(focusFile))))
      );
      if (targetNode) {
        const pos = layout.positions.get(targetNode.id);
        if (pos) {
          setCenter(pos.x + 115, pos.y + 40, { zoom: 1.1, duration: 600 });
        }
      }
    }
  }, [focusNodeId, focusFile, nodes, layout, setCenter]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const match = nodes.find((n) => n.id === node.id);
      if (match) {
        onSelectNode?.(match);
      }
    },
    [nodes, onSelectNode]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      const edgeData = edge.data as GraphifyEdgeData | undefined;
      if (edgeData?.edge) {
        onSelectEdge?.(edgeData.edge);
      }
    },
    [onSelectEdge]
  );

  const handlePaneClick = useCallback(() => {
    onSelectNode?.(null);
    onSelectEdge?.(null);
  }, [onSelectNode, onSelectEdge]);

  return (
    <div className="relative w-full h-full bg-slate-900 overflow-hidden">
      {/* React Flow Canvas */}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.08}
        maxZoom={2.5}
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-[#0b1120]"
      >
        <Background color="#334155" gap={24} size={1} />

        {/* Viewport Floating Controls */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-slate-800/90 backdrop-blur-sm border border-slate-700 p-1 rounded-lg shadow-lg">
          <button
            type="button"
            onClick={() => zoomIn({ duration: 250 })}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => zoomOut({ duration: 250 })}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => fitView({ padding: 0.15, duration: 400 })}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Fit to Screen"
            aria-label="Fit to screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-700 mx-0.5" />
          <button
            type="button"
            onClick={() => setLayoutSeed((s) => s + 1)}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs"
            title="Re-run clustered force simulation"
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline font-mono text-[11px]">Reheat</span>
          </button>
        </div>

        {/* MiniMap */}
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(node: any) => {
            if (node.data?.isFocusedImpact) return '#f59e0b';
            const comm = node.data?.node?.community;
            return getCommunityColor(comm).accent;
          }}
          maskColor="rgba(11, 17, 32, 0.75)"
          className="!bottom-4 !right-4 !w-40 !h-28 !bg-slate-900/90 !border !border-slate-800 !rounded-lg overflow-hidden"
        />
      </ReactFlow>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-30 pointer-events-none">
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-700 px-4 py-3 rounded-lg shadow-xl text-slate-200">
            <RotateCw className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="font-mono text-sm font-medium">Computing AST Knowledge Graph...</span>
          </div>
        </div>
      )}

      {/* Empty Search/Filter State */}
      {!isLoading && nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-xl shadow-2xl max-w-md text-center pointer-events-auto">
            <Filter className="w-8 h-8 text-slate-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-200 font-mono mb-1">
              No Matching Graphify Nodes
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No AST symbols or files in the knowledge graph matched your current filter or search criteria.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export const CodeKnowledgeFlowGraph: React.FC<CodeKnowledgeFlowGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowGraphInner {...props} />
    </ReactFlowProvider>
  );
};
