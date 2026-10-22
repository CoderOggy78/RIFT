import React, { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { CodeKnowledgeEdge } from '../../types';

export interface GraphifyEdgeData extends Record<string, unknown> {
  edge: CodeKnowledgeEdge;
  isSelected?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
  onSelect?: (edge: CodeKnowledgeEdge) => void;
}

export const GraphifyEdge: React.FC<EdgeProps> = memo((props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    markerEnd,
  } = props;

  const edgeData = data as GraphifyEdgeData | undefined;
  const isSelected = !!edgeData?.isSelected;
  const isDimmed = !!edgeData?.isDimmed;
  const isHighlighted = !!edgeData?.isHighlighted;
  const edge = edgeData?.edge;

  const isExtracted = edge?.confidence === 'EXTRACTED';
  const isInferred = edge?.confidence === 'INFERRED';

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Stroke color and styling
  let strokeColor = '#94a3b8'; // slate-400 default
  let strokeWidth = 1.5;

  if (isSelected) {
    strokeColor = '#2563eb'; // blue-600
    strokeWidth = 2.5;
  } else if (isHighlighted) {
    strokeColor = '#3b82f6';
    strokeWidth = 2.0;
  } else if (isInferred) {
    strokeColor = '#c084fc'; // purple-400 for inferred
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isInferred ? '5, 4' : undefined,
          opacity: isDimmed ? 0.2 : 0.85,
          transition: 'all 0.15s ease',
        }}
      />

      {/* Interactive Edge Label */}
      {edge && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`nodrag nopan px-1.5 py-0.5 rounded text-[10px] font-mono font-medium cursor-pointer transition-all border ${
              isSelected
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm z-30 scale-105'
                : isInferred
                ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                : 'bg-white/95 text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900 shadow-xs'
            } ${isDimmed ? 'opacity-20' : 'opacity-90'}`}
            onClick={(e) => {
              e.stopPropagation();
              edgeData?.onSelect?.(edge);
            }}
            title={`${edge.relation} (${edge.confidence || 'EXTRACTED'}) · Click to inspect`}
          >
            <span>{edge.relation}</span>
            {isInferred && <span className="ml-1 text-[8px] opacity-75">~inf</span>}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

GraphifyEdge.displayName = 'GraphifyEdge';
