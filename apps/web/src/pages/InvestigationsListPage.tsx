import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { formatDateTime, formatDuration } from '../lib/utils';
import { TraceSummary, Incident } from '../types';
import {
  SearchCode,
  Bot,
  Search,
  ArrowRight,
  Filter,
  Loader2,
  Clock,
  Sparkles,
  GitFork,
} from 'lucide-react';

export const InvestigationsListPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: traces = [], isLoading: isLoadingTraces } = useQuery<TraceSummary[]>({
    queryKey: ['traces'],
    queryFn: () => api.listTraces(),
  });

  const { data: incidents = [] } = useQuery<Incident[]>({
    queryKey: ['incidents'],
    queryFn: () => api.listIncidents(),
  });

  // Map incidents per trace
  const incidentMap = React.useMemo(() => {
    const map = new Map<string, { count: number; highestSeverity: string }>();
    for (const inc of incidents) {
      const existing = map.get(inc.trace_id);
      if (!existing) {
        map.set(inc.trace_id, { count: 1, highestSeverity: inc.severity });
      } else {
        existing.count += 1;
        const rank = ['critical', 'high', 'medium', 'low', 'info'];
        if (rank.indexOf(inc.severity.toLowerCase()) < rank.indexOf(existing.highestSeverity.toLowerCase())) {
          existing.highestSeverity = inc.severity;
        }
      }
    }
    return map;
  }, [incidents]);

  const filteredTraces = traces.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.agent_name.toLowerCase().includes(search.toLowerCase()) ||
      (t.objective && t.objective.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Feature Banner */}
      <div className="card-antigravity p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs text-rift-accent font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Investigation Workspace</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">
              Explore Agent Execution Graphs & Telemetry
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              Inspect agent reasoning chains, tool invocations, validation checks, and state mutations in a high-density DAG. Deep dive into deterministic incident citations and compare original intent against observed execution.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 font-mono text-center min-w-[100px]">
              <div className="text-xl font-bold text-gray-900">{traces.length}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Traces Ingested</div>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 font-mono text-center min-w-[100px]">
              <div className="text-xl font-bold text-rose-700">{incidents.length}</div>
              <div className="text-[10px] text-rose-600 uppercase tracking-wider mt-0.5">Active Incidents</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Trace ID, Agent, or Objective..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-4 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-subtle"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex items-center p-0.5 rounded-full bg-white border border-gray-200 text-xs shadow-subtle">
            {['all', 'error', 'running', 'completed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full capitalize font-medium transition ${
                  statusFilter === status
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Traces List Table */}
      {isLoadingTraces ? (
        <div className="p-12 text-center text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-rift-accent mx-auto mb-2" />
          <p className="text-xs">Loading ingested execution traces...</p>
        </div>
      ) : filteredTraces.length === 0 ? (
        <div className="p-16 text-center card-antigravity">
          <SearchCode className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">No traces found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search query or status filter.'
              : 'Import a trace fixture from the top navigation to begin investigating.'}
          </p>
        </div>
      ) : (
        <div className="card-antigravity overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredTraces.map((trace) => {
              const incInfo = incidentMap.get(trace.id);
              return (
                <div
                  key={trace.id}
                  className="p-5 hover:bg-blue-50/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-rift-accent">
                        {trace.id}
                      </span>
                      <span className="text-gray-300">|</span>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Bot className="w-3.5 h-3.5 text-rift-accent" />
                        <span className="text-gray-900 font-medium">{trace.agent_name}</span>
                      </div>
                      <StatusBadge status={trace.status} size="sm" />

                      {incInfo && (
                        <div className="flex items-center gap-1.5">
                          <SeverityBadge severity={incInfo.highestSeverity} size="sm" />
                          <span className="text-[11px] font-mono text-rose-700 font-medium">
                            {incInfo.count} {incInfo.count === 1 ? 'incident' : 'incidents'}
                          </span>
                        </div>
                      )}
                    </div>

                    {trace.objective && (
                      <p className="text-xs text-gray-600 line-clamp-1">
                        Objective: <span className="text-gray-900 font-medium">{trace.objective}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] font-mono text-gray-500">
                      <span>{trace.span_count} Spans</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {formatDuration(trace.duration_ms)}
                      </span>
                      <span>•</span>
                      <span>Started {formatDateTime(trace.started_at)}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Link
                      to={`/investigations/${trace.id}`}
                      className="btn-primary text-xs"
                    >
                      <SearchCode className="w-4 h-4" />
                      <span>Launch Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
