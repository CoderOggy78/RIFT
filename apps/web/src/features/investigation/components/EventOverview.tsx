import React, { useState } from 'react';
import { Span, Detection } from '../../../types';
import { formatDateTime, formatDuration } from '../../../lib/utils';
import { EventTypeBadge } from '../../../components/common/EventTypeBadge';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { SeverityBadge } from '../../../components/common/SeverityBadge';
import {
  Copy,
  Check,
  GitFork,
  ArrowUpRight,
  Clock,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface EventOverviewProps {
  span: Span;
  ancestorIds: string[];
  childIds: string[];
  detections: Detection[];
  isFirstSuspicious: boolean;
  onNavigateToEvent: (id: string) => void;
}

export const EventOverview: React.FC<EventOverviewProps> = ({
  span,
  ancestorIds,
  childIds,
  detections,
  isFirstSuspicious,
  onNavigateToEvent,
}) => {
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(span.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Identity Block */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-subtle">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-rift-accent px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 flex items-center gap-1.5">
              <span>{span.id}</span>
              <button
                onClick={handleCopyId}
                className="text-gray-400 hover:text-gray-700 transition"
                title="Copy Event ID"
              >
                {copiedId ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </span>

            <EventTypeBadge eventType={span.event_type} size="sm" />
            <StatusBadge status={span.status} size="sm" />
          </div>

          {span.duration_ms !== null && span.duration_ms !== undefined && (
            <div className="flex items-center gap-1 font-mono text-[11px] text-gray-500">
              <Clock className="w-3 h-3 text-gray-400" />
              <span>{formatDuration(span.duration_ms)}</span>
            </div>
          )}
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 block mb-0.5">
            Event Name
          </span>
          <h4 className="text-sm font-semibold text-gray-900 font-mono">{span.name}</h4>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-[11px] font-mono">
          <div>
            <span className="text-gray-400 block">Timestamp</span>
            <span className="text-gray-700">{formatDateTime(span.timestamp)}</span>
          </div>

          <div>
            <span className="text-gray-400 block">Trace ID</span>
            <span className="text-gray-700 truncate block">{span.trace_id}</span>
          </div>
        </div>
      </div>

      {/* Incident / Suspicious Callout */}
      {isFirstSuspicious && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
          <div className="flex items-center gap-1.5 text-amber-800 font-semibold font-mono text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>First Suspicious Event</span>
          </div>
          <p className="text-[11px] text-gray-700 leading-relaxed font-sans">
            This span was identified as the first point of divergence from expected agent execution policy.
          </p>
        </div>
      )}

      {/* Detections Citing this Event */}
      {detections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-gray-800 uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <span>Incident Citations ({detections.length})</span>
          </div>

          <div className="space-y-2">
            {detections.map((det) => (
              <div
                key={det.id}
                className="p-3 rounded-xl bg-rose-50/50 border border-rose-200 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold text-rose-700">
                    {det.rule_id}
                  </span>
                  <SeverityBadge severity={det.severity} size="sm" />
                </div>
                <h5 className="font-medium text-gray-900 text-xs">{det.title}</h5>
                <p className="text-[11px] text-gray-600 leading-snug">{det.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Causal Hierarchy Links */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3 shadow-subtle">
        <span className="font-mono text-[11px] font-semibold text-gray-700 uppercase tracking-wider block">
          Causal Hierarchy
        </span>

        {/* Parent / Ancestor */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-gray-400 block">Parent Span:</span>
          {span.parent_span_id ? (
            <button
              onClick={() => onNavigateToEvent(span.parent_span_id!)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 font-mono text-[11px] text-gray-800 transition"
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-gray-400">↑</span>
                <span className="truncate">{span.parent_span_id}</span>
              </div>
              <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
            </button>
          ) : (
            <span className="text-[11px] text-gray-400 font-mono italic block">
              Root event (no parent)
            </span>
          )}
        </div>

        {/* Children */}
        <div className="space-y-1.5 pt-2 border-t border-gray-100">
          <span className="text-[10px] font-mono text-gray-400 block">
            Direct Children ({childIds.length}):
          </span>
          {childIds.length === 0 ? (
            <span className="text-[11px] text-gray-400 font-mono italic block">
              Leaf event (no spawned children)
            </span>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {childIds.map((cid) => (
                <button
                  key={cid}
                  onClick={() => onNavigateToEvent(cid)}
                  className="w-full flex items-center justify-between p-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 font-mono text-[11px] text-gray-800 transition text-left"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-gray-400">↓</span>
                    <span className="truncate">{cid}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
