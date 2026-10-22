import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Span, Detection } from '../../../types';
import { TimelineEvent } from './TimelineEvent';
import {
  Search,
  Filter,
  AlertOctagon,
  X,
  Target,
  ArrowDownUp,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface ExecutionTimelineProps {
  spans: Span[];
  detections: Detection[];
  firstSuspiciousEventId: string | null;
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  spans,
  detections,
  firstSuspiciousEventId,
  selectedEventId,
  onSelectEvent,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [suspiciousOnly, setSuspiciousOnly] = useState(false);
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);

  // Map span ID to detections
  const spanDetectionsMap = useMemo(() => {
    const map = new Map<string, Detection[]>();
    detections.forEach((det) => {
      det.evidence?.forEach((ev) => {
        if (!map.has(ev.event_id)) {
          map.set(ev.event_id, []);
        }
        map.get(ev.event_id)!.push(det);
      });
    });
    return map;
  }, [detections]);

  // Compute depth and children set
  const { depthMap, childrenMap } = useMemo(() => {
    const dMap = new Map<string, number>();
    const cMap = new Map<string, string[]>();
    const spanMap = new Map<string, Span>();

    spans.forEach((s) => spanMap.set(s.id, s));

    spans.forEach((s) => {
      if (s.parent_span_id) {
        if (!cMap.has(s.parent_span_id)) {
          cMap.set(s.parent_span_id, []);
        }
        cMap.get(s.parent_span_id)!.push(s.id);
      }
    });

    const computeDepth = (id: string, visited: Set<string>): number => {
      if (dMap.has(id)) return dMap.get(id)!;
      if (visited.has(id)) return 0;
      visited.add(id);
      const span = spanMap.get(id);
      if (!span || !span.parent_span_id || !spanMap.has(span.parent_span_id)) {
        dMap.set(id, 0);
        return 0;
      }
      const d = 1 + computeDepth(span.parent_span_id, visited);
      dMap.set(id, d);
      return d;
    };

    spans.forEach((s) => computeDepth(s.id, new Set()));

    return { depthMap: dMap, childrenMap: cMap };
  }, [spans]);

  // Determine hidden spans due to collapsed ancestors
  const hiddenSpanIds = useMemo(() => {
    const hidden = new Set<string>();
    const hideDescendants = (parentId: string) => {
      const children = childrenMap.get(parentId) || [];
      children.forEach((childId) => {
        hidden.add(childId);
        hideDescendants(childId);
      });
    };
    collapsedSpans.forEach((collapsedId) => {
      hideDescendants(collapsedId);
    });
    return hidden;
  }, [collapsedSpans, childrenMap]);

  const toggleCollapse = (id: string) => {
    setCollapsedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter spans
  const filteredSpans = useMemo(() => {
    return spans.filter((span) => {
      if (hiddenSpanIds.has(span.id)) return false;

      // Status
      if (statusFilter !== 'all' && span.status !== statusFilter) return false;

      // Type
      if (typeFilter !== 'all' && span.event_type !== typeFilter) return false;

      // Suspicious filter
      if (suspiciousOnly) {
        const hasDets = spanDetectionsMap.has(span.id);
        const isFirst = span.id === firstSuspiciousEventId;
        const isErr = span.status === 'error';
        if (!hasDets && !isFirst && !isErr) return false;
      }

      // Search term
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = span.name.toLowerCase().includes(query);
        const matchesId = span.id.toLowerCase().includes(query);
        const matchesType = span.event_type.toLowerCase().includes(query);
        const matchesTool =
          span.input_data?.tool?.toLowerCase().includes(query) ||
          span.input_data?.name?.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesType && !matchesTool) return false;
      }

      return true;
    });
  }, [
    spans,
    hiddenSpanIds,
    statusFilter,
    typeFilter,
    suspiciousOnly,
    search,
    spanDetectionsMap,
    firstSuspiciousEventId,
  ]);

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 select-none">
      {/* Search & Filter Header */}
      <div className="p-3 border-b border-gray-200 bg-white space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-gray-800 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-rift-accent" />
            <span>Timeline</span>
            <span className="text-gray-400 font-normal">({filteredSpans.length}/{spans.length})</span>
          </div>

          {firstSuspiciousEventId && (
            <button
              onClick={() => onSelectEvent(firstSuspiciousEventId)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition"
              title="Jump to first suspicious event"
            >
              <AlertOctagon className="w-3 h-3 text-amber-600" />
              <span>Jump to First</span>
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="timeline-search-input"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events (Press '/')..."
            className="w-full bg-gray-50 border border-gray-200 rounded-full pl-9 pr-7 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
          <button
            onClick={() => setSuspiciousOnly(!suspiciousOnly)}
            className={`px-2.5 py-1 rounded-full font-mono text-[10px] uppercase tracking-wider transition whitespace-nowrap border ${
              suspiciousOnly
                ? 'bg-rose-50 text-rose-700 border-rose-300 font-semibold'
                : 'text-gray-600 bg-gray-50 border-gray-200 hover:border-gray-300'
            }`}
          >
            Suspicious ({detections.length})
          </button>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-full text-[10px] font-mono text-gray-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Status: All</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-full text-[10px] font-mono text-gray-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Type: All</option>
            <option value="user_prompt">User Prompt</option>
            <option value="agent_plan">Agent Plan</option>
            <option value="model_call">Model Call</option>
            <option value="tool_call">Tool Call</option>
            <option value="tool_result">Tool Result</option>
            <option value="validation">Validation</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Events List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-2.5 space-y-1 bg-gray-50/30">
        {filteredSpans.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 font-mono">
            No events match current filter.
          </div>
        ) : (
          filteredSpans.map((span, index) => {
            const depth = depthMap.get(span.id) || 0;
            const hasChildren = (childrenMap.get(span.id) || []).length > 0;
            const isCollapsed = collapsedSpans.has(span.id);
            const spanDets = spanDetectionsMap.get(span.id) || [];
            const isFirstSuspicious = span.id === firstSuspiciousEventId;

            return (
              <TimelineEvent
                key={span.id}
                span={span}
                index={index}
                depth={depth}
                isSelected={span.id === selectedEventId}
                isFirstSuspicious={isFirstSuspicious}
                detections={spanDets}
                hasChildren={hasChildren}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => toggleCollapse(span.id)}
                onSelect={() => onSelectEvent(span.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
