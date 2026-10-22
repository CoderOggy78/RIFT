import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Compass,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCode,
  Layers,
  GitFork,
  Terminal,
  ShieldCheck,
  Search,
  Check,
} from 'lucide-react';

export const CodebaseKnowledgeCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [testQuery, setTestQuery] = useState('TraceContext');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);

  const {
    data: status,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['code-knowledge-status'],
    queryFn: api.getCodeKnowledgeStatus,
  });

  const refreshMutation = useMutation({
    mutationFn: api.refreshCodeKnowledge,
    onSuccess: (data) => {
      setShowRefreshConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['code-knowledge-status'] });
    },
  });

  const handleTestQuery = async () => {
    if (!testQuery.trim()) return;
    try {
      setIsTesting(true);
      setTestResult(null);
      const res = await api.queryCodeKnowledge(testQuery.trim());
      setTestResult(
        `✓ Found ${res.nodes.length} nodes and ${res.edges.length} edges in ${res.duration_ms || 0}ms.`
      );
    } catch (err: any) {
      setTestResult(`✗ Query failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusDisplay = () => {
    if (isLoading) {
      return {
        badge: (
          <span className="badge-status badge-neutral">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Checking...
          </span>
        ),
        color: 'text-gray-500',
        label: 'Checking status...',
      };
    }

    if (!status) {
      return {
        badge: (
          <span className="badge-status badge-error">
            <XCircle className="w-3.5 h-3.5" />
            Unreachable
          </span>
        ),
        color: 'text-rose-600',
        label: 'API Unavailable',
      };
    }

    switch (status.status) {
      case 'ready':
        return {
          badge: (
            <span className="badge-status badge-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ready
            </span>
          ),
          color: 'text-emerald-700',
          label: 'Graph Ready & Verified',
        };
      case 'disabled':
        return {
          badge: (
            <span className="badge-status badge-neutral">
              <XCircle className="w-3.5 h-3.5" />
              Disabled
            </span>
          ),
          color: 'text-gray-600',
          label: 'Disabled in Config',
        };
      case 'not_installed':
        return {
          badge: (
            <span className="badge-status badge-amber">
              <AlertTriangle className="w-3.5 h-3.5" />
              Not Installed
            </span>
          ),
          color: 'text-amber-700',
          label: 'CLI Missing',
        };
      case 'graph_not_generated':
        return {
          badge: (
            <span className="badge-status badge-amber">
              <AlertTriangle className="w-3.5 h-3.5" />
              Not Generated
            </span>
          ),
          color: 'text-amber-700',
          label: 'No Graph Found',
        };
      case 'updating':
        return {
          badge: (
            <span className="badge-status badge-info">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Updating
            </span>
          ),
          color: 'text-blue-700',
          label: 'Extracting AST...',
        };
      default:
        return {
          badge: (
            <span className="badge-status badge-error">
              <XCircle className="w-3.5 h-3.5" />
              Error
            </span>
          ),
          color: 'text-rose-700',
          label: 'Malformed / Error',
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="card-antigravity p-6 space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-rift-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-rift-text">
              Codebase Knowledge (Graphify)
            </h3>
            <p className="text-[11px] text-rift-muted font-mono">
              Optional AST static knowledge graph · Zero vector embeddings · Local tree-sitter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {statusDisplay.badge}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary text-xs p-1.5"
            title="Check availability"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Real Verified Telemetry & Coordinates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
        <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border space-y-1">
          <span className="text-rift-muted text-[11px] block font-sans">Graphify CLI</span>
          <span className="text-rift-text font-medium block truncate">
            {status?.graphify_version ? `v${status.graphify_version}` : 'Not detected'}
          </span>
        </div>

        <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border space-y-1">
          <span className="text-rift-muted text-[11px] block font-sans">AST Entities</span>
          <span className="text-rift-text font-medium block">
            {status?.status === 'ready' ? `${status.node_count} nodes · ${status.edge_count} edges` : 'N/A'}
          </span>
        </div>

        <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border space-y-1">
          <span className="text-rift-muted text-[11px] block font-sans">Last Updated</span>
          <span className="text-rift-text font-medium block truncate">
            {status?.last_updated_at ? new Date(status.last_updated_at).toLocaleTimeString() : 'Never'}
          </span>
        </div>
      </div>

      {/* Path & Status Message */}
      <div className="p-3 bg-[#F8F9FA] rounded-xl border border-gray-200 text-xs font-mono space-y-1">
        <div className="flex items-center justify-between text-gray-500 text-[11px] font-sans">
          <span>Graph Artifact Path</span>
          <span>Schema v{status?.schema_version || 1}</span>
        </div>
        <p className="text-gray-900 truncate">
          {status?.graph_path || './graphify-out/graph.json'}
        </p>
        <p className="text-[11px] text-gray-500 pt-1 font-sans">
          {status?.message}
        </p>
      </div>

      {/* Safe Test Query Bar */}
      {status?.status === 'ready' && (
        <div className="space-y-2 pt-1 border-t border-rift-border">
          <span className="text-xs font-semibold text-rift-text block">
            Test AST Symbol Query
          </span>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                placeholder="Query symbol (e.g. TraceContext, DetectionEngine)..."
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleTestQuery}
              disabled={isTesting || !testQuery.trim()}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {isTesting ? 'Querying...' : 'Query AST'}
            </button>
          </div>
          {testResult && (
            <p className="text-[11px] font-mono text-gray-600 pl-1">
              {testResult}
            </p>
          )}
        </div>
      )}

      {/* Actions & Safety Guards */}
      <div className="flex items-center justify-between pt-2 border-t border-rift-border text-xs">
        <span className="text-rift-muted flex items-center gap-1.5 text-[11px]">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Code-only extraction &middot; Strict bounded subprocess timeouts</span>
        </span>

        {showRefreshConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-700 font-medium">Rebuild AST graph now?</span>
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="btn-primary text-xs py-1 px-2.5 bg-rose-600 hover:bg-rose-700 border-none"
            >
              {refreshMutation.isPending ? 'Rebuilding...' : 'Confirm'}
            </button>
            <button
              onClick={() => setShowRefreshConfirm(false)}
              className="btn-secondary text-xs py-1 px-2.5"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowRefreshConfirm(true)}
            disabled={status?.status === 'disabled' || refreshMutation.isPending}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            <span>Regenerate Graph</span>
          </button>
        )}
      </div>
    </div>
  );
};
