import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatDateTime, formatDuration } from '../lib/utils';
import {
  Search,
  Filter,
  Upload,
  ArrowUpDown,
  GitFork,
  RefreshCw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const TracesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { onOpenImport } = useOutletContext<{ onOpenImport: () => void }>();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState<'started_at' | 'duration_ms' | 'span_count'>('started_at');
  const [sortAsc, setSortAsc] = useState(false);

  const { data: traces, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['traces', statusFilter, search],
    queryFn: () => api.listTraces({ status: statusFilter, search }),
    refetchInterval: 10000,
  });

  const loadDemoMutation = useMutation({
    mutationFn: api.loadSyntheticDemo,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
      navigate(`/investigations/${res.trace_id}`);
    },
  });

  const sortedTraces = React.useMemo(() => {
    if (!traces) return [];
    return [...traces].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'started_at') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else {
        valA = valA ?? 0;
        valB = valB ?? 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [traces, sortField, sortAsc]);

  const toggleSort = (field: 'started_at' | 'duration_ms' | 'span_count') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-gray-900">Execution Traces</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Immutable telemetry traces recorded from autonomous agents
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 border border-gray-200 transition"
            title="Refresh traces"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenImport}
            className="btn-primary"
          >
            <Upload className="w-4 h-4" />
            <span>Import Trace</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by trace ID, agent, objective, or project…"
            className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-4 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono transition shadow-subtle"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 shadow-subtle">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-xs text-gray-700 focus:outline-none cursor-pointer font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="error">Error / Failed</option>
            <option value="success">Success / Completed</option>
            <option value="running">Running</option>
          </select>
        </div>
      </div>

      {/* Main Technical Table */}
      <div className="card-antigravity overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-500 font-mono">Loading traces…</div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-xs text-rose-600 font-medium">Failed to load traces from API</p>
            <p className="text-[11px] text-gray-400 font-mono">{error?.message}</p>
          </div>
        ) : sortedTraces.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <GitFork className="w-10 h-10 text-gray-300 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-gray-900">No traces yet</h4>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                No traces yet. Import an execution trace or explore the demo.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={onOpenImport}
                className="btn-primary"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Trace</span>
              </button>
              <button
                onClick={() => loadDemoMutation.mutate()}
                disabled={loadDemoMutation.isPending}
                className="btn-secondary"
              >
                <Sparkles className="w-3.5 h-3.5 text-rift-accent" />
                <span>Explore Demo</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-mono text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Trace</th>
                  <th className="py-3 px-4">Agent</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-900 select-none"
                    onClick={() => toggleSort('started_at')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Started</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-900 select-none"
                    onClick={() => toggleSort('duration_ms')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Duration</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Incidents</th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {sortedTraces.map((trace) => (
                  <tr
                    key={trace.id}
                    onClick={() => navigate(`/investigations/${trace.id}`)}
                    className="hover:bg-blue-50/40 cursor-pointer transition group"
                  >
                    <td className="py-3.5 px-6 font-mono text-rift-accent font-medium">
                      <div className="flex items-center gap-2">
                        <span>{trace.id}</span>
                        {trace.id === 'trace-accidental-deletion-001' && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            DEMO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 font-sans font-normal line-clamp-1 max-w-sm mt-0.5">
                        {trace.objective}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-gray-900">{trace.agent_name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">{trace.project_name}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-500 text-[11px]">
                      {formatDateTime(trace.started_at)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-500 text-[11px]">
                      {formatDuration(trace.duration_ms)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={trace.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      {trace.incident_count && trace.incident_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-medium">
                          {trace.incident_count} detected
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="text-xs font-semibold text-rift-accent group-hover:underline inline-flex items-center gap-1">
                        Inspect
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
