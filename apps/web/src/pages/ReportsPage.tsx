import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ReportItem } from '../types';
import {
  FileText,
  Download,
  Search,
  ExternalLink,
  Shield,
  Activity,
  Clock,
  Sparkles,
  AlertTriangle,
  FileCode,
  CheckCircle2,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: reports, isLoading, isError } = useQuery<ReportItem[]>({
    queryKey: ['reports'],
    queryFn: api.getReports,
  });

  const handleExport = async (investigationId: string, format: 'markdown' | 'json', filenamePrefix: string) => {
    try {
      setDownloadingId(`${investigationId}-${format}`);
      const blob = await api.exportReport(investigationId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenamePrefix}.${format === 'markdown' ? 'md' : 'json'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export report:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredReports = reports?.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.incident_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.trace_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity =
      severityFilter === 'all' || item.severity.toLowerCase() === severityFilter.toLowerCase();

    return matchesSearch && matchesSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    const s = severity.toLowerCase();
    if (s === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3 h-3" /> CRITICAL
        </span>
      );
    }
    if (s === 'high') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> HIGH
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <Activity className="w-3 h-3" /> {severity.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rift-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-rift-text flex items-center gap-2">
            <FileText className="w-5 h-5 text-rift-accent" />
            <span>Technical Incident Reports</span>
          </h2>
          <p className="text-xs text-rift-muted mt-1 leading-relaxed">
            Verified post-mortem incident documentation, Gemma 4 causal analysis, and replay verification archives
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-rift-base border border-rift-border text-rift-text font-semibold shadow-2xs">
            {reports ? `${reports.length} report${reports.length === 1 ? '' : 's'}` : 'Loading...'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-rift-surface p-3 rounded-2xl border border-rift-border shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-rift-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search reports by incident, model, trace ID, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-rift-base/40 border border-rift-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-rift-text placeholder:text-rift-muted focus:outline-none focus:border-rift-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-rift-muted font-mono">Severity:</span>
          {['all', 'critical', 'high', 'medium'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1 rounded-full text-[11px] font-mono transition capitalize ${
                severityFilter === sev
                  ? 'bg-rift-accent text-white font-semibold shadow-2xs'
                  : 'bg-rift-base text-rift-muted hover:text-rift-text border border-rift-border'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="p-12 text-center card-antigravity text-rift-muted space-y-3">
          <Activity className="w-6 h-6 text-rift-accent mx-auto animate-spin" />
          <p className="text-xs">Loading incident reports...</p>
        </div>
      ) : isError ? (
        <div className="p-8 text-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 text-xs">
          Failed to fetch incident reports. Verify FastAPI backend is running.
        </div>
      ) : filteredReports && filteredReports.length > 0 ? (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <div
              key={report.investigation_id}
              className="card-antigravity p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rift-border pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getSeverityBadge(report.severity)}
                    <span className="font-bold text-sm text-rift-text">{report.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-rift-muted">
                    <span>Incident: <strong className="text-rift-text">{report.incident_id}</strong></span>
                    <span>•</span>
                    <span>Investigation: {report.investigation_id}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(report.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      handleExport(
                        report.investigation_id,
                        'markdown',
                        `rift-report-${report.incident_id}`
                      )
                    }
                    disabled={downloadingId === `${report.investigation_id}-markdown`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-rift-border bg-rift-surface hover:bg-rift-base text-xs font-semibold text-rift-text transition shadow-2xs"
                    title="Download GitHub-Flavored Markdown Report"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    <span>
                      {downloadingId === `${report.investigation_id}-markdown`
                        ? 'Exporting...'
                        : 'Markdown (.md)'}
                    </span>
                  </button>

                  <button
                    onClick={() =>
                      handleExport(
                        report.investigation_id,
                        'json',
                        `rift-report-${report.incident_id}`
                      )
                    }
                    disabled={downloadingId === `${report.investigation_id}-json`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-rift-border bg-rift-surface hover:bg-rift-base text-xs font-semibold text-rift-text transition shadow-2xs"
                    title="Download Machine-Readable JSON Schema"
                  >
                    <FileCode className="w-3.5 h-3.5 text-purple-600" />
                    <span>
                      {downloadingId === `${report.investigation_id}-json`
                        ? 'Exporting...'
                        : 'JSON (.json)'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Summary and Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rift-text">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Investigation Conclusion</span>
                  </div>
                  <div className="bg-rift-base/40 p-3.5 rounded-xl border border-rift-border font-mono text-xs text-rift-muted space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-rift-text font-semibold">Status:</span>
                      <span className="text-emerald-700 font-bold uppercase">{report.status}</span>
                      {report.conclusion_status && (
                        <span className="text-rift-muted">({report.conclusion_status})</span>
                      )}
                    </div>
                    {report.duration_ms && (
                      <div className="text-[11px] text-rift-muted">
                        Inference Latency: {(report.duration_ms / 1000).toFixed(1)}s ({report.duration_ms}ms)
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 font-mono text-[11px] bg-rift-base/30 p-3.5 rounded-xl border border-rift-border flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-rift-muted">
                      <span>Model:</span>
                      <span className="text-purple-700 font-semibold">{report.model_name}</span>
                    </div>
                    <div className="flex items-center justify-between text-rift-muted">
                      <span>Evidence Spans:</span>
                      <span className="text-emerald-700 font-semibold">{report.evidence_count} cited</span>
                    </div>
                    <div className="flex items-center justify-between text-rift-muted">
                      <span>Sandbox Replay:</span>
                      <span className={report.has_replay ? 'text-blue-700 font-semibold' : 'text-rift-muted'}>
                        {report.has_replay ? 'Included' : 'None'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-rift-border flex items-center justify-between text-[10px]">
                    <Link
                      to={`/investigations/${report.trace_id}`}
                      className="text-rift-accent font-semibold hover:underline flex items-center gap-1"
                    >
                      <span>Workspace</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                    <Link
                      to={`/incidents/${report.incident_id}`}
                      className="text-rift-muted hover:text-rift-text flex items-center gap-1"
                    >
                      <span>Incident Details</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-12 text-center rounded-xl border border-dashed border-rift-border bg-rift-surface space-y-4">
          <FileText className="w-8 h-8 text-rift-muted mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-rift-text">No Incident Reports Generated Yet</h3>
            <p className="text-xs text-rift-muted max-w-md mx-auto">
              Reports are automatically generated when an incident investigation is completed using local Gemma 4.
            </p>
          </div>
          <div className="pt-2">
            <Link
              to="/investigations"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rift-accent text-white text-xs font-semibold hover:bg-rift-accent/90 transition shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Go to Investigation Workspace</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
