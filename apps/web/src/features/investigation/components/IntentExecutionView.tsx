import React from 'react';
import { IntentVsExecution } from '../../../types';
import { SeverityBadge } from '../../../components/common/SeverityBadge';
import {
  Compass,
  Zap,
  AlertTriangle,
  FileCode,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Activity,
  Layers,
} from 'lucide-react';

interface IntentExecutionViewProps {
  data: IntentVsExecution;
  onSelectEvent: (eventId: string) => void;
  onSwitchToGraph?: () => void;
}

export const IntentExecutionView: React.FC<IntentExecutionViewProps> = ({
  data,
  onSelectEvent,
  onSwitchToGraph,
}) => {
  const { intent, observed, has_deviations } = data;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 select-text">
      {/* Overview Banner */}
      <div className="bg-rift-surface border border-rift-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rift-accent animate-pulse" />
              <h2 className="text-base font-bold text-rift-text">
                Intent vs Execution Analysis
              </h2>
            </div>
            <p className="text-xs text-rift-muted mt-1">
              Deterministic comparison between user-declared instructions and observed tool telemetry.
            </p>
          </div>
          {onSwitchToGraph && (
            <button
              onClick={onSwitchToGraph}
              className="px-3.5 py-1.5 rounded-xl bg-rift-elevated border border-rift-border hover:border-rift-accent text-xs font-medium text-rift-text hover:text-rift-accent flex items-center gap-2 transition"
            >
              <span>Back to Execution Graph</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Deviations Alert Strip */}
        {has_deviations ? (
          <div className="p-3.5 rounded-xl bg-rift-critical/10 border border-rift-critical/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-rift-critical">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Execution Deviations Identified</span>
            </div>
            <p className="text-xs text-rift-text font-mono">
              The agent performed destructive operations or triggered safety violations contradicting user objectives or constraints.
            </p>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-rift-success/10 border border-rift-success/30 flex items-center gap-2 text-xs text-rift-success font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>No explicit objective contradictions detected in deterministic analysis.</span>
          </div>
        )}
      </div>

      {/* Side-by-Side Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT COLUMN: INTENT */}
        <div className="bg-rift-surface border border-rift-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-rift-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rift-accent/10 border border-rift-accent/30 flex items-center justify-center text-rift-accent">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rift-text">Agent Intent</h3>
                <span className="text-[11px] text-rift-muted">Recorded Objective & Constraints</span>
              </div>
            </div>
          </div>

          {/* User Instruction Block */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rift-muted">
              Declared Objective
            </span>
            <div className="p-3.5 rounded-xl bg-rift-elevated border border-rift-border text-xs text-rift-text leading-relaxed font-sans whitespace-pre-wrap">
              {intent.user_objective || 'No user objective prompt captured.'}
            </div>
          </div>

          {/* Explicit Instructions */}
          {intent.explicit_instructions && intent.explicit_instructions.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rift-muted">
                Explicit Instructions & Constraints
              </span>
              <ul className="space-y-1.5 pl-5 list-disc text-xs text-rift-text">
                {intent.explicit_instructions.map((ins, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {ins}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Declared Plan */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rift-muted">
              Declared Agent Plan
            </span>

            {intent.declared_plan ? (
              <div className="p-3 rounded-xl bg-rift-elevated border border-rift-border text-xs text-rift-text whitespace-pre-wrap font-mono">
                {intent.declared_plan}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-rift-elevated/50 border border-rift-border text-center text-xs text-rift-muted">
                No explicit planning phase was recorded by the agent. Execution proceeded directly from the initial prompt.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: OBSERVED EXECUTION */}
        <div className="bg-rift-surface border border-rift-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-rift-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rift-critical/10 border border-rift-critical/30 flex items-center justify-center text-rift-critical">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rift-text">Observed Execution</h3>
                <span className="text-[11px] text-rift-muted">
                  Actual Telemetry & State Mutations
                </span>
              </div>
            </div>
          </div>

          {/* Destructive Operations */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rift-muted flex items-center gap-1.5">
              <span>Destructive Operations Detected</span>
              {observed.destructive_operations && observed.destructive_operations.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rift-critical/20 text-rift-critical font-bold">
                  {observed.destructive_operations.length}
                </span>
              )}
            </span>

            {observed.destructive_operations && observed.destructive_operations.length > 0 ? (
              <div className="space-y-2">
                {observed.destructive_operations.map((op, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectEvent(op.event_id)}
                    className="p-3 rounded-xl bg-rift-critical/10 border border-rift-critical/30 hover:border-rift-critical cursor-pointer transition text-xs space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-rift-critical font-semibold">
                        <AlertOctagon className="w-3.5 h-3.5" />
                        <span>{op.tool}()</span>
                      </div>
                      <span className="font-mono text-[10px] text-rift-accent group-hover:underline flex items-center gap-1">
                        <span>{op.event_id}</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>

                    {op.target_path && (
                      <div className="font-mono text-[11px] text-rift-text">
                        Target: <span className="text-rift-critical font-bold">{op.target_path}</span>
                        {op.is_protected && (
                          <span className="ml-2 px-1.5 py-0.2 rounded bg-rift-critical text-[10px] text-rift-bg font-bold">
                            PROTECTED
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-rift-elevated/50 border border-rift-border text-xs text-rift-muted">
                No destructive file or system operations detected.
              </div>
            )}
          </div>

          {/* Failed Operations */}
          {observed.failed_operations && observed.failed_operations.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rift-muted flex items-center gap-1.5">
                <span>Failed Operations ({observed.failed_operations.length})</span>
              </span>

              <div className="space-y-2">
                {observed.failed_operations.map((op, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectEvent(op.event_id)}
                    className="p-3 rounded-xl bg-rift-critical/10 border border-rift-critical/30 hover:border-rift-critical cursor-pointer transition text-xs space-y-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-rift-critical font-semibold">
                        {op.name}
                      </span>
                      <span className="font-mono text-[10px] text-rift-accent group-hover:underline">
                        {op.event_id}
                      </span>
                    </div>
                    {op.error && (
                      <p className="text-[11px] text-rift-text font-mono truncate">
                        {typeof op.error === 'string' ? op.error : JSON.stringify(op.error)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed Validations */}
          {observed.failed_validations && observed.failed_validations.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rift-muted flex items-center gap-1.5">
                <span>Failed Validations & Invariants ({observed.failed_validations.length})</span>
              </span>

              <div className="space-y-2">
                {observed.failed_validations.map((val, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectEvent(val.event_id)}
                    className="p-3 rounded-xl bg-rift-warning/10 border border-rift-warning/30 hover:border-rift-warning cursor-pointer transition text-xs space-y-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-rift-warning font-semibold">
                        {val.name}
                      </span>
                      <span className="font-mono text-[10px] text-rift-accent group-hover:underline">
                        {val.event_id}
                      </span>
                    </div>
                    {val.output && (
                      <p className="text-[11px] text-rift-text font-mono">
                        {typeof val.output === 'string' ? val.output : JSON.stringify(val.output)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deterministic Incident Findings Section */}
      {observed.findings && observed.findings.length > 0 && (
        <div className="bg-rift-surface border border-rift-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rift-critical" />
              <h3 className="text-sm font-bold text-rift-text">
                Ground-Truth Incident Findings ({observed.findings.length})
              </h3>
            </div>
            <span className="text-xs text-rift-muted">
              Backed by deterministic detection rules
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {observed.findings.map((finding) => (
              <div
                key={finding.rule_id}
                className="p-4 rounded-xl bg-rift-elevated border border-rift-border hover:border-rift-border-hover transition space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <SeverityBadge severity={finding.severity} />
                  <span className="font-mono text-[10px] text-rift-muted">{finding.rule_id}</span>
                </div>

                <div>
                  <h4 className="font-semibold text-rift-text text-xs">{finding.title}</h4>
                  <p className="text-[11px] text-rift-muted mt-1 leading-relaxed">
                    {finding.description}
                  </p>
                </div>

                {finding.evidence_events && finding.evidence_events.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-rift-border">
                    <span className="text-[10px] uppercase font-semibold text-rift-muted">
                      Citing Telemetry Events
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {finding.evidence_events.map((evId) => (
                        <button
                          key={evId}
                          onClick={() => onSelectEvent(evId)}
                          className="px-2 py-1 rounded bg-rift-bg border border-rift-border hover:border-rift-accent font-mono text-[11px] text-rift-accent transition"
                        >
                          {evId}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
