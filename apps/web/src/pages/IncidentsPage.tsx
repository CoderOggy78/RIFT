import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SeverityBadge } from '../components/common/SeverityBadge';
import { formatDateTime } from '../lib/utils';
import {
  AlertOctagon,
  Search,
  Filter,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  GitFork,
} from 'lucide-react';

export const IncidentsPage: React.FC = () => {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const [sortField, setSortField] = useState<'created_at' | 'severity' | 'detection_count'>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch summary metrics
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['detection-summary'],
    queryFn: api.getDetectionSummary,
    refetchInterval: 15000,
  });

  // Fetch incidents list
  const {
    data: incidents = [],
    isLoading: isIncidentsLoading,
    isError,
    error,
    refetch: refetchIncidents,
    isFetching,
  } = useQuery({
    queryKey: ['incidents', severityFilter, statusFilter, search, page],
    queryFn: () =>
      api.listIncidents({
        severity: severityFilter,
        status: statusFilter,
        search,
        offset: page * pageSize,
        limit: pageSize,
      }),
    refetchInterval: 15000,
  });

  const totalCount = summary?.total_incidents || incidents.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const sortedIncidents = React.useMemo(() => {
    return [...incidents].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'created_at') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      } else if (sortField === 'severity') {
        const order: Record<string, number> = {
          Critical: 5,
          High: 4,
          Medium: 3,
          Low: 2,
          Informational: 1,
        };
        valA = order[valA] || 0;
        valB = order[valB] || 0;
      } else {
        valA = valA ?? 0;
        valB = valB ?? 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [incidents, sortField, sortAsc]);

  const toggleSort = (field: 'created_at' | 'severity' | 'detection_count') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const refreshAll = () => {
    refetchSummary();
    refetchIncidents();
  };

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Incident Management</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
              Rule-Based Engine
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Deterministic anomalies, safety violations, and discrepancies detected across agent executions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshAll}
            disabled={isFetching}
            className="btn-secondary text-xs"
            title="Refresh incidents"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-rift-accent' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="card-antigravity p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Total Incidents
          </div>
          <div className="text-2xl font-mono font-bold text-gray-900 mt-1">
            {isSummaryLoading ? '—' : summary?.total_incidents ?? 0}
          </div>
        </div>

        <div className="card-antigravity p-4 bg-rose-50/40 border-rose-200">
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
            <span>Critical</span>
          </div>
          <div className="text-2xl font-mono font-bold text-rose-700 mt-1">
            {isSummaryLoading ? '—' : summary?.critical_incidents ?? 0}
          </div>
        </div>

        <div className="card-antigravity p-4 bg-amber-50/40 border-amber-200">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>High Severity</span>
          </div>
          <div className="text-2xl font-mono font-bold text-amber-700 mt-1">
            {isSummaryLoading ? '—' : summary?.high_incidents ?? 0}
          </div>
        </div>

        <div className="card-antigravity p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Open</span>
          </div>
          <div className="text-2xl font-mono font-bold text-amber-600 mt-1">
            {isSummaryLoading ? '—' : summary?.open_incidents ?? 0}
          </div>
        </div>

        <div className="card-antigravity p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Resolved</span>
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-700 mt-1">
            {isSummaryLoading ? '—' : summary?.resolved_incidents ?? 0}
          </div>
        </div>

        <div className="card-antigravity p-4">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <GitFork className="w-3.5 h-3.5 text-rift-accent" />
            <span>Traces Affected</span>
          </div>
          <div className="text-2xl font-mono font-bold text-rift-accent mt-1">
            {isSummaryLoading ? '—' : summary?.traces_with_incidents ?? 0}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by incident title, ID, agent, project, or event…"
            className="w-full bg-white border border-gray-200 rounded-full pl-10 pr-4 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono shadow-subtle"
          />
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 shadow-subtle">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(0);
            }}
            className="bg-transparent text-xs text-gray-700 focus:outline-none cursor-pointer font-medium"
          >
            <option value="all">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Informational">Informational</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3.5 py-1.5 shadow-subtle">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="bg-transparent text-xs text-gray-700 focus:outline-none cursor-pointer font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="card-antigravity overflow-hidden">
        {isIncidentsLoading ? (
          <div className="p-12 text-center text-xs text-gray-500">Loading incidents…</div>
        ) : isError ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-xs text-rose-600 font-medium">Failed to load incidents from API</p>
            <p className="text-[11px] text-gray-400 font-mono">{error?.message}</p>
          </div>
        ) : sortedIncidents.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <AlertOctagon className="w-10 h-10 text-gray-300 mx-auto" />
            <h4 className="text-sm font-medium text-gray-900">No incidents found</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {search || severityFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or filters.'
                : 'No incidents detected yet. Run detection on an ingested trace to identify suspicious agent behavior.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-mono text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-6">Incident ID</th>
                  <th className="py-3 px-4">Title</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-900 select-none"
                    onClick={() => toggleSort('severity')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Severity</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Agent / Project</th>
                  <th className="py-3 px-4">First Suspicious Event</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-900 select-none"
                    onClick={() => toggleSort('detection_count')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Detections</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th
                    className="py-3 px-4 cursor-pointer hover:text-gray-900 select-none"
                    onClick={() => toggleSort('created_at')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Detected At</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {sortedIncidents.map((incident) => (
                  <tr
                    key={incident.id}
                    onClick={() => navigate(`/incidents/${incident.id}`)}
                    className="hover:bg-blue-50/40 cursor-pointer transition group"
                  >
                    <td className="py-3.5 px-6 font-mono text-rift-accent font-medium">
                      {incident.id}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-900 max-w-xs">
                      <div className="line-clamp-2 leading-relaxed">{incident.title}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <SeverityBadge severity={incident.severity} size="sm" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-gray-900">{incident.agent_name}</div>
                      <div className="text-[11px] text-gray-500">{incident.project_name}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {incident.first_suspicious_event_id ? (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-gray-700">
                          {incident.first_suspicious_event_id}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Unknown</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[11px] border border-gray-200">
                        {incident.detection_count} rule{incident.detection_count !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border ${
                          incident.status === 'open'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : incident.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {incident.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-500 text-[11px]">
                      {formatDateTime(incident.created_at)}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <span className="text-xs font-semibold text-rift-accent group-hover:underline inline-flex items-center gap-1">
                        Investigate
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50/50 text-xs text-gray-500">
            <div>
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount} incidents
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-full hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-[11px] text-gray-700">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-full hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
