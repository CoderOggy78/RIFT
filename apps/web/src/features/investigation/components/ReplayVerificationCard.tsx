import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Replay } from '../../../types';
import {
  FlaskConical,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileDiff,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface ReplayVerificationCardProps {
  replay: Replay;
  incidentId: string;
}

export const ReplayVerificationCard: React.FC<ReplayVerificationCardProps> = ({
  replay,
  incidentId,
}) => {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();

  const originalVariant = replay.variants?.find((v) => v.variant_type === 'original');
  const counterfactualVariant = replay.variants?.find((v) => v.variant_type === 'counterfactual');
  const comparison = replay.comparison;

  const isCompleted = replay.status === 'completed';
  const isPassed =
    comparison?.conclusion === 'counterfactual_passed_original_failed' ||
    counterfactualVariant?.validation_status === 'passed';

  return (
    <div className="card-antigravity overflow-hidden mb-4">
      {/* Header bar */}
      <div className="px-5 py-3 bg-purple-50/60 flex items-center justify-between gap-3 border-b border-purple-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0 shadow-2xs">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-rift-text">
                Counterfactual Replay Verification
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 font-semibold uppercase">
                Isolated Sandbox Artifact
              </span>
              <span
                className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase border ${
                  isPassed
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {replay.status}
              </span>
            </div>
            <p className="text-[11px] text-rift-muted truncate mt-0.5">
              Original Event: <span className="font-mono text-rift-text font-medium">{replay.original_event_id}</span>
              {' · '}Fixture: <span className="font-mono text-purple-800 font-medium">{replay.fixture_id}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(`/replay?incidentId=${incidentId}&replayId=${replay.id}`)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rift-accent hover:bg-rift-accent/90 text-white text-xs font-medium transition shadow-sm"
            title="Open in Replay Lab"
          >
            <span>Replay Lab</span>
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="p-1 rounded-lg text-rift-muted hover:text-rift-text hover:bg-rift-base transition"
            title={expanded ? 'Collapse Replay Details' : 'Expand Replay Details'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="p-4 space-y-3">
          {/* Isolation Notice banner */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rift-base/60 border border-rift-border text-[11px] text-rift-muted leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-rift-text">Separate Visual Grouping: </span>
              These operations were executed inside disposable containerized sandboxes initialized from an identical fixture snapshot. They are segregated from historical trace telemetry.
            </div>
          </div>

          {/* Side by side comparison snippet */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            {/* Original Variant */}
            <div className="p-3 rounded-xl bg-rose-50/40 border border-rose-200 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-rose-700">ORIGINAL ACTION</span>
                <span className="flex items-center gap-1 text-rose-700 font-semibold">
                  <XCircle className="w-3.5 h-3.5" />
                  Validation: {originalVariant?.validation_status?.toUpperCase() || 'FAILED'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-rose-200 text-[11px] truncate shadow-2xs">
                <span className="text-rift-muted">op: </span>
                <span className="text-rift-text font-semibold">{originalVariant?.operation_type}</span>(
                <span className="text-rose-700 font-mono">
                  {JSON.stringify(originalVariant?.validated_arguments || {})}
                </span>)
              </div>
            </div>

            {/* Counterfactual Variant */}
            <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-emerald-700">COUNTERFACTUAL CORRECTION</span>
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Validation: {counterfactualVariant?.validation_status?.toUpperCase() || 'PASSED'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-200 text-[11px] truncate shadow-2xs">
                <span className="text-rift-muted">op: </span>
                <span className="text-rift-text font-semibold">{counterfactualVariant?.operation_type}</span>(
                <span className="text-emerald-700 font-mono">
                  {JSON.stringify(counterfactualVariant?.validated_arguments || {})}
                </span>)
              </div>
            </div>
          </div>

          {/* Filesystem Differences & Conclusion */}
          {comparison && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-rift-border text-xs">
              <div className="flex items-center gap-3">
                <span className="text-rift-muted flex items-center gap-1 font-medium">
                  <FileDiff className="w-3.5 h-3.5 text-rift-accent" />
                  Filesystem Diff:
                </span>
                <span className="text-emerald-700 font-mono font-bold">
                  +{comparison.added_files?.length || 0}
                </span>
                <span className="text-rose-700 font-mono font-bold">
                  -{comparison.removed_files?.length || 0}
                </span>
                <span className="text-amber-700 font-mono font-bold">
                  ~{comparison.changed_files?.length || 0}
                </span>
              </div>

              <div className="text-[11px] text-rift-muted font-medium">
                Conclusion: <span className="text-rift-text font-bold font-mono">{comparison.conclusion}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
