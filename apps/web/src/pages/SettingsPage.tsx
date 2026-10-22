import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ModelTestResult } from '../types';
import { Server, Database, Cpu, Shield, RefreshCw } from 'lucide-react';
import { ModelConfigurationPanel } from '../components/settings/ModelConfigurationPanel';
import { SystemDiagnosticsCard } from '../components/settings/SystemDiagnosticsCard';
import { CodebaseKnowledgeCard } from '../components/settings/CodebaseKnowledgeCard';

export const SettingsPage: React.FC = () => {
  const [modelTestResult, setModelTestResult] = useState<ModelTestResult | null>(null);
  const [isTestingModel, setIsTestingModel] = useState(false);

  const { data: health, refetch: refetchHealth, isFetching: isHealthFetching } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
  });

  const { data: systemStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: api.getSystemStatus,
  });

  const { data: modelStatus, refetch: refetchModel, isFetching: isModelFetching } = useQuery({
    queryKey: ['model-status'],
    queryFn: api.getModelStatus,
  });

  const handleRefreshAll = () => {
    refetchHealth();
    refetchStatus();
    refetchModel();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-150">
      <div className="flex items-center justify-between pb-4 border-b border-rift-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-rift-text">Platform Settings</h2>
          <p className="text-xs text-rift-muted mt-0.5">
            System configuration, database connectivity, and Gemma inference status
          </p>
        </div>

        <button
          onClick={handleRefreshAll}
          disabled={isHealthFetching || isModelFetching}
          className="btn-secondary text-xs flex items-center gap-1.5 shadow-2xs"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isHealthFetching || isModelFetching ? 'animate-spin' : ''}`}
          />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Backend & Database */}
      <div className="card-antigravity p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-rift-text font-semibold text-sm">
          <Database className="w-4 h-4 text-blue-600" />
          <span>Storage & API Service</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border space-y-1">
            <span className="text-rift-muted text-[11px] block font-sans">API Status</span>
            <span className="text-emerald-700 font-semibold font-mono">
              {health?.status ? health.status.toUpperCase() : 'CHECKING...'}
            </span>
          </div>

          <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border space-y-1">
            <span className="text-rift-muted text-[11px] block font-sans">Database Dialect</span>
            <span className="text-rift-text font-mono font-medium">SQLite (Persistent)</span>
          </div>

          <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border space-y-1">
            <span className="text-rift-muted text-[11px] block font-sans">Database Path</span>
            <span className="text-rift-muted truncate block font-mono">./rift.db</span>
          </div>

          <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border space-y-1">
            <span className="text-rift-muted text-[11px] block font-sans">Platform Version</span>
            <span className="text-rift-text font-mono font-medium">v{health?.version || '0.1.0'}</span>
          </div>
        </div>
      </div>

      {/* System Diagnostics & Subsystem Health */}
      <SystemDiagnosticsCard />

      {/* Codebase Knowledge (Graphify) Status & Controls */}
      <CodebaseKnowledgeCard />

      {/* Gemma 4 & Hardware Configuration Panel */}
      <ModelConfigurationPanel
        modelStatus={modelStatus}
        refetchModel={refetchModel}
        isModelFetching={isModelFetching}
      />

      {/* Security & Isolation */}
      <div className="card-antigravity p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-rift-text font-semibold text-sm">
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Security & Trace Ingestion Perimeter</span>
        </div>

        <ul className="text-xs text-rift-muted space-y-2">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
            <span className="text-rift-text">Trace inputs treated as untrusted strings — no dynamic eval or code execution</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
            <span className="text-rift-text">Automatic regex redaction for Bearer tokens, OpenAI keys, and passwords</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
            <span className="text-rift-text">Cycle detection and parent-child hierarchy validation enforced on ingestion</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
