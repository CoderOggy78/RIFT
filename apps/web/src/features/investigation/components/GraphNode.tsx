import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { formatDuration } from '../../../lib/utils';
import {
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  MessageSquare,
  Cpu,
  Layers,
  AlertOctagon,
  Wrench,
  FileCode,
} from 'lucide-react';

export interface GraphNodeProps {
  id: string;
  data: {
    id: string;
    label: string;
    event_type: string;
    status: string;
    duration_ms?: number | null;
    tool_name?: string | null;
    is_suspicious: boolean;
    severity?: string | null;
    rule_ids: string[];
    is_first_suspicious: boolean;
    isSelected?: boolean;
    isDimmed?: boolean;
    onSelect?: (id: string) => void;
  };
}

const getEventIcon = (type: string) => {
  const norm = (type || '').toLowerCase();
  switch (norm) {
    case 'user_prompt':
      return <MessageSquare className="w-3.5 h-3.5 text-blue-600" />;
    case 'agent_plan':
      return <Brain className="w-3.5 h-3.5 text-purple-600" />;
    case 'model_call':
      return <Cpu className="w-3.5 h-3.5 text-emerald-600" />;
    case 'tool_call':
      return <Wrench className="w-3.5 h-3.5 text-amber-600" />;
    case 'tool_result':
      return <Terminal className="w-3.5 h-3.5 text-indigo-600" />;
    case 'validation':
      return <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />;
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-rose-600" />;
    default:
      return <Layers className="w-3.5 h-3.5 text-gray-500" />;
  }
};

export const GraphNode: React.FC<GraphNodeProps> = memo(({ id, data }) => {
  const isSelected = !!data.isSelected;
  const isDimmed = !!data.isDimmed;
  const isError = data.status === 'error';

  let borderClasses = 'border-gray-200 hover:border-gray-300';
  let bgClasses = 'bg-white';

  if (isSelected) {
    borderClasses = 'border-blue-500 ring-2 ring-blue-500/20 shadow-md';
    bgClasses = 'bg-blue-50/40';
  } else if (data.is_first_suspicious) {
    borderClasses = 'border-amber-400 ring-2 ring-amber-400/20';
    bgClasses = 'bg-amber-50/70';
  } else if (data.is_suspicious) {
    borderClasses = 'border-rose-300 hover:border-rose-400';
    bgClasses = 'bg-rose-50/50';
  } else if (isError) {
    borderClasses = 'border-rose-300 hover:border-rose-400';
    bgClasses = 'bg-rose-50/50';
  }

  return (
    <div
      onClick={() => data.onSelect && data.onSelect(id)}
      className={`relative w-[250px] rounded-2xl border p-3.5 select-none transition-all duration-150 cursor-pointer shadow-sm ${borderClasses} ${bgClasses} ${
        isDimmed ? 'opacity-30 grayscale' : 'opacity-100'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-2.5 h-2.5 bg-blue-500 border-2 border-white"
      />

      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-md bg-gray-50 border border-gray-200 flex-shrink-0">
            {getEventIcon(data.event_type)}
          </div>
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider truncate">
            {data.event_type}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {data.duration_ms !== null && data.duration_ms !== undefined && (
            <span className="text-[10px] font-mono text-gray-400">
              {formatDuration(data.duration_ms)}
            </span>
          )}
          <span
            className={`w-2 h-2 rounded-full ${
              data.status === 'success'
                ? 'bg-emerald-500'
                : data.status === 'error'
                ? 'bg-rose-500'
                : 'bg-amber-500'
            }`}
          />
        </div>
      </div>

      {/* Node Title & Tool */}
      <div className="space-y-1 mb-2">
        <h4 className="text-xs font-semibold text-gray-900 truncate" title={data.label}>
          {data.label}
        </h4>

        {data.tool_name && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-200 truncate">
              {data.tool_name}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Indicators */}
      <div className="flex items-center justify-between text-[10px] font-mono border-t border-gray-100 pt-1.5">
        <span className="text-gray-400 truncate">{data.id}</span>

        <div className="flex items-center gap-1">
          {data.is_first_suspicious && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-semibold">
              First Suspicious
            </span>
          )}

          {!data.is_first_suspicious && data.rule_ids && data.rule_ids.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
              {data.rule_ids[0]}
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2.5 h-2.5 bg-blue-500 border-2 border-white"
      />
    </div>
  );
});

GraphNode.displayName = 'GraphNode';
