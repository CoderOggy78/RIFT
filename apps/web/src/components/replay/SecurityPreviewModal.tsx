import React, { useState } from 'react';
import { X, ShieldCheck, AlertTriangle, Lock, Cpu, Network, CheckCircle, ArrowRight } from 'lucide-react';
import { ReplayPreview } from '../../types';

interface SecurityPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: ReplayPreview | null;
  onConfirmReplay: () => void;
  isExecuting: boolean;
}

export const SecurityPreviewModal: React.FC<SecurityPreviewModalProps> = ({
  isOpen,
  onClose,
  preview,
  onConfirmReplay,
  isExecuting,
}) => {
  const [approvedByUser, setApprovedByUser] = useState(false);

  if (!isOpen || !preview) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rift-text/30 backdrop-blur-xs animate-fadeIn">
      <div className="bg-rift-surface border border-rift-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-rift-border flex items-center justify-between bg-rift-base/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 border border-amber-200 text-amber-700">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-rift-text text-sm">Security Preview & Replay Authorization</h3>
              <p className="text-xs text-rift-muted">Review container boundaries and authorize isolated execution.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="text-rift-muted hover:text-rift-text transition-colors p-1 rounded-lg hover:bg-rift-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Operations to be executed */}
          <div className="bg-rift-base/30 border border-rift-border rounded-2xl p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-rift-muted block mb-2 font-mono">
              Operations to be Executed
            </span>
            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-rift-surface border border-rose-200 rounded-xl p-3 shadow-sm">
                <div className="text-rose-700 font-semibold mb-1">Variant 1: Original Action</div>
                <div className="text-rift-text">Operation: {preview.original_preview.operation}</div>
                <div className="text-rift-muted mt-1">
                  Args: <code className="text-rose-700 font-bold">{JSON.stringify(preview.original_preview.arguments)}</code>
                </div>
                {preview.original_preview.affects_protected && (
                  <div className="text-rose-700 mt-2 text-[11px] flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3 h-3" /> Touches protected path:{' '}
                    {preview.original_preview.matching_protected_rule}
                  </div>
                )}
              </div>

              <div className="bg-rift-surface border border-emerald-200 rounded-xl p-3 shadow-sm">
                <div className="text-emerald-700 font-semibold mb-1">Variant 2: Counterfactual</div>
                <div className="text-rift-text">Operation: {preview.counterfactual_preview.operation}</div>
                <div className="text-rift-muted mt-1">
                  Args: <code className="text-emerald-700 font-bold">{JSON.stringify(preview.counterfactual_preview.arguments)}</code>
                </div>
                {!preview.counterfactual_preview.affects_protected ? (
                  <div className="text-emerald-700 mt-2 text-[11px] flex items-center gap-1 font-semibold">
                    <CheckCircle className="w-3 h-3" /> All paths within permitted bounds
                  </div>
                ) : (
                  <div className="text-amber-700 mt-2 text-[11px] flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3 h-3" /> Touches protected path
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sandbox Restrictions */}
          <div className="bg-rift-base/30 border border-rift-border rounded-2xl p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-rift-muted block mb-2 font-mono">
              Mandatory Sandbox Isolation Controls
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-rift-surface border border-rift-border rounded-xl p-2.5 shadow-sm">
                <div className="flex items-center gap-1 text-rift-muted mb-0.5">
                  <Network className="w-3 h-3 text-rift-accent" /> Network
                </div>
                <div className="font-semibold text-rift-text">none (offline)</div>
              </div>

              <div className="bg-rift-surface border border-rift-border rounded-xl p-2.5 shadow-sm">
                <div className="flex items-center gap-1 text-rift-muted mb-0.5">
                  <Lock className="w-3 h-3 text-rift-accent" /> Privilege
                </div>
                <div className="font-semibold text-rift-text">User: 10001:10001</div>
              </div>

              <div className="bg-rift-surface border border-rift-border rounded-xl p-2.5 shadow-sm">
                <div className="flex items-center gap-1 text-rift-muted mb-0.5">
                  <Cpu className="w-3 h-3 text-rift-accent" /> Resources
                </div>
                <div className="font-semibold text-rift-text">256MB / 1.0 CPU</div>
              </div>

              <div className="bg-rift-surface border border-rift-border rounded-xl p-2.5 shadow-sm">
                <div className="flex items-center gap-1 text-rift-muted mb-0.5">
                  <ShieldCheck className="w-3 h-3 text-rift-accent" /> Host Mounts
                </div>
                <div className="font-semibold text-emerald-700">Zero (Disposable)</div>
              </div>
            </div>
          </div>

          {/* Cleanup Guarantee */}
          <div className="text-xs text-rift-muted bg-rift-base/50 border border-rift-border rounded-xl p-3 flex items-center justify-between">
            <span>Automatic Post-Execution Cleanup:</span>
            <span className="text-emerald-700 font-semibold">Both scratch workspaces purged upon completion</span>
          </div>

          {/* Explicit Approval Control (Must NOT be prechecked!) */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={approvedByUser}
                onChange={(e) => setApprovedByUser(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-0 focus:ring-offset-0 bg-white"
              />
              <div className="text-xs">
                <span className="font-semibold text-amber-900 block">
                  I explicitly approve executing this counterfactual replay in an isolated disposable sandbox.
                </span>
                <span className="text-amber-800/80 mt-0.5 block leading-relaxed">
                  I understand that both the original failing action and the counterfactual correction will execute inside
                  isolated ephemeral scratch environments initialized from the fixture snapshot.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-rift-border bg-rift-base/40 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 border border-rift-border hover:bg-rift-base text-rift-text rounded-full text-xs font-medium transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmReplay}
            disabled={!approvedByUser || isExecuting}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
          >
            {isExecuting ? 'Executing Replay in Sandbox...' : 'Confirm & Execute Replay'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
