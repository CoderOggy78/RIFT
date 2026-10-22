import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { formatDateTime } from '../lib/utils';
import {
  AlertOctagon,
  ArrowLeft,
  GitFork,
  ExternalLink,
  ShieldAlert,
  Bot,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Terminal,
  Activity,
  SearchCode,
  Flame,
  FileCode,
  X,
} from 'lucide-react';
import { GemmaInvestigationPanel } from '../features/investigation/components/GemmaInvestigationPanel';
import { CodeImpactPanel } from '../components/common/CodeImpactPanel';
import { FilePreview } from '../types';

export const IncidentDetailPage: React.FC = () => {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();

  // Load incident details
  const {
    data: incident,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => (incidentId ? api.getIncident(incidentId) : Promise.reject('No ID')),
    enabled: !!incidentId,
  });

  // Load associated trace to get span details for the First Suspicious Event
  const { data: trace } = useQuery({
    queryKey: ['trace', incident?.trace_id],
    queryFn: () => (incident?.trace_id ? api.getTrace(incident.trace_id) : Promise.reject('No trace')),
    enabled: !!incident?.trace_id,
  });

  // Load Codebase Impact & Blast Radius (Phase 5)
  const { data: codeImpact, isLoading: isImpactLoading } = useQuery({
    queryKey: ['incident-code-impact', incidentId],
    queryFn: () => (incidentId ? api.getIncidentCodeImpact(incidentId) : Promise.reject('No ID')),
    enabled: !!incidentId,
  });

  // Find the span corresponding to the first suspicious event
  const firstSuspiciousSpan = React.useMemo(() => {
    if (!trace || !incident?.first_suspicious_event_id) return null;
    return trace.spans.find((s) => s.id === incident.first_suspicious_event_id);
  }, [trace, incident?.first_suspicious_event_id]);

  const [previewData, setPreviewData] = React.useState<FilePreview | null>(null);
  const handleViewFile = async (filePath: string, line?: number) => {
    try {
      const data = await api.previewSourceFile(filePath, line, 25);
      setPreviewData(data);
    } catch {
      // preview failure silently handled
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-gray-500 max-w-7xl mx-auto">
        Loading incident details…
      </div>
    );
  }

  if (isError || !incident) {
    return (
      <div className="p-12 text-center space-y-4 max-w-7xl mx-auto">
        <AlertOctagon className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-base font-semibold text-gray-900">Failed to load incident</h3>
        <p className="text-xs text-gray-500 font-mono">{error?.toString() || 'Incident not found'}</p>
        <button
          onClick={() => navigate('/incidents')}
          className="btn-secondary"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Incidents</span>
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-2 flex-wrap gap-3">
        <button
          onClick={() => navigate('/incidents')}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Incidents</span>
        </button>

        <div className="flex items-center gap-2">
          <Link
            to={`/investigations/${incident.trace_id}`}
            className="btn-primary text-xs"
          >
            <SearchCode className="w-3.5 h-3.5" />
            <span>Investigation Workspace</span>
          </Link>
          <Link
            to={`/traces/${incident.trace_id}`}
            className="btn-secondary text-xs"
          >
            <GitFork className="w-3.5 h-3.5 text-rift-accent" />
            <span>Open Trace Events</span>
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </Link>
        </div>
      </div>

      {/* Incident Header Card */}
      <div className="card-antigravity p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                {incident.id}
              </span>
              <SeverityBadge severity={incident.severity} size="md" />
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                {incident.status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight mt-1">
              {incident.title}
            </h1>
          </div>

          <div className="text-right text-xs text-gray-500 font-mono space-y-1">
            <div>Detected: {formatDateTime(incident.created_at)}</div>
            <div>Updated: {formatDateTime(incident.updated_at)}</div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Bot className="w-3 h-3 text-rift-accent" />
              <span>Agent</span>
            </div>
            <div className="font-medium text-gray-900 text-xs mt-1">
              {incident.agent_name}
            </div>
            {incident.agent_framework && (
              <div className="text-[10px] text-gray-500 font-mono mt-0.5">{incident.agent_framework}</div>
            )}
          </div>

          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3 h-3 text-rift-accent" />
              <span>Project</span>
            </div>
            <div className="font-medium text-gray-900 text-xs mt-1">
              {incident.project_name}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{incident.project_id}</div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <GitFork className="w-3 h-3 text-rift-accent" />
              <span>Trace Objective</span>
            </div>
            <div className="text-xs text-gray-900 mt-1 line-clamp-1 font-medium" title={incident.trace_objective}>
              {incident.trace_objective}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{incident.trace_id}</div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rift-accent" />
              <span>Rule Detections</span>
            </div>
            <div className="font-mono text-gray-900 text-xs mt-1 font-bold">
              {incident.detections.length} correlated finding{incident.detections.length !== 1 ? 's' : ''}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">Deterministic</div>
          </div>
        </div>
      </div>

      {/* Rule-Based Detection Summary */}
      <div className="card-antigravity p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rift-accent" />
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider font-mono">
              Rule-Based Detection Summary
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Deterministic Verified
          </span>
        </div>
        <p className="text-xs text-gray-800 leading-relaxed bg-gray-50 p-3.5 rounded-xl border border-gray-200">
          {incident.description}
        </p>
      </div>

      {/* First Suspicious Event Card */}
      <div className="card-antigravity p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider font-mono">
              First Suspicious Event
            </h3>
          </div>
          {incident.first_suspicious_event_id && (
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  navigate(`/investigations/${incident.trace_id}?event=${incident.first_suspicious_event_id}`)
                }
                className="btn-primary text-xs"
              >
                <span>Investigation Workspace</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              <button
                onClick={() =>
                  navigate(`/traces/${incident.trace_id}?event=${incident.first_suspicious_event_id}`)
                }
                className="btn-secondary text-xs"
              >
                <span>View in Trace</span>
              </button>
            </div>
          )}
        </div>

        {incident.first_suspicious_event_id ? (
          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-gray-500">Event ID:</span>
                <span className="text-amber-800 font-bold px-2.5 py-0.5 rounded-full bg-white border border-amber-300">
                  {incident.first_suspicious_event_id}
                </span>
                {firstSuspiciousSpan && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-white text-gray-600 border border-gray-200">
                    {firstSuspiciousSpan.event_type}
                  </span>
                )}
              </div>
              {firstSuspiciousSpan && (
                <div className="text-[11px] font-mono text-gray-500">
                  {formatDateTime(firstSuspiciousSpan.timestamp)}
                </div>
              )}
            </div>

            {firstSuspiciousSpan && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-gray-500 font-mono uppercase block mb-1">
                    Operation / Span Name
                  </span>
                  <div className="font-mono text-gray-900 bg-white px-3 py-2 rounded-lg border border-gray-200">
                    {firstSuspiciousSpan.name}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-gray-500 font-mono uppercase block mb-1">
                    Execution Status
                  </span>
                  <div className="font-mono text-xs bg-white px-3 py-2 rounded-lg border border-gray-200 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        firstSuspiciousSpan.status === 'success'
                          ? 'bg-emerald-500'
                          : 'bg-rose-500'
                      }`}
                    />
                    <span className="text-gray-900 capitalize font-medium">{firstSuspiciousSpan.status}</span>
                  </div>
                </div>

                {Object.keys(firstSuspiciousSpan.input_data || {}).length > 0 && (
                  <div className="md:col-span-2">
                    <span className="text-[11px] text-gray-500 font-mono uppercase block mb-1">
                      Recorded Arguments / Input
                    </span>
                    <pre className="font-mono text-[11px] bg-white p-3 rounded-lg border border-gray-200 text-gray-800 overflow-x-auto max-h-36">
                      {JSON.stringify(firstSuspiciousSpan.input_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 text-xs text-gray-500 font-mono italic bg-gray-50 rounded-xl border border-gray-200">
            Insufficient telemetry recorded to pinpoint the earliest suspicious event. Evidence status is UNKNOWN.
          </div>
        )}
      </div>

      {/* Codebase Impact & Blast Radius (Phase 5) */}
      <div className="card-antigravity p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider font-mono">
              Codebase Impact & Blast Radius
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold uppercase">
              Graphify AST Grounding
            </span>
          </div>

          <Link
            to="/graphify"
            className="inline-flex items-center gap-1.5 text-xs text-rose-700 hover:text-rose-900 font-mono font-medium"
          >
            <span>Open Code Knowledge Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {isImpactLoading ? (
          <div className="py-6 text-center text-xs text-gray-400 font-mono animate-pulse">
            Analyzing repository dependency blast radius for incident telemetry...
          </div>
        ) : codeImpact && codeImpact.status === 'ready' && codeImpact.touched_files.length > 0 ? (
          <div className="space-y-4">
            {/* Impact Metric Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500 font-mono uppercase block">Files Mutated in Trace</span>
                <span className="text-base font-bold font-mono text-gray-900 mt-0.5 block">
                  {codeImpact.touched_files.length}
                </span>
                <span className="text-[10px] text-gray-400 font-mono truncate block">
                  {codeImpact.touched_files.join(', ')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200">
                <span className="text-[10px] text-rose-700 font-mono uppercase block">Downstream Affected Files</span>
                <span className="text-base font-bold font-mono text-rose-900 mt-0.5 block">
                  {codeImpact.total_affected_files}
                </span>
                <span className="text-[10px] text-rose-600 font-mono">Direct & transitive callers</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                <span className="text-[10px] text-amber-700 font-mono uppercase block">Affected Code Entities</span>
                <span className="text-base font-bold font-mono text-amber-900 mt-0.5 block">
                  {codeImpact.total_affected_symbols}
                </span>
                <span className="text-[10px] text-amber-600 font-mono">Classes, functions & modules</span>
              </div>
            </div>

            {/* Per-touched file CodeImpactPanel breakdown */}
            <div className="space-y-4">
              {codeImpact.impacts.map((imp, idx) => (
                <CodeImpactPanel
                  key={idx}
                  impact={imp}
                  onViewFile={handleViewFile}
                  showGraphifyLink={true}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 text-xs text-gray-500 font-mono italic bg-gray-50 rounded-xl border border-gray-200">
            {codeImpact?.summary || 'No repository file mutations were detected in this incident trace.'}
          </div>
        )}
      </div>

      {/* Detection Findings Breakdown */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-rift-accent" />
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider font-mono">
            Detection Findings ({incident.detections.length})
          </h3>
        </div>

        <div className="space-y-3">
          {incident.detections.map((det) => (
            <div
              key={det.id}
              className="card-antigravity p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-rift-accent px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                    {det.rule_id}
                  </span>
                  <span className="font-semibold text-sm text-gray-900">{det.title}</span>
                  <SeverityBadge severity={det.severity} size="sm" />
                </div>
                <span
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold border ${
                    det.verification_status === 'CONFIRMED'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : det.verification_status === 'SUSPECTED'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {det.verification_status}
                </span>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed">{det.description}</p>

              {/* Supporting Evidence References */}
              {det.evidence && det.evidence.length > 0 && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 block">
                    Cited Evidence Items ({det.evidence.length})
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {det.evidence.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() =>
                          navigate(`/investigations/${incident.trace_id}?event=${ev.event_id}`)
                        }
                        className="p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-blue-400 cursor-pointer transition flex items-start justify-between gap-2 group"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span className="text-amber-700 font-bold group-hover:text-rift-accent">
                              {ev.event_id}
                            </span>
                            <span className="text-[10px] text-gray-500 px-1.5 py-0.2 rounded-full bg-white border border-gray-200">
                              {ev.evidence_type}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-600 leading-snug">
                            {ev.description}
                          </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-rift-accent flex-shrink-0 mt-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gemma AI Investigation Engine */}
      <GemmaInvestigationPanel
        incidentId={incident.id}
        traceId={incident.trace_id}
        incidentTitle={incident.title}
        incidentSeverity={incident.severity}
        onNavigateToEvent={(eventId) =>
          navigate(`/investigations/${incident.trace_id}?event=${eventId}`)
        }
      />

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
