import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Brain,
  Cpu,
  FileCode,
  ShieldAlert,
  Box,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export interface CodeKnowledgeFlowNodeData {
  id: string;
  label: string;
  category: 'agent' | 'rule' | 'code' | 'sandbox' | 'trace';
  file_type?: string | null;
  source_file?: string | null;
  source_location?: string | null;
  community?: number | null;
  community_name?: string | null;
  subtitle?: string;
  badge?: string;
  inDegree?: number;
  outDegree?: number;
  isSelected?: boolean;
  isDimmed?: boolean;
  onSelect?: (id: string) => void;
}

interface NodeProps {
  id: string;
  data: CodeKnowledgeFlowNodeData;
}

export const CodeKnowledgeFlowNode: React.FC<NodeProps> = memo(({ id, data }) => {
  const isSelected = !!data.isSelected;
  const isDimmed = !!data.isDimmed;

  // Category visual themes
  const getCategoryStyles = () => {
    switch (data.category) {
      case 'agent':
        return {
          border: isSelected ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-purple-200 hover:border-purple-400',
          bg: 'bg-white',
          headerBg: 'bg-purple-50 border-b border-purple-100',
          badgeBg: 'bg-purple-100 text-purple-800 border-purple-200',
          iconColor: 'text-purple-600',
          icon: <Brain className="w-3.5 h-3.5 text-purple-600" />,
          titleColor: 'text-purple-950',
          typeLabel: 'AI AGENT',
        };
      case 'rule':
        return {
          border: isSelected ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-rose-200 hover:border-rose-400',
          bg: 'bg-white',
          headerBg: 'bg-rose-50 border-b border-rose-100',
          badgeBg: 'bg-rose-100 text-rose-800 border-rose-200',
          iconColor: 'text-rose-600',
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />,
          titleColor: 'text-rose-950',
          typeLabel: 'SAFETY RULE',
        };
      case 'sandbox':
        return {
          border: isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-blue-200 hover:border-blue-400',
          bg: 'bg-white',
          headerBg: 'bg-blue-50 border-b border-blue-100',
          badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
          iconColor: 'text-blue-600',
          icon: <Box className="w-3.5 h-3.5 text-blue-600" />,
          titleColor: 'text-blue-950',
          typeLabel: 'SANDBOX',
        };
      case 'trace':
        return {
          border: isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'border-cyan-200 hover:border-cyan-400',
          bg: 'bg-white',
          headerBg: 'bg-cyan-50 border-b border-cyan-100',
          badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
          iconColor: 'text-cyan-600',
          icon: <Layers className="w-3.5 h-3.5 text-cyan-600" />,
          titleColor: 'text-cyan-950',
          typeLabel: 'TELEMETRY',
        };
      case 'code':
      default:
        return {
          border: isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-200 hover:border-slate-300',
          bg: 'bg-white',
          headerBg: 'bg-slate-50 border-b border-slate-100',
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          iconColor: 'text-emerald-600',
          icon: <FileCode className="w-3.5 h-3.5 text-emerald-600" />,
          titleColor: 'text-slate-900',
          typeLabel: 'AST CODE',
        };
    }
  };

  const style = getCategoryStyles();

  return (
    <div
      className={`relative w-[240px] rounded-xl border shadow-sm transition-all duration-200 cursor-pointer overflow-hidden ${style.border} ${style.bg} ${
        isDimmed ? 'opacity-30 grayscale-[50%]' : 'opacity-100'
      } ${isSelected ? 'shadow-md scale-[1.02]' : 'hover:shadow'}`}
    >
      {/* React Flow Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white hover:!bg-emerald-500 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white hover:!bg-emerald-500 transition-colors"
      />

      {/* Header bar */}
      <div className={`px-3 py-1.5 flex items-center justify-between ${style.headerBg}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {style.icon}
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-600 truncate">
            {data.badge || style.typeLabel}
          </span>
        </div>
        {data.community !== undefined && (
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-white/80 border border-slate-200 text-slate-600">
            C#{data.community}
          </span>
        )}
      </div>

      {/* Body content */}
      <div className="p-3 space-y-1.5">
        <div className="font-mono text-xs font-bold truncate text-slate-900">
          {data.label}
        </div>

        {data.subtitle ? (
          <p className="text-[11px] text-slate-500 truncate leading-tight">
            {data.subtitle}
          </p>
        ) : data.source_file ? (
          <p className="text-[10px] font-mono text-slate-500 truncate leading-tight">
            {data.source_file.split('/').slice(-2).join('/')}
            {data.source_location ? `:${data.source_location}` : ''}
          </p>
        ) : (
          <p className="text-[10px] text-slate-400 italic">Static AST Node</p>
        )}

        {/* Degree & Relation stats strip */}
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-slate-100">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>In: {data.inDegree ?? 0}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>Out: {data.outDegree ?? 0}</span>
          </span>
          <span className="text-slate-400">
            {data.file_type ? data.file_type.toUpperCase() : 'CODE'}
          </span>
        </div>
      </div>
    </div>
  );
});

CodeKnowledgeFlowNode.displayName = 'CodeKnowledgeFlowNode';
