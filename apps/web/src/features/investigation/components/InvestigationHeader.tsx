import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TraceDetail } from '../../../types';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { SeverityBadge } from '../../../components/common/SeverityBadge';
import {
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  GitBranch,
  Split,
  Bot,
  Keyboard,
  ShieldAlert,
  Flame,
  Filter,
  Sparkles,
  FlaskConical,
  Compass,
} from 'lucide-react';

interface InvestigationHeaderProps {
  trace: TraceDetail;
  incidentCount: number;
  highestSeverity: string | null;
  firstSuspiciousEventId: string | null;
  viewMode: 'graph' | 'intent' | 'investigation' | 'codebase';
  onViewModeChange: (mode: 'graph' | 'intent' | 'investigation' | 'codebase') => void;
  onJumpToFirstSuspicious?: () => void;
  onRunDetection: () => void;
  isRunningDetection: boolean;
  showOnlyFlagged: boolean;
  onToggleShowOnlyFlagged: () => void;
  onOpenShortcutsModal: () => void;
  associatedIncidentId?: string | null;
  replaysCount?: number;
  latestReplayStatus?: string | null;
}

export const InvestigationHeader: React.FC<InvestigationHeaderProps> = ({
  trace,
  incidentCount,
  highestSeverity,
  firstSuspiciousEventId,
  viewMode,
  onViewModeChange,
  onJumpToFirstSuspicious,
  onRunDetection,
  isRunningDetection,
  showOnlyFlagged,
  onToggleShowOnlyFlagged,
  onOpenShortcutsModal,
  associatedIncidentId,
  replaysCount = 0,
  latestReplayStatus,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const navigate = useNavigate();

  const handleCopyId = () => {
    navigator.clipboard.writeText(trace.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <header className="bg-white border-b border-gray-200 shrink-0 select-none">
      {/* Row 1: Navigation, Trace Identity & Quick Operational Actions */}
      <div className="px-4 py-2 flex items-center justify-between gap-3 border-b border-gray-100">
        {/* Left: Navigation Back Button + Trace Metadata */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            to={`/traces/${trace.id}`}
            className="p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition shrink-0"
            title="Return to Trace Overview"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-semibold text-gray-900 whitespace-nowrap">
              {trace.id}
            </span>
            <button
              onClick={handleCopyId}
              className="text-gray-400 hover:text-gray-700 transition shrink-0 p-0.5"
              title="Copy Trace ID"
            >
              {copiedId ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            <span className="text-gray-300">|</span>

            <div className="flex items-center gap-1.5 text-xs text-gray-600 shrink-0">
              <Bot className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-gray-900 font-medium whitespace-nowrap">{trace.agent_name}</span>
            </div>

            <div className="shrink-0">
              <StatusBadge status={trace.status} size="sm" />
            </div>

            {highestSeverity && (
              <div className="flex items-center gap-1.5 shrink-0">
                <SeverityBadge severity={highestSeverity} size="sm" />
                <span className="text-[11px] font-mono text-gray-500 whitespace-nowrap hidden md:inline">
                  ({incidentCount} {incidentCount === 1 ? 'incident' : 'incidents'})
                </span>
              </div>
            )}

            {trace.objective && (
              <div className="hidden xl:flex items-center gap-1.5 text-xs text-gray-500 min-w-0 border-l border-gray-200 pl-2.5 ml-1">
                <span className="text-gray-400 whitespace-nowrap">Objective:</span>
                <span className="text-gray-700 font-medium truncate max-w-sm" title={trace.objective}>
                  {trace.objective}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Operational Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {firstSuspiciousEventId && onJumpToFirstSuspicious && (
            <button
              onClick={onJumpToFirstSuspicious}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-800 text-xs font-medium transition shadow-subtle whitespace-nowrap"
              title="Jump to the earliest event flagged with suspicious or anomalous telemetry"
            >
              <Flame className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span className="hidden sm:inline">First Suspicious</span>
            </button>
          )}

          <button
            onClick={onToggleShowOnlyFlagged}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition shadow-subtle whitespace-nowrap ${
              showOnlyFlagged
                ? 'bg-rose-50 border-rose-300 text-rose-700 font-semibold'
                : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title="Filter graph and timeline to only show flagged suspicious events"
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Flagged Only</span>
          </button>

          {associatedIncidentId && (
            <button
              onClick={() => navigate(`/incidents/${associatedIncidentId}`)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 text-xs font-medium transition shadow-subtle whitespace-nowrap"
              title="View full incident report"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span className="hidden sm:inline">Incident</span>
            </button>
          )}

          {associatedIncidentId && (
            <button
              onClick={() => navigate(`/replay?incidentId=${associatedIncidentId}`)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition shadow-subtle whitespace-nowrap ${
                replaysCount > 0
                  ? 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 font-semibold'
                  : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900'
              }`}
              title={replaysCount > 0 ? `View ${replaysCount} replay(s) in Replay Lab` : 'Open in Replay Lab'}
            >
              <FlaskConical className={`w-3.5 h-3.5 ${replaysCount > 0 ? 'text-purple-600' : ''}`} />
              <span className="hidden sm:inline">
                {replaysCount > 0 ? `Replay (${replaysCount})` : 'Replay Lab'}
              </span>
            </button>
          )}

          <button
            onClick={onRunDetection}
            disabled={isRunningDetection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-medium transition disabled:opacity-50 shadow-subtle whitespace-nowrap"
            title="Re-run deterministic detection rules"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunningDetection ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Detect</span>
          </button>

          <button
            onClick={onOpenShortcutsModal}
            className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition shadow-subtle shrink-0"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Analytical View Mode Switcher Strip */}
      <div className="px-4 py-1.5 bg-[#FAFAFA] flex items-center justify-between gap-3">
        {/* View Mode Toggle: Execution Graph vs Evidence vs Intent vs Code Knowledge */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-gray-200/70 border border-gray-200 text-xs shadow-inner">
          <button
            onClick={() => onViewModeChange('graph')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              viewMode === 'graph'
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Execution Graph</span>
          </button>

          <button
            onClick={() => onViewModeChange('investigation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              viewMode === 'investigation'
                ? 'bg-white text-purple-700 shadow-sm font-semibold'
                : 'text-gray-600 hover:text-purple-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Investigation Evidence</span>
          </button>

          <button
            onClick={() => onViewModeChange('intent')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              viewMode === 'intent'
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            <span>Intent vs Execution</span>
          </button>

          <button
            onClick={() => onViewModeChange('codebase')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition whitespace-nowrap ${
              viewMode === 'codebase'
                ? 'bg-white text-emerald-700 shadow-sm font-semibold'
                : 'text-gray-600 hover:text-emerald-700'
            }`}
            title="Inspect codebase static knowledge graph (Graphify AST)"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-600" />
            <span>Code Knowledge</span>
          </button>
        </div>

        {/* Right side telemetry summary */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 font-mono">
          <span>{trace.spans?.length || 0} spans</span>
          <span className="text-gray-300">·</span>
          <span>{incidentCount} {incidentCount === 1 ? 'incident' : 'incidents'}</span>
        </div>
      </div>
    </header>
  );
};
