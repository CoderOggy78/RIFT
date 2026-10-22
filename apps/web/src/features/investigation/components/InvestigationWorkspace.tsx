import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  TraceDetail,
  ExecutionGraph as IExecutionGraph,
  InvestigationContext,
  Span,
  Detection,
  Incident,
  Replay,
} from '../../../types';
import { api } from '../../../lib/api';
import { InvestigationHeader } from './InvestigationHeader';
import { ExecutionTimeline } from './ExecutionTimeline';
import { ExecutionGraph } from './ExecutionGraph';
import { EvidenceInspector, InspectorTab } from './EvidenceInspector';
import { IntentExecutionView } from './IntentExecutionView';
import { GemmaInvestigationPanel } from './GemmaInvestigationPanel';
import { ReplayVerificationCard } from './ReplayVerificationCard';
import { CodebaseKnowledgePanel } from './CodebaseKnowledgePanel';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { PanelLeftClose, PanelLeft, PanelRightClose, PanelRight, Loader2 } from 'lucide-react';

interface InvestigationWorkspaceProps {
  trace: TraceDetail;
  initialGraphData?: IExecutionGraph;
  onRefreshTrace?: () => void;
}

export const InvestigationWorkspace: React.FC<InvestigationWorkspaceProps> = ({
  trace,
  initialGraphData,
  onRefreshTrace,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Primary Data State
  const [graphData, setGraphData] = useState<IExecutionGraph | null>(initialGraphData ?? null);
  const [investigationContext, setInvestigationContext] = useState<InvestigationContext | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [associatedIncidents, setAssociatedIncidents] = useState<Incident[]>([]);
  const [replays, setReplays] = useState<Replay[]>([]);
  const [isLoading, setIsLoading] = useState(!initialGraphData);
  const [isRunningDetection, setIsRunningDetection] = useState(false);

  // View & Filter State
  const [viewMode, setViewMode] = useState<'graph' | 'intent' | 'investigation' | 'codebase'>('graph');
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [focusExecutionPath, setFocusExecutionPath] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // Panel Collapse States (Responsive layout)
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState<'timeline' | 'graph' | 'inspector'>('graph');

  // Selected Event State (URL-synchronized)
  const selectedEventId = searchParams.get('event') || null;

  // Inspector tab
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('overview');

  // Load initial graph, intent context, detections, and incident metadata
  const loadWorkspaceData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [gData, iData, dets, incs] = await Promise.all([
        api.getExecutionGraph(trace.id),
        api.getInvestigationContext(trace.id),
        api.getTraceDetections(trace.id),
        api.listIncidents(),
      ]);
      setGraphData(gData);
      setInvestigationContext(iData);
      setDetections(dets);
      const matchingIncs = incs.filter((inc) => inc.trace_id === trace.id);
      setAssociatedIncidents(matchingIncs);

      if (matchingIncs.length > 0) {
        try {
          const replayList = await api.listReplays(matchingIncs[0].id);
          setReplays(replayList || []);
        } catch (rErr) {
          console.warn('No replays found for incident:', rErr);
        }
      }
    } catch (err) {
      console.error('Failed to load investigation workspace data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [trace.id]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Derived properties
  const spans = useMemo(() => trace.spans || [], [trace.spans]);
  const spanMap = useMemo(() => new Map(spans.map((s) => [s.id, s])), [spans]);

  const selectedSpan = useMemo(() => {
    return selectedEventId ? spanMap.get(selectedEventId) || null : null;
  }, [selectedEventId, spanMap]);

  // Earliest suspicious event (First Suspicious Event)
  const firstSuspiciousEventId = useMemo(() => {
    if (investigationContext?.first_suspicious_event_id) {
      return investigationContext.first_suspicious_event_id;
    }
    const flagged = spans.filter((s) => s.status === 'error');
    if (flagged.length > 0) {
      flagged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return flagged[0].id;
    }
    return null;
  }, [investigationContext, spans]);

  // Ancestor & Descendant IDs for Path Reconstruction
  const ancestorIds = useMemo(() => {
    if (!selectedEventId) return [];
    const ancestors: string[] = [];
    let curr = spanMap.get(selectedEventId);
    while (curr && curr.parent_span_id) {
      if (ancestors.includes(curr.parent_span_id)) break;
      ancestors.push(curr.parent_span_id);
      curr = spanMap.get(curr.parent_span_id);
    }
    return ancestors;
  }, [selectedEventId, spanMap]);

  const ancestorIdSet = useMemo(() => new Set(ancestorIds), [ancestorIds]);

  const childIds = useMemo(() => {
    if (!selectedEventId) return [];
    return spans.filter((s) => s.parent_span_id === selectedEventId).map((s) => s.id);
  }, [selectedEventId, spans]);

  const descendantIds = useMemo(() => {
    if (!selectedEventId) return [];
    const childrenMap = new Map<string, string[]>();
    for (const s of spans) {
      if (s.parent_span_id) {
        if (!childrenMap.has(s.parent_span_id)) childrenMap.set(s.parent_span_id, []);
        childrenMap.get(s.parent_span_id)!.push(s.id);
      }
    }
    const descendants: string[] = [];
    const queue = [...(childrenMap.get(selectedEventId) || [])];
    while (queue.length > 0) {
      const next = queue.shift()!;
      descendants.push(next);
      const kids = childrenMap.get(next) || [];
      queue.push(...kids);
    }
    return descendants;
  }, [selectedEventId, spans]);

  const descendantIdSet = useMemo(() => new Set(descendantIds), [descendantIds]);

  // Central Event Selection Handler (synchronizes Timeline, Graph, Inspector, and URL)
  const handleSelectEvent = useCallback(
    (eventId: string | null) => {
      const newParams = new URLSearchParams(searchParams);
      if (eventId) {
        newParams.set('event', eventId);
      } else {
        newParams.delete('event');
      }
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Jump to First Suspicious Event
  const handleJumpToFirstSuspicious = useCallback(() => {
    if (firstSuspiciousEventId) {
      handleSelectEvent(firstSuspiciousEventId);
      setInspectorTab('evidence');
      if (mobileTab === 'timeline') setMobileTab('graph');
    }
  }, [firstSuspiciousEventId, handleSelectEvent, mobileTab]);

  // Re-run Deterministic Incident Detection
  const handleRunDetection = async () => {
    try {
      setIsRunningDetection(true);
      await api.runTraceDetection(trace.id);
      await loadWorkspaceData();
      if (onRefreshTrace) onRefreshTrace();
    } catch (err) {
      console.error('Failed to run deterministic detection:', err);
    } finally {
      setIsRunningDetection(false);
    }
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.monaco-editor')
      ) {
        return;
      }

      // J: Next event
      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        if (spans.length === 0) return;
        if (!selectedEventId) {
          handleSelectEvent(spans[0].id);
        } else {
          const idx = spans.findIndex((s) => s.id === selectedEventId);
          if (idx >= 0 && idx < spans.length - 1) {
            handleSelectEvent(spans[idx + 1].id);
          }
        }
      }

      // K: Previous event
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (spans.length === 0) return;
        if (!selectedEventId) {
          handleSelectEvent(spans[spans.length - 1].id);
        } else {
          const idx = spans.findIndex((s) => s.id === selectedEventId);
          if (idx > 0) {
            handleSelectEvent(spans[idx - 1].id);
          }
        }
      }

      // /: Focus timeline search
      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('timeline-search-input') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
        }
      }

      // P: Toggle path focus
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setFocusExecutionPath((prev) => !prev);
      }

      // ?: Open shortcuts modal
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsModalOpen(true);
      }

      // Esc: Clear path focus or selection
      if (e.key === 'Escape') {
        if (focusExecutionPath) {
          setFocusExecutionPath(false);
        } else if (selectedEventId) {
          handleSelectEvent(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [spans, selectedEventId, handleSelectEvent, focusExecutionPath]);

  // Highest severity detection
  const highestSeverity = useMemo(() => {
    if (detections.length === 0) return null;
    const order = ['critical', 'high', 'medium', 'low', 'info'];
    for (const sev of order) {
      if (detections.some((d) => d.severity.toLowerCase() === sev)) {
        return sev;
      }
    }
    return 'info';
  }, [detections]);

  const associatedIncident = associatedIncidents.length > 0 ? associatedIncidents[0] : null;

  return (
    <div className="flex flex-col h-screen w-full bg-white text-gray-900 overflow-hidden select-none">
      {/* Top Header & Incident Context Strip */}
      <InvestigationHeader
        trace={trace}
        incidentCount={detections.length}
        highestSeverity={highestSeverity}
        firstSuspiciousEventId={firstSuspiciousEventId}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onJumpToFirstSuspicious={handleJumpToFirstSuspicious}
        onRunDetection={handleRunDetection}
        isRunningDetection={isRunningDetection}
        showOnlyFlagged={showOnlyFlagged}
        onToggleShowOnlyFlagged={() => setShowOnlyFlagged((prev) => !prev)}
        onOpenShortcutsModal={() => setShortcutsModalOpen(true)}
        associatedIncidentId={associatedIncident?.id}
        replaysCount={replays.length}
        latestReplayStatus={replays[0]?.status}
      />

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex items-center justify-around border-b border-gray-200 bg-white text-xs shrink-0">
        <button
          onClick={() => setMobileTab('timeline')}
          className={`flex-1 py-2.5 font-medium text-center border-b-2 transition ${
            mobileTab === 'timeline'
              ? 'border-rift-accent text-rift-accent bg-blue-50/50 font-semibold'
              : 'border-transparent text-gray-500'
          }`}
        >
          Timeline ({spans.length})
        </button>
        <button
          onClick={() => setMobileTab('graph')}
          className={`flex-1 py-2.5 font-medium text-center border-b-2 transition ${
            mobileTab === 'graph'
              ? 'border-rift-accent text-rift-accent bg-blue-50/50 font-semibold'
              : 'border-transparent text-gray-500'
          }`}
        >
          {viewMode === 'graph' ? 'Graph' : 'Intent vs Exec'}
        </button>
        <button
          onClick={() => setMobileTab('inspector')}
          className={`flex-1 py-2.5 font-medium text-center border-b-2 transition ${
            mobileTab === 'inspector'
              ? 'border-rift-accent text-rift-accent bg-blue-50/50 font-semibold'
              : 'border-transparent text-gray-500'
          }`}
        >
          Inspector {selectedSpan ? `(${selectedSpan.id})` : ''}
        </button>
      </div>

      {/* Main Investigation Workspace Body (3 Panels) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT PANEL: EXECUTION TIMELINE */}
        <div
          className={`h-full shrink-0 transition-all duration-200 z-10 ${
            timelineCollapsed ? 'w-0 overflow-hidden' : 'w-full lg:w-[320px] xl:w-[350px]'
          } ${mobileTab !== 'timeline' ? 'hidden lg:block' : 'block'}`}
        >
          <div className="h-full w-full relative">
            <ExecutionTimeline
              spans={spans}
              detections={detections}
              firstSuspiciousEventId={firstSuspiciousEventId}
              selectedEventId={selectedEventId}
              onSelectEvent={(id) => handleSelectEvent(id)}
            />
          </div>
        </div>

        {/* Left Panel Toggle Button (Desktop) */}
        <button
          onClick={() => setTimelineCollapsed((prev) => !prev)}
          className="hidden lg:flex items-center justify-center absolute left-[320px] xl:left-[350px] top-3 z-20 w-6 h-6 rounded-r-lg bg-white border border-l-0 border-gray-200 text-gray-400 hover:text-gray-900 transition shadow-sm"
          style={{ left: timelineCollapsed ? 0 : undefined }}
          title={timelineCollapsed ? 'Expand Timeline Panel' : 'Collapse Timeline Panel'}
        >
          {timelineCollapsed ? <PanelLeft className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>

        {/* CENTER PANEL: EXECUTION GRAPH OR INTENT VS EXECUTION */}
        <div
          className={`flex-1 h-full min-w-0 bg-[#F8F9FA] relative overflow-hidden ${
            mobileTab !== 'graph' ? 'hidden lg:block' : 'block'
          }`}
        >
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-rift-accent mb-3" />
              <p className="text-sm font-medium text-gray-900">
                Constructing execution DAG and resolving causal telemetry...
              </p>
            </div>
          ) : viewMode === 'investigation' ? (
            <div className="h-full overflow-y-auto p-5 max-w-5xl mx-auto space-y-4">
              {associatedIncidents.length > 0 ? (
                <>
                  {replays.length > 0 && (
                    <ReplayVerificationCard
                      replay={replays[0]}
                      incidentId={associatedIncidents[0].id}
                    />
                  )}
                  <GemmaInvestigationPanel
                    incidentId={associatedIncidents[0].id}
                    traceId={trace.id}
                    incidentTitle={associatedIncidents[0].title}
                    incidentSeverity={associatedIncidents[0].severity}
                    onNavigateToEvent={(eventId) => {
                      handleSelectEvent(eventId);
                      setViewMode('graph');
                    }}
                  />
                </>
              ) : (
                <div className="card-antigravity p-8 text-center space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">No Associated Incident Found</h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto">
                    This trace currently has no deterministic incident records. Run deterministic incident detection first to flag suspicious anomalies for Gemma investigation.
                  </p>
                  <button
                    onClick={handleRunDetection}
                    disabled={isRunningDetection}
                    className="btn-primary text-xs"
                  >
                    {isRunningDetection ? 'Running Detection...' : 'Run Incident Detection'}
                  </button>
                </div>
              )}
            </div>
          ) : viewMode === 'codebase' ? (
            <CodebaseKnowledgePanel />
          ) : viewMode === 'intent' && investigationContext?.intent_vs_execution ? (
            <IntentExecutionView
              data={investigationContext.intent_vs_execution}
              onSelectEvent={(eventId) => {
                handleSelectEvent(eventId);
                setViewMode('graph');
              }}
              onSwitchToGraph={() => setViewMode('graph')}
            />
          ) : graphData ? (
            <ExecutionGraph
              graphData={graphData}
              selectedEventId={selectedEventId}
              onSelectEvent={(id) => handleSelectEvent(id)}
              ancestorIds={ancestorIdSet}
              descendantIds={descendantIdSet}
              isPathFocusActive={focusExecutionPath}
              onTogglePathFocus={() => setFocusExecutionPath((prev) => !prev)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              No graph data available for this trace.
            </div>
          )}
        </div>

        {/* Right Panel Toggle Button (Desktop) */}
        <button
          onClick={() => setInspectorCollapsed((prev) => !prev)}
          className="hidden lg:flex items-center justify-center absolute right-[360px] xl:right-[420px] top-3 z-20 w-6 h-6 rounded-l-lg bg-white border border-r-0 border-gray-200 text-gray-400 hover:text-gray-900 transition shadow-sm"
          style={{ right: inspectorCollapsed ? 0 : undefined }}
          title={inspectorCollapsed ? 'Expand Inspector Panel' : 'Collapse Inspector Panel'}
        >
          {inspectorCollapsed ? <PanelRight className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
        </button>

        {/* RIGHT PANEL: EVIDENCE INSPECTOR */}
        <div
          className={`h-full shrink-0 transition-all duration-200 z-10 ${
            inspectorCollapsed ? 'w-0 overflow-hidden' : 'w-full lg:w-[360px] xl:w-[420px]'
          } ${mobileTab !== 'inspector' ? 'hidden lg:block' : 'block'}`}
        >
          <div className="h-full w-full relative">
            <EvidenceInspector
              span={selectedSpan}
              traceId={trace.id}
              ancestorIds={ancestorIds}
              childIds={childIds}
              allDetections={detections}
              isFirstSuspicious={selectedEventId === firstSuspiciousEventId}
              onNavigateToEvent={(id) => handleSelectEvent(id)}
              onNavigateToIncident={(incId) => navigate(`/incidents/${incId}`)}
              activeTab={inspectorTab}
              onTabChange={setInspectorTab}
              onClose={() => setInspectorCollapsed(true)}
              replays={replays}
            />
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Reference Dialog */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
};
