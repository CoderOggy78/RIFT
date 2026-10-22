import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { SystemDiagnostics, DiagnosticCheckItem } from '../../types';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  RefreshCw,
  Server,
  Database,
  Cpu,
  FileText,
  Clock,
  HardDrive,
  Info,
} from 'lucide-react';

export const SystemDiagnosticsCard: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: diagnostics,
    isLoading,
    refetch,
    isFetching,
  } = useQuery<SystemDiagnostics>({
    queryKey: ['system-diagnostics'],
    queryFn: () => api.getSystemDiagnostics(),
    refetchInterval: 30000,
  });

  const handleRunDiagnostics = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const getSubsystemIcon = (subsystem: string) => {
    switch (subsystem) {
      case 'api':
        return <Server className="w-4 h-4 text-blue-400" />;
      case 'database':
        return <Database className="w-4 h-4 text-emerald-400" />;
      case 'ollama':
        return <Cpu className="w-4 h-4 text-purple-400" />;
      case 'gemma':
        return <Activity className="w-4 h-4 text-purple-400" />;
      case 'replay':
        return <Shield className="w-4 h-4 text-amber-400" />;
      case 'reports':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      default:
        return <Activity className="w-4 h-4 text-rift-muted" />;
    }
  };

  const getStatusBadge = (status: DiagnosticCheckItem['status']) => {
    switch (status) {
      case 'operational':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Operational
          </span>
        );
      case 'degraded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Degraded
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Shield className="w-3 h-3" /> Protected / Offline
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3" /> Offline
          </span>
        );
    }
  };

  const hw = diagnostics?.hardware_summary;

  return (
    <div className="card-antigravity p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rift-border pb-4">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-emerald-600" />
          <span className="text-rift-text font-semibold text-sm">
            System Diagnostics & Infrastructure Health
          </span>
        </div>
        <button
          onClick={handleRunDiagnostics}
          disabled={isRefreshing || isFetching || isLoading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-800 transition disabled:opacity-50 shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isFetching ? 'animate-spin' : ''}`} />
          <span>{isRefreshing || isFetching ? 'Probing...' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {/* Overall Status Banner */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          diagnostics?.overall_status === 'operational'
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            : diagnostics?.overall_status === 'degraded'
            ? 'bg-amber-50/70 border-amber-200 text-amber-900'
            : 'bg-rose-50/70 border-rose-200 text-rose-900'
        }`}
      >
        <div className="flex items-center gap-3">
          {diagnostics?.overall_status === 'operational' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <div>
            <div className="font-semibold text-sm text-rift-text">
              {diagnostics?.overall_status === 'operational'
                ? 'Core Platform Services Operational'
                : 'Subsystem Warnings Detected'}
            </div>
            <div className="text-[11px] text-rift-muted mt-0.5 leading-relaxed">
              Live automated health checks verified against backend, SQLite, Ollama, and local Gemma inference.
            </div>
          </div>
        </div>

        {hw && (
          <div className="flex items-center gap-2 font-mono text-[11px] text-rift-muted bg-rift-surface px-3 py-1.5 rounded-full border border-rift-border shrink-0 shadow-2xs">
            <Cpu className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-rift-text font-medium">{hw.chip || 'Apple Silicon'}</span>
            <span>•</span>
            <span className="text-rift-text font-medium">{hw.memory_total_gb}GB Unified</span>
            <span>•</span>
            <span>{hw.disk_free_gb}GB free</span>
          </div>
        )}
      </div>

      {/* Subsystems Diagnostic Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {diagnostics?.checks.map((chk) => (
          <div
            key={chk.name}
            className="p-4 rounded-2xl border border-rift-border bg-rift-surface hover:border-rift-border-hover transition space-y-2.5 shadow-2xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {getSubsystemIcon(chk.subsystem)}
                <span className="font-semibold text-xs text-rift-text">{chk.name}</span>
              </div>
              {getStatusBadge(chk.status)}
            </div>

            <p className="text-[11px] text-rift-muted leading-relaxed font-sans">
              {chk.message}
            </p>

            {chk.latency_ms !== null && chk.latency_ms !== undefined && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-rift-muted">
                <Clock className="w-3 h-3 text-rift-muted" />
                <span>Probe latency: {chk.latency_ms}ms</span>
              </div>
            )}

            {chk.actionable_remediation && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                <div className="font-semibold flex items-center gap-1 mb-0.5 text-amber-700">
                  <Info className="w-3 h-3 text-amber-600" /> Remediation Notice:
                </div>
                <span>{chk.actionable_remediation}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
