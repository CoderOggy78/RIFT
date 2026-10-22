import React, { useState } from 'react';
import { X, Copy, Check, Download, FileCode } from 'lucide-react';
import { Replay } from '../../types';

interface ReplayAuditManifestModalProps {
  isOpen: boolean;
  onClose: () => void;
  replay: Replay | null;
}

export const ReplayAuditManifestModal: React.FC<ReplayAuditManifestModalProps> = ({
  isOpen,
  onClose,
  replay,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !replay) return null;

  const manifest = {
    schema_version: '1.0.0',
    replay_id: replay.id,
    incident_id: replay.incident_id,
    original_event_id: replay.original_event_id,
    fixture_id: replay.fixture_id,
    status: replay.status,
    approved_by_user: replay.approved_by_user,
    approved_at: replay.approved_at,
    started_at: replay.started_at,
    completed_at: replay.completed_at,
    variants: replay.variants.map((v) => ({
      variant_type: v.variant_type,
      operation_type: v.operation_type,
      arguments: v.validated_arguments,
      execution_status: v.execution_status,
      validation_status: v.validation_status,
      duration_ms: v.duration_ms,
    })),
    comparison: replay.comparison
      ? {
          conclusion: replay.comparison.conclusion,
          original_validation: replay.comparison.original_validation_status,
          counterfactual_validation: replay.comparison.counterfactual_validation_status,
          removed_files: replay.comparison.removed_files,
          changed_files: replay.comparison.changed_files,
        }
      : null,
  };

  const manifestString = JSON.stringify(manifest, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(manifestString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([manifestString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay_manifest_${replay.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-rift-text/30 backdrop-blur-xs animate-fadeIn">
      <div className="bg-rift-surface border border-rift-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-rift-border flex items-center justify-between bg-rift-base/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rift-accent/10 border border-rift-accent/20 text-rift-accent">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-rift-text text-sm">Machine-Readable Audit Manifest</h3>
              <p className="text-xs text-rift-muted font-mono">Replay: {replay.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-rift-muted hover:text-rift-text transition-colors p-1 rounded-lg hover:bg-rift-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* JSON Preview */}
        <div className="p-6 overflow-y-auto flex-1 bg-rift-base/40 font-mono text-xs">
          <pre className="text-xs font-mono text-rift-text whitespace-pre-wrap selection:bg-rift-accent/20">
            {manifestString}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-rift-border bg-rift-base/40 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="px-4 py-1.5 bg-rift-surface hover:bg-rift-elevated text-rift-text rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors border border-rift-border shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-rift-muted" />}
            {copied ? 'Copied to Clipboard' : 'Copy JSON'}
          </button>

          <button
            onClick={handleDownload}
            className="px-4 py-1.5 bg-rift-accent hover:bg-rift-accent/90 text-white rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Download Manifest
          </button>
        </div>
      </div>
    </div>
  );
};
