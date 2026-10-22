import React from 'react';
import { Span, Detection } from '../../../types';
import { EventTypeBadge } from '../../../components/common/EventTypeBadge';
import { formatDuration } from '../../../lib/utils';
import {
  ChevronRight,
  ChevronDown,
  AlertOctagon,
  AlertTriangle,
  XCircle,
  Clock,
  Wrench,
} from 'lucide-react';

interface TimelineEventProps {
  span: Span;
  index: number;
  depth: number;
  isSelected: boolean;
  isFirstSuspicious: boolean;
  detections: Detection[];
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: () => void;
}

export const TimelineEvent: React.FC<TimelineEventProps> = ({
  span,
  index,
  depth,
  isSelected,
  isFirstSuspicious,
  detections,
  hasChildren,
  isCollapsed,
  onToggleCollapse,
  onSelect,
}) => {
  const isError = span.status === 'error' || (span.error_data && Object.keys(span.error_data).length > 0);
  const isSuspicious = detections.length > 0 || isFirstSuspicious;

  const toolName =
    (span.event_type || '').toLowerCase() === 'tool_call'
      ? span.input_data?.tool || span.input_data?.name || span.name.replace('tool:', '')
      : null;

  return (
    <div
      onClick={onSelect}
      style={{ paddingLeft: `${Math.min(depth * 14, 42) + 8}px` }}
      className={`group relative p-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all flex items-center justify-between gap-2 shadow-subtle ${
        isSelected
          ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500/20'
          : isFirstSuspicious
          ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
          : isSuspicious
          ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
          : isError
          ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Collapse toggle if has children */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="p-0.5 rounded hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 transition flex-shrink-0"
            title={isCollapsed ? 'Expand subtree' : 'Collapse subtree'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}

        <EventTypeBadge eventType={span.event_type} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`font-medium truncate text-xs ${
                isSelected ? 'text-gray-900 font-semibold' : 'text-gray-800'
              }`}
            >
              {span.name}
            </span>

            {isFirstSuspicious && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold flex-shrink-0">
                First Suspicious
              </span>
            )}

            {!isFirstSuspicious && detections.length > 0 && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex-shrink-0">
                {detections[0].rule_id}
              </span>
            )}

            {isError && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 flex-shrink-0">
                Failed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500 mt-0.5">
            <span className="truncate">{span.id}</span>
            {toolName && <span className="text-amber-700 truncate font-semibold">[{toolName}]</span>}
            {span.duration_ms && <span>{formatDuration(span.duration_ms)}</span>}
          </div>
        </div>
      </div>

      <ChevronRight
        className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${
          isSelected ? 'text-rift-accent translate-x-0.5' : 'opacity-0 group-hover:opacity-100'
        }`}
      />
    </div>
  );
};
