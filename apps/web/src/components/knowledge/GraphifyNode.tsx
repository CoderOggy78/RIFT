import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  FileCode,
  Cpu,
  Terminal,
  Box,
  Layers,
  AlertTriangle,
  Flame,
  ArrowRight,
  GitCommit,
} from 'lucide-react';
import { CodeKnowledgeNode } from '../../types';
import { getCommunityColor } from './forceLayout';

export interface GraphifyNodeData extends Record<string, unknown> {
  node: CodeKnowledgeNode;
  isSelected?: boolean;
  isDimmed?: boolean;
  isFocusedImpact?: boolean;
  isNeighbor?: boolean;
  degree?: number;
  onSelect?: (node: CodeKnowledgeNode) => void;
}

interface NodeProps {
  id: string;
  data: GraphifyNodeData;
}

export const GraphifyNode: React.FC<NodeProps> = memo(({ data }) => {
  const { node, isSelected, isDimmed, isFocusedImpact, isNeighbor } = data;
  const commColors = getCommunityColor(node.community);

  // Determine AST Entity Type
  const isClass = !!node.is_class;
  const isCallable = !!node.is_callable && !isClass;
  const isFile =
    node.file_type !== null &&
    node.file_type !== undefined &&
    node.file_type !== '' &&
    (node.id.endsWith('.py') ||
      node.id.endsWith('.ts') ||
      node.id.endsWith('.tsx') ||
      node.id.endsWith('.json') ||
      node.id.endsWith('.md') ||
      node.id.includes('/'));

  const getTypeIcon = () => {
    if (isFocusedImpact) {
      return <Flame className="w-3.5 h-3.5 text-amber-500 animate-pulse" />;
    }
    if (isClass) {
      return <Cpu className="w-3.5 h-3.5 text-indigo-500" />;
    }
    if (isCallable) {
      return <Terminal className="w-3.5 h-3.5 text-emerald-500" />;
    }
    if (isFile) {
      return <FileCode className="w-3.5 h-3.5 text-sky-500" />;
    }
    return <Box className="w-3.5 h-3.5 text-slate-500" />;
  };

  const getTypeLabel = () => {
    if (isFocusedImpact) return 'POTENTIAL IMPACT';
    if (isClass) return 'CLASS';
    if (isCallable) return 'CALLABLE';
    if (isFile) return node.file_type?.toUpperCase() || 'FILE';
    return 'MODULE';
  };

  // Base card styles
  let cardBorder = `border-[${commColors.border}]`;
  let cardRing = '';
  let cardShadow = 'shadow-sm';

  if (isSelected) {
    cardBorder = 'border-blue-600';
    cardRing = 'ring-2 ring-blue-500/40 ring-offset-1';
    cardShadow = 'shadow-md';
  } else if (isFocusedImpact) {
    cardBorder = 'border-amber-500';
    cardRing = 'ring-2 ring-amber-400/50 ring-offset-1';
    cardShadow = 'shadow-md shadow-amber-500/10';
  } else if (isNeighbor) {
    cardBorder = 'border-slate-400';
    cardRing = 'ring-1 ring-slate-300';
  }

  // Display subtitle
  const subtitle =
    node.source_file && node.source_file !== node.id
      ? node.source_file.split('/').slice(-2).join('/')
      : node.community_name || null;

  return (
    <div
      className={`relative w-[230px] rounded-lg border bg-white text-slate-900 transition-all duration-150 cursor-pointer select-none ${cardBorder} ${cardRing} ${cardShadow} ${
        isDimmed ? 'opacity-25 grayscale-[60%]' : 'opacity-100'
      } ${isSelected ? 'scale-[1.03] z-20' : 'hover:scale-[1.01] hover:border-slate-400'}`}
    >
      {/* 4 Handles for multi-directional connection routing */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-2 !h-2 !bg-slate-300 !border-2 !border-white hover:!bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2 !h-2 !bg-slate-300 !border-2 !border-white hover:!bg-blue-500"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom"
        className="!w-2 !h-2 !bg-slate-300 !border-2 !border-white hover:!bg-blue-500"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!w-2 !h-2 !bg-slate-300 !border-2 !border-white hover:!bg-blue-500"
      />

      {/* Top Header with type & community */}
      <div
        className="px-2.5 py-1 flex items-center justify-between border-b rounded-t-lg text-[10px]"
        style={{
          backgroundColor: isFocusedImpact ? '#fef3c7' : commColors.lightBg,
          borderColor: isFocusedImpact ? '#fde68a' : commColors.badgeBorder,
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {getTypeIcon()}
          <span
            className={`font-mono font-semibold tracking-wider truncate ${
              isFocusedImpact ? 'text-amber-800' : 'text-slate-600'
            }`}
          >
            {getTypeLabel()}
          </span>
        </div>

        {node.community !== undefined && node.community !== null && (
          <span
            className="font-mono text-[9px] px-1.5 py-0.5 rounded border font-medium truncate max-w-[90px]"
            style={{
              backgroundColor: commColors.badgeBg,
              borderColor: commColors.badgeBorder,
              color: commColors.badgeText,
            }}
            title={node.community_name ? `Community #${node.community}: ${node.community_name}` : `Community #${node.community}`}
          >
            {node.community_name ? `C#${node.community} · ${node.community_name}` : `C#${node.community}`}
          </span>
        )}
      </div>

      {/* Node body */}
      <div className="p-2.5 space-y-1">
        <div className="flex items-start justify-between gap-1.5">
          <div
            className="font-mono text-xs font-bold text-slate-900 truncate leading-tight flex-1"
            title={node.label || node.id}
          >
            {node.label || node.id}
          </div>
          {(node.degree !== undefined && node.degree !== null) && (
            <span
              className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-medium shrink-0"
              title={`${node.degree} total connections`}
            >
              deg:{node.degree}
            </span>
          )}
        </div>

        {subtitle && (
          <div
            className="text-[10px] font-mono text-slate-500 truncate"
            title={node.source_file || undefined}
          >
            {subtitle}
            {node.source_location ? `:${node.source_location}` : ''}
          </div>
        )}

        {isFocusedImpact && (
          <div className="pt-1 flex items-center gap-1 text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
            <span className="truncate">Trace Target File</span>
          </div>
        )}
      </div>
    </div>
  );
});

GraphifyNode.displayName = 'GraphifyNode';
