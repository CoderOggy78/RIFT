import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { EventTypeBadge } from '../components/common/EventTypeBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { JsonViewer } from '../components/common/JsonViewer';
import { formatDateTime, formatDuration } from '../lib/utils';
import { Span, Detection } from '../types';
import {
  ArrowLeft,
  Clock,
  Bot,
  FolderGit2,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Layers,
  ChevronRight,
  ShieldAlert,
  Info,
  Play,
  RotateCw,
  AlertOctagon,
  ExternalLink,
  GitFork,
  GitBranch,
  FileCode,
  X,
  Flame,
} from 'lucide-react';
import { CodeImpactPanel } from '../components/common/CodeImpactPanel';
import { FilePreview } from '../types';

export const TraceDetailPage: React.FC = () => {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const urlEventId = searchParams.get('event');

  const { data: trace, isLoading, isError, error, refetch: refetchTrace } = useQuery({
    queryKey: ['trace', traceId],
    queryFn: () => (traceId ? api.getTrace(traceId) : null),
    enabled: !!traceId,
  });

  // Fetch detections for this trace
  const { data: detections = [], refetch: refetchDetections } = useQuery({
    queryKey: ['trace-detections', traceId],
    queryFn: () => (traceId ? api.getTraceDetections(traceId) : []),
    enabled: !!traceId,
  });

  // Run detection mutation
  const detectMutation = useMutation({
    mutationFn: () => (traceId ? api.runTraceDetection(traceId) : Promise.reject('No trace ID')),
    onSuccess: (newDetections) => {
      queryClient.setQueryData(['trace-detections', traceId], newDetections);
      refetchTrace();
      refetchDetections();
    },
  });

  // Fetch code impact for the entire trace
  const { data: traceImpact } = useQuery({
    queryKey: ['trace-code-impact', traceId],
    queryFn: () => (traceId ? api.getTraceCodeImpact(traceId) : null),
    enabled: !!traceId,
  });

  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'output' | 'error' | 'detections' | 'code_impact' | 'metadata' | 'all'>('input');
  const [showTraceImpactModal, setShowTraceImpactModal] = useState(false);
  const [selectedTraceOpIndex, setSelectedTraceOpIndex] = useState<number>(0);
  const [previewData, setPreviewData] = useState<FilePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Fetch code impact for selected span
  const { data: selectedSpanImpact, isLoading: isSpanImpactLoading } = useQuery({
    queryKey: ['span-code-impact', selectedSpanId],
    queryFn: () => (selectedSpanId ? api.getSpanCodeImpact(selectedSpanId) : null),
    enabled: !!selectedSpanId,
  });

  const handleViewFile = async (filePath: string, line?: number) => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await api.previewSourceFile(filePath, line, 25);
      setPreviewData(data);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to load source file preview.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Compute span hierarchy / depths
  const { orderedSpans, spanDepthMap } = useMemo(() => {
    if (!trace?.spans) return { orderedSpans: [], spanDepthMap: new Map<string, number>() };

    const depthMap = new Map<string, number>();
    const spanMap = new Map<string, Span>();
    trace.spans.forEach((s) => spanMap.set(s.id, s));

    const computeDepth = (id: string, visited: Set<string>): number => {
      if (depthMap.has(id)) return depthMap.get(id)!;
      if (visited.has(id)) return 0;
      visited.add(id);

      const span = spanMap.get(id);
      if (!span || !span.parent_span_id || !spanMap.has(span.parent_span_id)) {
        depthMap.set(id, 0);
        return 0;
      }
      const d = 1 + computeDepth(span.parent_span_id, visited);
      depthMap.set(id, d);
      return d;
    };

    trace.spans.forEach((s) => computeDepth(s.id, new Set()));

    const sorted = [...trace.spans].sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return ta - tb;
    });

    return {
      orderedSpans: sorted,
      spanDepthMap: depthMap,
    };
  }, [trace?.spans]);

  // Build lookup maps for detections and evidence by span ID
  const { flaggedSpansMap, firstSuspiciousEventIds, primaryIncidentId } = useMemo(() => {
    const map = new Map<string, { rules: string[]; severities: string[]; descriptions: string[] }>();
    const firstEventIds = new Set<string>();
    let incidentId: string | null = null;

    detections.forEach((det) => {
      if (!incidentId && det.incident_id) {
        incidentId = det.incident_id;
      }
      (det.evidence || []).forEach((ev) => {
        if (!map.has(ev.event_id)) {
          map.set(ev.event_id, { rules: [], severities: [], descriptions: [] });
        }
        const item = map.get(ev.event_id)!;
        if (!item.rules.includes(det.rule_id)) {
          item.rules.push(det.rule_id);
          item.severities.push(det.severity);
        }
        item.descriptions.push(ev.description);
      });

      if (det.evidence && det.evidence.length > 0) {
        firstEventIds.add(det.evidence[0].event_id);
      }
    });

    return {
      flaggedSpansMap: map,
      firstSuspiciousEventIds: firstEventIds,
      primaryIncidentId: incidentId,
    };
  }, [detections]);

  // Handle URL event query param or default selection
  useEffect(() => {
    if (urlEventId && trace?.spans.some((s) => s.id === urlEventId)) {
      setSelectedSpanId(urlEventId);
      if (flaggedSpansMap.has(urlEventId)) {
        setActiveTab('detections');
      }
    } else if (trace?.spans && trace.spans.length > 0 && !selectedSpanId) {
      const suspiciousSpan = trace.spans.find((s) => firstSuspiciousEventIds.has(s.id));
      const errorSpan = trace.spans.find((s) => s.status === 'error' || Object.keys(s.error_data || {}).length > 0);
      setSelectedSpanId(suspiciousSpan ? suspiciousSpan.id : errorSpan ? errorSpan.id : trace.spans[0].id);
    }
  }, [trace?.spans, urlEventId, firstSuspiciousEventIds, flaggedSpansMap]);

  const selectedSpan = useMemo(() => {
    return trace?.spans.find((s) => s.id === selectedSpanId) || null;
  }, [trace?.spans, selectedSpanId]);

  const selectedSpanFlags = selectedSpan ? flaggedSpansMap.get(selectedSpan.id) : null;

  if (isLoading) {
    return (
      <div className="p-12 text-center space-y-2 text-xs text-gray-500 animate-in fade-in">
        <div className="w-6 h-6 border-2 border-rift-accent border-t-transparent rounded-full animate-spin mx-auto" />
        <p>Loading execution trace details…</p>
      </div>
    );
  }

  if (isError || !trace) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-base font-semibold text-gray-900">Trace Not Found</h3>
        <p className="text-xs text-gray-500">
          {error?.message || `The trace '${traceId}' does not exist or could not be loaded.`}
        </p>
        <button
          onClick={() => navigate('/traces')}
          className="btn-secondary"
        >
          Back to traces
        </button>
      </div>
    );
  }

  const hasErrors = (span: Span) => {
    return span.status === 'error' || (span.error_data && Object.keys(span.error_data).length > 0);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-rift-base">
      {/* Top Banner / Summary */}
      <div className="p-5 border-b border-gray-200 bg-white flex-shrink-0 space-y-3">
        {/* Back and Trace ID */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/traces')}
              className="p-1.5 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 transition"
              title="Back to Traces"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-400 uppercase tracking-wider">Trace</span>
              <span className="font-mono text-sm font-semibold text-rift-accent">{trace.id}</span>
            </div>
            <StatusBadge status={trace.status} size="sm" />
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/investigations/${trace.id}${selectedSpanId ? `?event=${selectedSpanId}` : ''}`}
              className="btn-primary text-xs"
              title="Open in Interactive Investigation Workspace & Execution Graph"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Investigation Workspace</span>
            </Link>

            <button
              onClick={() => detectMutation.mutate()}
              disabled={detectMutation.isPending}
              className="btn-secondary text-xs"
              title="Run deterministic incident detection engine"
            >
              <RotateCw className={`w-3.5 h-3.5 text-rift-accent ${detectMutation.isPending ? 'animate-spin' : ''}`} />
              <span>{detectMutation.isPending ? 'Detecting…' : 'Run Detection'}</span>
            </button>

            {traceImpact && traceImpact.file_operations && traceImpact.file_operations.length > 0 && (
              <button
                onClick={() => setShowTraceImpactModal(true)}
                className="btn-secondary text-xs border-rose-200 text-rose-700 hover:bg-rose-50 flex items-center gap-1.5"
                title="Inspect codebase dependencies affected by file operations in this trace"
              >
                <Flame className="w-3.5 h-3.5 text-rose-600" />
                <span>Blast Radius ({traceImpact.file_operations.length})</span>
              </button>
            )}

            <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-gray-500 pl-2 border-l border-gray-200">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>{formatDuration(trace.duration_ms)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                <span>{trace.spans.length} events</span>
              </div>
            </div>
          </div>
        </div>

        {/* Objective Box */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-mono uppercase text-gray-400 flex-shrink-0 pt-0.5">
              Objective:
            </span>
            <p className="text-xs font-medium text-gray-800 italic leading-relaxed">
              "{trace.objective}"
            </p>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500 pt-0.5">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 text-rift-accent" />
              <span className="text-gray-900 font-medium">{trace.agent_name}</span>
              {trace.agent_framework && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                  {trace.agent_framework}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <FolderGit2 className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-gray-700">{trace.project_name}</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span>Started:</span>
              <span className="text-gray-700">{formatDateTime(trace.started_at)}</span>
            </div>
          </div>

          {detections.length > 0 && primaryIncidentId && (
            <Link
              to={`/incidents/${primaryIncidentId}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-800 hover:text-amber-900 transition bg-amber-50 px-3 py-1 rounded-full border border-amber-200 font-medium"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
              <span>{detections.length} Anomaly Rule{detections.length !== 1 ? 's' : ''} Flagged — View Incident</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Two-Panel Inspector Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel: Execution Timeline / Span Hierarchy */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col min-w-0 bg-white">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider font-mono">
              Execution Timeline ({orderedSpans.length} Events)
            </span>
            <span className="text-[11px] text-gray-500 font-mono">Click event to inspect payload</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {orderedSpans.map((span, index) => {
              const depth = spanDepthMap.get(span.id) || 0;
              const isSelected = selectedSpan?.id === span.id;
              const isError = hasErrors(span);
              const flags = flaggedSpansMap.get(span.id);
              const isFirstSuspicious = firstSuspiciousEventIds.has(span.id);
              const fileOp = traceImpact?.file_operations?.find((op) => op.event_id === span.id);

              return (
                <div
                  key={span.id}
                  onClick={() => setSelectedSpanId(span.id)}
                  style={{ marginLeft: `${depth * 16}px` }}
                  className={`group relative p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-500 shadow-sm'
                      : isFirstSuspicious
                      ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                      : flags
                      ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
                      : isError
                      ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
                  }`}
                >
                  {/* Left event indicator */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-gray-400 select-none w-5 text-right flex-shrink-0">
                      {index + 1}
                    </span>

                    <EventTypeBadge eventType={span.event_type} size="sm" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium text-gray-900 truncate">
                          {span.name}
                        </span>

                        {isFirstSuspicious && (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            First Suspicious
                          </span>
                        )}

                        {flags && !isFirstSuspicious && flags.rules.map((r) => (
                          <span
                            key={r}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200"
                          >
                            {r}
                          </span>
                        ))}

                        {isError && (
                          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300">
                            Failed
                          </span>
                        )}

                        {fileOp && (
                          <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            <FileCode className="w-3 h-3 text-amber-600" />
                            <span>{fileOp.operation_type || fileOp.operation}: {(fileOp.file_path || fileOp.normalized_path || fileOp.raw_path || '').split('/').pop()}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500 mt-0.5">
                        <span className="truncate">{span.id}</span>
                        {span.duration_ms && <span>{formatDuration(span.duration_ms)}</span>}
                      </div>
                    </div>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                      isSelected ? 'text-rift-accent translate-x-0.5' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Event Payload Inspector */}
        <div className="w-1/2 flex flex-col min-w-0 bg-gray-50/50">
          {selectedSpan ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Selected Span Header */}
              <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <EventTypeBadge eventType={selectedSpan.event_type} size="sm" />
                    <h3 className="text-sm font-semibold text-gray-900">{selectedSpan.name}</h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-gray-500 mt-1">
                    <span>ID: {selectedSpan.id}</span>
                    {selectedSpan.parent_span_id && (
                      <span>Parent: {selectedSpan.parent_span_id}</span>
                    )}
                    <span>{formatDateTime(selectedSpan.timestamp)}</span>
                  </div>
                </div>

                <StatusBadge status={selectedSpan.status} size="sm" />
              </div>

              {/* Tabs */}
              <div className="px-4 border-b border-gray-200 bg-white flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('input')}
                  className={`px-3 py-2 text-xs font-mono font-medium border-b-2 transition ${
                    activeTab === 'input'
                      ? 'border-rift-accent text-rift-accent'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Input Arguments
                </button>

                <button
                  onClick={() => setActiveTab('output')}
                  className={`px-3 py-2 text-xs font-mono font-medium border-b-2 transition ${
                    activeTab === 'output'
                      ? 'border-rift-accent text-rift-accent'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Output / Result
                </button>

                <button
                  onClick={() => setActiveTab('error')}
                  className={`px-3 py-2 text-xs font-mono font-medium border-b-2 flex items-center gap-1.5 transition ${
                    activeTab === 'error'
                      ? 'border-rose-600 text-rose-600'
                      : Object.keys(selectedSpan.error_data || {}).length > 0 || selectedSpan.status === 'error'
                      ? 'border-transparent text-rose-600 hover:text-rose-700'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <span>Error Details</span>
                  {Object.keys(selectedSpan.error_data || {}).length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  )}
                </button>

                {selectedSpanFlags && (
                  <button
                    onClick={() => setActiveTab('detections')}
                    className={`px-3 py-2 text-xs font-mono font-semibold border-b-2 flex items-center gap-1.5 transition ${
                      activeTab === 'detections'
                        ? 'border-amber-600 text-amber-700'
                        : 'border-transparent text-amber-600/80 hover:text-amber-700'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Detections ({selectedSpanFlags.rules.length})</span>
                  </button>
                )}

                {(selectedSpanImpact?.available || selectedSpanImpact?.file_operation) && (
                  <button
                    onClick={() => setActiveTab('code_impact')}
                    className={`px-3 py-2 text-xs font-mono font-medium border-b-2 flex items-center gap-1.5 transition ${
                      activeTab === 'code_impact'
                        ? 'border-rose-600 text-rose-600 font-semibold'
                        : 'border-transparent text-rose-600/70 hover:text-rose-700'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Code Impact</span>
                    {selectedSpanImpact?.dependents && selectedSpanImpact.dependents.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-100 text-rose-800 font-bold">
                        {selectedSpanImpact.dependents.length}
                      </span>
                    )}
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('metadata')}
                  className={`px-3 py-2 text-xs font-mono font-medium border-b-2 transition ${
                    activeTab === 'metadata'
                      ? 'border-rift-accent text-rift-accent'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Metadata
                </button>

                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-2 text-xs font-mono font-medium border-b-2 transition ${
                    activeTab === 'all'
                      ? 'border-rift-accent text-rift-accent'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Full Raw JSON
                </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {activeTab === 'detections' && selectedSpanFlags && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                      <div className="font-semibold text-amber-800 font-mono flex items-center gap-1.5 mb-1">
                        <AlertOctagon className="w-4 h-4 text-amber-600" />
                        <span>Incident Evidence Reference</span>
                      </div>
                      <p className="text-gray-700">
                        This event is cited as evidence in deterministic incident findings.
                      </p>
                    </div>

                    {selectedSpanFlags.descriptions.map((desc, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-white border border-gray-200 text-xs space-y-1.5 shadow-subtle"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-rift-accent">
                            {selectedSpanFlags.rules[idx] || 'RULE'}
                          </span>
                        </div>
                        <p className="text-gray-800">{desc}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'code_impact' && (
                  <div className="space-y-4">
                    {isSpanImpactLoading ? (
                      <div className="p-8 text-center text-xs text-gray-500 space-y-2">
                        <div className="w-5 h-5 border-2 border-rift-accent border-t-transparent rounded-full animate-spin mx-auto" />
                        <p>Querying Graphify AST dependencies...</p>
                      </div>
                    ) : selectedSpanImpact ? (
                      <CodeImpactPanel
                        impact={selectedSpanImpact}
                        onViewFile={handleViewFile}
                        showGraphifyLink={true}
                      />
                    ) : (
                      <div className="p-8 text-center text-xs text-gray-500 italic border border-gray-200 rounded-xl bg-white">
                        No code impact analysis available for this span.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'input' && (
                  <JsonViewer
                    data={selectedSpan.input_data}
                    title="Tool / Event Input Arguments"
                    maxHeight="max-h-[500px]"
                  />
                )}

                {activeTab === 'output' && (
                  <JsonViewer
                    data={selectedSpan.output_data}
                    title="Tool Output & Execution Results"
                    maxHeight="max-h-[500px]"
                  />
                )}

                {activeTab === 'error' && (
                  <div>
                    {selectedSpan.status === 'error' ||
                    Object.keys(selectedSpan.error_data || {}).length > 0 ? (
                      <JsonViewer
                        data={selectedSpan.error_data}
                        title="Captured Exception & Diagnostics"
                        maxHeight="max-h-[500px]"
                        isError={true}
                      />
                    ) : (
                      <div className="p-8 text-center text-xs text-gray-500 italic border border-gray-200 rounded-xl bg-white">
                        No error data recorded for this span. Execution returned success.
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'metadata' && (
                  <JsonViewer
                    data={selectedSpan.metadata_payload}
                    title="Span Attributes & Telemetry Metadata"
                    maxHeight="max-h-[500px]"
                  />
                )}

                {activeTab === 'all' && (
                  <JsonViewer
                    data={selectedSpan}
                    title="Complete Span Record"
                    maxHeight="max-h-[550px]"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-gray-500">
              Select an execution span from the timeline to inspect its structured arguments and results.
            </div>
          )}
        </div>
      </div>

      {/* Trace Codebase Blast Radius Modal */}
      {showTraceImpactModal && traceImpact && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Trace Codebase Blast Radius & Impact Analysis
                  </h3>
                  <p className="text-xs text-gray-500 font-mono">
                    Trace: {trace.id} · {traceImpact.file_operations?.length || 0} observed file mutation{(traceImpact.file_operations?.length || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTraceImpactModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {traceImpact.file_operations && traceImpact.file_operations.length > 0 ? (
                <div className="space-y-4">
                  {/* File Operation Selector Bar */}
                  {traceImpact.file_operations.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      <span className="text-xs font-mono text-gray-500 uppercase flex-shrink-0">Mutated Files:</span>
                      {traceImpact.file_operations.map((op, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedTraceOpIndex(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 flex-shrink-0 ${
                            selectedTraceOpIndex === idx
                              ? 'bg-rose-50 border border-rose-300 text-rose-800 font-bold'
                              : 'bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <FileCode className="w-3.5 h-3.5 text-blue-600" />
                          <span>{(op.file_path || op.normalized_path || op.raw_path || '').split('/').pop()}</span>
                          <span className="uppercase text-[10px] px-1 rounded bg-white text-gray-700 border border-gray-200">
                            {op.operation_type || op.operation}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Render the CodeImpactPanel for the selected file operation */}
                  {traceImpact.impacts && traceImpact.impacts.length > 0 ? (
                    <CodeImpactPanel
                      impact={traceImpact.impacts[selectedTraceOpIndex] || traceImpact.impacts[0]}
                      onViewFile={handleViewFile}
                      showGraphifyLink={true}
                    />
                  ) : (
                    <div className="p-8 text-center text-xs text-gray-500 font-mono bg-gray-50 rounded-xl border border-gray-200">
                      AST dependency relationships unavailable for this file.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-gray-500 font-mono bg-gray-50 rounded-xl border border-gray-200">
                  {traceImpact.summary || 'No file operations recorded in this trace.'}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500 font-mono flex-shrink-0">
              <span>Freshness: {traceImpact.graph_freshness || 'Verified AST'}</span>
              <button
                onClick={() => setShowTraceImpactModal(false)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Source Code File Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-600" />
                <span className="font-mono text-xs font-bold text-gray-900">
                  {previewData.file_path}
                </span>
                <span className="text-[11px] font-mono text-gray-500">
                  ({previewData.total_lines} lines)
                </span>
              </div>
              <button
                onClick={() => setPreviewData(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-900 text-slate-100 font-mono text-xs">
              <pre className="space-y-0.5 leading-relaxed">
                {(previewData.content_snippet || '').split('\n').map((content, idx) => {
                  const lineNum = previewData.start_line + idx;
                  const isHighlighted = lineNum === previewData.line_number;
                  return (
                    <div
                      key={lineNum}
                      className={`flex items-start gap-4 px-2 py-0.5 rounded ${
                        isHighlighted ? 'bg-rose-500/30 text-rose-200 font-bold' : ''
                      }`}
                    >
                      <span className="text-slate-500 select-none w-8 text-right flex-shrink-0">
                        {lineNum}
                      </span>
                      <span className="whitespace-pre overflow-x-auto">{content}</span>
                    </div>
                  );
                })}
              </pre>
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end flex-shrink-0">
              <button
                onClick={() => setPreviewData(null)}
                className="btn-secondary text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
