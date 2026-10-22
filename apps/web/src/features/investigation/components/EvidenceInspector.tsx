import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Span, Detection, Replay } from '../../../types';
import { EventOverview } from './EventOverview';
import { JsonInspector } from './JsonInspector';
import { SeverityBadge } from '../../../components/common/SeverityBadge';
import {
  FileText,
  LogIn,
  LogOut,
  AlertOctagon,
  ShieldAlert,
  Code2,
  X,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  FlaskConical,
} from 'lucide-react';

export type InspectorTab = 'overview' | 'inputs' | 'outputs' | 'errors' | 'evidence' | 'replay' | 'raw';

interface EvidenceInspectorProps {
  span: Span | null;
  traceId: string;
  ancestorIds: string[];
  childIds: string[];
  allDetections: Detection[];
  isFirstSuspicious: boolean;
  onNavigateToEvent: (id: string) => void;
  onNavigateToIncident?: (incidentId: string) => void;
  activeTab?: InspectorTab;
  onTabChange?: (tab: InspectorTab) => void;
  onClose?: () => void;
  replays?: Replay[];
}

export const EvidenceInspector: React.FC<EvidenceInspectorProps> = ({
  span,
  traceId,
  ancestorIds,
  childIds,
  allDetections,
  isFirstSuspicious,
  onNavigateToEvent,
  onNavigateToIncident,
  activeTab: controlledTab,
  onTabChange,
  onClose,
  replays = [],
}) => {
  const navigate = useNavigate();
  const [internalTab, setInternalTab] = useState<InspectorTab>('overview');
  const currentTab = controlledTab ?? internalTab;
  const setTab = (t: InspectorTab) => {
    if (onTabChange) onTabChange(t);
    else setInternalTab(t);
  };

  const [copiedId, setCopiedId] = useState(false);

  if (!span) {
    return (
      <aside className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-white border-l border-gray-200">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">No Event Selected</h4>
        <p className="text-xs text-gray-500 max-w-[240px]">
          Click any node in the execution graph or an entry in the timeline to inspect inputs, outputs, errors, and incident evidence.
        </p>
      </aside>
    );
  }

  // Detections that specifically cite this span in their evidence
  const citingDetections = allDetections.filter(
    (d) => d.evidence && d.evidence.some((e) => e.event_id === span.id)
  );

  const hasInputs = span.input_data && Object.keys(span.input_data).length > 0;
  const hasOutputs = span.output_data && Object.keys(span.output_data).length > 0;
  const hasError =
    span.status === 'error' ||
    (span.error_data && Object.keys(span.error_data).length > 0);
  const hasEvidence = citingDetections.length > 0;
  const matchingReplay = replays.find((r) => r.original_event_id === span.id);
  const hasReplay = !!matchingReplay;

  const handleCopyId = () => {
    navigator.clipboard.writeText(span.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <aside className="w-full h-full flex flex-col bg-white border-l border-gray-200 select-text">
      {/* Inspector Header */}
      <div className="p-3.5 border-b border-gray-200 bg-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-semibold text-gray-800 truncate">
            {span.name}
          </span>
          <span className="text-[10px] font-mono text-gray-500 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 shrink-0">
            {span.event_type}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopyId}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            title="Copy Span ID"
          >
            {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              title="Close Inspector"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="px-3 border-b border-gray-200 bg-gray-50/50 flex items-center gap-1 overflow-x-auto text-[11px] font-mono shrink-0">
        <button
          onClick={() => setTab('overview')}
          className={`py-2 px-2.5 font-medium border-b-2 transition whitespace-nowrap ${
            currentTab === 'overview'
              ? 'border-rift-accent text-rift-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Overview
        </button>

        <button
          onClick={() => setTab('inputs')}
          className={`py-2 px-2.5 font-medium border-b-2 flex items-center gap-1 transition whitespace-nowrap ${
            currentTab === 'inputs'
              ? 'border-rift-accent text-rift-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <LogIn className="w-3 h-3" />
          <span>Inputs</span>
          {hasInputs && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
        </button>

        <button
          onClick={() => setTab('outputs')}
          className={`py-2 px-2.5 font-medium border-b-2 flex items-center gap-1 transition whitespace-nowrap ${
            currentTab === 'outputs'
              ? 'border-rift-accent text-rift-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <LogOut className="w-3 h-3" />
          <span>Outputs</span>
          {hasOutputs && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
        </button>

        <button
          onClick={() => setTab('errors')}
          className={`py-2 px-2.5 font-medium border-b-2 flex items-center gap-1 transition whitespace-nowrap ${
            currentTab === 'errors'
              ? 'border-rose-600 text-rose-600 font-semibold'
              : hasError
              ? 'border-transparent text-rose-600'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <AlertOctagon className="w-3 h-3" />
          <span>Errors</span>
          {hasError && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />}
        </button>

        <button
          onClick={() => setTab('evidence')}
          className={`py-2 px-2.5 font-medium border-b-2 flex items-center gap-1 transition whitespace-nowrap ${
            currentTab === 'evidence'
              ? 'border-amber-600 text-amber-700 font-semibold'
              : hasEvidence
              ? 'border-transparent text-amber-700'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <ShieldAlert className="w-3 h-3" />
          <span>Evidence</span>
          {citingDetections.length > 0 && (
            <span className="text-[10px] font-mono">({citingDetections.length})</span>
          )}
        </button>

        {hasReplay && (
          <button
            onClick={() => setTab('replay')}
            className={`py-2 px-2.5 font-medium border-b-2 flex items-center gap-1 transition whitespace-nowrap ${
              currentTab === 'replay'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent text-emerald-700'
            }`}
          >
            <FlaskConical className="w-3 h-3" />
            <span>Replay</span>
          </button>
        )}

        <button
          onClick={() => setTab('raw')}
          className={`py-2 px-2.5 font-medium border-b-2 flex items-center gap-1 transition whitespace-nowrap ${
            currentTab === 'raw'
              ? 'border-rift-accent text-rift-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Code2 className="w-3 h-3" />
          <span>Raw</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        {currentTab === 'overview' && (
          <EventOverview
            span={span}
            ancestorIds={ancestorIds}
            childIds={childIds}
            detections={citingDetections}
            isFirstSuspicious={isFirstSuspicious}
            onNavigateToEvent={onNavigateToEvent}
          />
        )}

        {currentTab === 'inputs' && (
          <JsonInspector
            data={span.input_data}
            title="Structured Tool Arguments / Prompts"
          />
        )}

        {currentTab === 'outputs' && (
          <JsonInspector
            data={span.output_data}
            title="Execution Result & Output"
          />
        )}

        {currentTab === 'errors' && (
          <div className="space-y-3">
            {hasError ? (
              <>
                {span.error_data?.message && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                    <div className="font-semibold text-rose-900 font-mono flex items-center gap-1.5 text-[11px]">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                      <span>Execution Error Detected</span>
                    </div>
                    <div className="text-rose-800 font-mono text-[11px]">
                      {span.error_data.message}
                    </div>
                  </div>
                )}
                <JsonInspector
                  data={span.error_data}
                  title="Diagnostic Details"
                  isError={true}
                />
              </>
            ) : (
              <div className="p-8 text-center text-xs text-gray-400 italic bg-white rounded-xl border border-gray-200">
                No error recorded for this span. Execution succeeded cleanly.
              </div>
            )}
          </div>
        )}

        {currentTab === 'evidence' && (
          <div className="space-y-3 text-xs">
            {isFirstSuspicious && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <div className="font-semibold text-amber-800 font-mono flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>First Suspicious Event</span>
                </div>
                <p className="text-gray-700">
                  This span is identified as the earliest operational deviation leading to downstream failure.
                </p>
              </div>
            )}

            {citingDetections.length === 0 && !isFirstSuspicious ? (
              <div className="p-8 text-center text-xs text-gray-400 italic bg-white rounded-xl border border-gray-200">
                This event is not cited by any current incident rule detection findings.
              </div>
            ) : (
              citingDetections.map((det) => (
                <div
                  key={det.id}
                  className="card-antigravity p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-rift-accent px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                      {det.rule_id}
                    </span>
                    <SeverityBadge severity={det.severity} size="sm" />
                  </div>

                  <h5 className="font-semibold text-gray-900 text-xs">{det.title}</h5>
                  <p className="text-gray-700 text-xs leading-relaxed">{det.description}</p>

                  {det.evidence && (
                    <div className="pt-2 border-t border-gray-100 space-y-1 font-mono text-[11px]">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                        Evidence Details:
                      </span>
                      {det.evidence
                        .filter((e) => e.event_id === span.id)
                        .map((e, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-800">
                            {e.description}
                          </div>
                        ))}
                    </div>
                  )}

                  {det.incident_id && onNavigateToIncident && (
                    <button
                      onClick={() => onNavigateToIncident(det.incident_id!)}
                      className="text-rift-accent hover:underline flex items-center gap-1 font-mono text-[11px] pt-1"
                    >
                      <span>View full incident report</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {currentTab === 'replay' && matchingReplay && (
          <div className="card-antigravity p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-gray-900">
                Sandbox Replay #{matchingReplay.id.slice(0, 8)}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold uppercase ${
                  matchingReplay.status === 'VERIFIED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {matchingReplay.status}
              </span>
            </div>

            <p className="text-gray-600 text-xs leading-relaxed">
              This event was executed in a counterfactual sandbox with modified arguments.
            </p>

            <button
              onClick={() => navigate('/replay')}
              className="btn-secondary w-full text-xs"
            >
              <FlaskConical className="w-3.5 h-3.5 text-rift-accent" />
              <span>Inspect in Replay Lab</span>
            </button>
          </div>
        )}

        {currentTab === 'raw' && (
          <JsonInspector
            data={span}
            title="Complete Span JSON"
          />
        )}
      </div>
    </aside>
  );
};
