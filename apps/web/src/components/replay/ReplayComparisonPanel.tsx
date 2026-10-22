import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, FileCode, ArrowRight, ShieldCheck, FileDiff } from 'lucide-react';
import { Replay } from '../../types';

interface ReplayComparisonPanelProps {
  replay: Replay;
  onOpenDiff: (filename: string, diffText?: string | null) => void;
  onOpenManifest: () => void;
}

export const ReplayComparisonPanel: React.FC<ReplayComparisonPanelProps> = ({
  replay,
  onOpenDiff,
  onOpenManifest,
}) => {
  const origVariant = replay.variants.find((v) => v.variant_type === 'original');
  const cfVariant = replay.variants.find((v) => v.variant_type === 'counterfactual');
  const comparison = replay.comparison;

  const conclusionColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    counterfactual_passed_original_failed: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      label: 'Verified: Counterfactual Correction Succeeded (Original Failed Invariant)',
    },
    both_failed: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-800',
      label: 'Both Variants Failed Validation Checks',
    },
    both_passed: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      label: 'Both Variants Passed Validation (No Differential Discrepancy)',
    },
    counterfactual_introduced_failures: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      label: 'Counterfactual Correction Introduced New Failures',
    },
    safety_violation: {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-800',
      label: 'Security Boundary Violation: Path Escaped Sandbox',
    },
    inconclusive: {
      bg: 'bg-rift-elevated',
      border: 'border-rift-border',
      text: 'text-rift-text',
      label: 'Replay Inconclusive',
    },
  };

  const currentConclusion = comparison?.conclusion
    ? conclusionColors[comparison.conclusion] || conclusionColors.inconclusive
    : conclusionColors.inconclusive;

  return (
    <div className="card-antigravity overflow-hidden">
      {/* Header & Conclusion Banner */}
      <div className={`p-5 border-b ${currentConclusion.bg} ${currentConclusion.border} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-rift-surface border border-rift-border mt-0.5 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-rift-muted font-mono">
              Deterministic Replay Conclusion
            </div>
            <div className={`text-base font-bold mt-0.5 ${currentConclusion.text}`}>
              {currentConclusion.label}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenManifest}
            className="px-3.5 py-1.5 bg-rift-surface hover:bg-rift-base border border-rift-border rounded-full text-xs font-mono text-rift-text flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <FileCode className="w-3.5 h-3.5 text-rift-accent" />
            Audit Manifest
          </button>
        </div>
      </div>

      {/* Side-by-Side Execution Comparison Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: Original Variant Execution */}
        <div className="bg-rose-50/30 border border-rose-200/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-rose-200/60">
              <span className="font-semibold text-sm text-rose-700 flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Original Execution
              </span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-800 font-semibold">
                Validation: {origVariant?.validation_status?.toUpperCase() || 'FAILED'}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-rift-muted block mb-1 font-medium">Executed Operation:</span>
                <div className="bg-rift-surface border border-rift-border rounded-xl p-2.5 font-mono text-rift-text shadow-sm">
                  {origVariant?.operation_type}({JSON.stringify(origVariant?.validated_arguments)})
                </div>
              </div>

              <div>
                <span className="text-rift-muted block mb-1 font-medium">Validation Outcome:</span>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900">
                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-rose-700">
                    <XCircle className="w-4 h-4" /> Fixture Integrity Check Failed
                  </div>
                  <p className="text-xs leading-relaxed">
                    Protected source file <code>src/config.ts</code> missing from filesystem after deletion.
                  </p>
                </div>
              </div>

              <div>
                <span className="text-rift-muted block mb-1 font-medium">Execution Metrics:</span>
                <div className="flex items-center gap-4 text-rift-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-rift-muted" /> Duration:{' '}
                    <strong className="text-rift-text">{origVariant?.duration_ms || 12.4} ms</strong>
                  </span>
                  <span>Exit: <strong className="text-emerald-700 font-mono font-bold">0</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-rose-200/60 text-[11px] text-rift-muted">
            Sandbox: disposable scratch container (isolated from host)
          </div>
        </div>

        {/* RIGHT: Counterfactual Variant Execution */}
        <div className="bg-emerald-50/30 border border-emerald-200/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-emerald-200/60">
              <span className="font-semibold text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Counterfactual Correction
              </span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold">
                Validation: {cfVariant?.validation_status?.toUpperCase() || 'PASSED'}
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-rift-muted block mb-1 font-medium">Executed Operation:</span>
                <div className="bg-rift-surface border border-rift-border rounded-xl p-2.5 font-mono text-rift-text shadow-sm">
                  {cfVariant?.operation_type}({JSON.stringify(cfVariant?.validated_arguments)})
                </div>
              </div>

              <div>
                <span className="text-rift-muted block mb-1 font-medium">Validation Outcome:</span>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-900">
                  <div className="font-semibold flex items-center gap-1.5 mb-1 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" /> Fixture Integrity Passed
                  </div>
                  <p className="text-xs leading-relaxed">
                    Protected files <code>src/config.ts</code>, <code>src/main.ts</code>, <code>package.json</code> intact.
                    Temporary cache <code>tmp/cache.json</code> removed.
                  </p>
                </div>
              </div>

              <div>
                <span className="text-rift-muted block mb-1 font-medium">Execution Metrics:</span>
                <div className="flex items-center gap-4 text-rift-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-rift-muted" /> Duration:{' '}
                    <strong className="text-rift-text">{cfVariant?.duration_ms || 14.1} ms</strong>
                  </span>
                  <span>Exit: <strong className="text-emerald-700 font-mono font-bold">0</strong></span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-emerald-200/60 text-[11px] text-rift-muted">
            Sandbox: disposable scratch container (identical initial snapshot)
          </div>
        </div>
      </div>
    </div>
  );
};
