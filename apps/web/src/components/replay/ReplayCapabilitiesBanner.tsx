import React from 'react';
import { ShieldCheck, ShieldAlert, Cpu, Network, Lock, Terminal } from 'lucide-react';
import { ReplayCapabilities } from '../../types';

interface ReplayCapabilitiesBannerProps {
  capabilities?: ReplayCapabilities | null;
  isLoading?: boolean;
}

export const ReplayCapabilitiesBanner: React.FC<ReplayCapabilitiesBannerProps> = ({
  capabilities,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="card-antigravity p-4 animate-pulse">
        <div className="h-4 bg-rift-elevated rounded w-1/3 mb-2" />
        <div className="h-3 bg-rift-elevated rounded w-2/3" />
      </div>
    );
  }

  const isAvailable = capabilities?.available ?? false;

  return (
    <div
      className={`rounded-2xl border p-5 transition-all ${
        isAvailable
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 shadow-sm'
          : 'bg-amber-50/70 border-amber-200 text-amber-900 shadow-sm'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`p-2.5 rounded-xl border mt-0.5 ${
              isAvailable
                ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                : 'bg-amber-100 border-amber-300 text-amber-700'
            }`}
          >
            {isAvailable ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-rift-text text-base">
                {isAvailable ? 'Secure Container Sandbox Active' : 'Secure replay is unavailable in this environment.'}
              </h3>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium border ${
                  isAvailable
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}
              >
                Runtime: {capabilities?.runtime?.toUpperCase() || 'NONE'}
              </span>
            </div>
            <p className="text-xs text-rift-muted mt-1 max-w-2xl leading-relaxed">
              {isAvailable
                ? 'Disposable Docker container isolation verified. Untrusted agent actions execute in network-less, unprivileged containers.'
                : capabilities?.reason ||
                  'Docker runtime not detected. In accordance with RIFT security architecture, replay cannot execute directly on the host.'}
            </p>

            {!isAvailable && capabilities?.setup_instructions && (
              <div className="mt-3 bg-rift-surface border border-amber-200 rounded-xl p-3 text-xs font-mono text-rift-text flex items-start gap-2 shadow-sm">
                <Terminal className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <pre className="whitespace-pre-wrap">{capabilities.setup_instructions}</pre>
              </div>
            )}
          </div>
        </div>

        {/* Security badges */}
        <div className="flex flex-wrap md:flex-col gap-2 text-xs text-rift-muted shrink-0 border-t md:border-t-0 md:border-l border-rift-border pt-3 md:pt-0 md:pl-4">
          <div className="flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5 text-rift-muted" />
            <span>Network: <strong className="text-rift-text font-semibold">Isolated (none)</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-rift-muted" />
            <span>Privileges: <strong className="text-rift-text font-semibold">Non-Root (10001)</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-rift-muted" />
            <span>Memory Limit: <strong className="text-rift-text font-semibold">256 MB</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
