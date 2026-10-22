import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { ExecutionGraph as ExecutionGraphType } from '../../../types';
import { GraphNode } from './GraphNode';
import { GraphControls } from './GraphControls';
import { buildReactFlowGraph } from '../lib/graph-builder';

interface ExecutionGraphProps {
  graphData: ExecutionGraphType;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
  ancestorIds: Set<string>;
  descendantIds: Set<string>;
  isPathFocusActive: boolean;
  onTogglePathFocus: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const nodeTypes = {
  executionNode: GraphNode,
};

const InnerExecutionGraph: React.FC<ExecutionGraphProps> = ({
  graphData,
  selectedEventId,
  onSelectEvent,
  ancestorIds,
  descendantIds,
  isPathFocusActive,
  onTogglePathFocus,
  isFullscreen,
  onToggleFullscreen,
}) => {
  // Transform graph data into React Flow nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return buildReactFlowGraph(graphData, {
      selectedEventId,
      focusedPathNodeId: isPathFocusActive ? selectedEventId : null,
      ancestorIds,
      descendantIds,
      onSelectNode: onSelectEvent,
    });
  }, [
    graphData,
    selectedEventId,
    isPathFocusActive,
    ancestorIds,
    descendantIds,
    onSelectEvent,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state whenever transformed nodes/edges change
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectEvent(node.id);
    },
    [onSelectEvent]
  );

  return (
    <div className={`relative w-full h-full bg-[#F8F9FA] ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        className="rift-flow-canvas"
      >
        <Background color="#D1D5DB" gap={24} size={1} />
        <MiniMap
          nodeColor={(node: any) => {
            if (node.data?.is_first_suspicious) return '#D97706';
            if (node.data?.is_suspicious) return '#DC2626';
            if (node.data?.status === 'error') return '#DC2626';
            return '#9CA3AF';
          }}
          maskColor="rgba(248, 249, 250, 0.75)"
          className="!bg-white !border !border-gray-200 !rounded-xl !shadow-sm"
          position="bottom-left"
          style={{ width: 140, height: 95 }}
        />
        <GraphControls
          isPathFocusActive={isPathFocusActive}
          onTogglePathFocus={onTogglePathFocus}
          selectedEventId={selectedEventId}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
        />
      </ReactFlow>
    </div>
  );
};

export const ExecutionGraph: React.FC<ExecutionGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <InnerExecutionGraph {...props} />
    </ReactFlowProvider>
  );
};
