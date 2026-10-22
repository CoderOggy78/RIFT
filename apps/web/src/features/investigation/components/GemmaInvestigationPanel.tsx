import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  Investigation,
  InvestigationDetail,
  HypothesisItem,
  InvestigationEvidenceItem,
  RemediationItem,
  ModelStatus,
} from '../../../types';
import { formatDateTime, formatDuration } from '../../../lib/utils';
import {
  Sparkles,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Download,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Activity,
  Layers,
  FileText,
  Info,
  RotateCcw,
} from 'lucide-react';

interface GemmaInvestigationPanelProps {
  incidentId: string;
  traceId: string;
  incidentTitle?: string;
  incidentSeverity?: string;
  onNavigateToEvent?: (eventId: string) => void;
}

export const GemmaInvestigationPanel: React.FC<GemmaInvestigationPanelProps> = ({
  incidentId,
  traceId,
  incidentTitle,
  incidentSeverity,
  onNavigateToEvent,
}) => {
  const queryClient = useQueryClient();
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [expandedHypotheses, setExpandedHypotheses] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'hypotheses' | 'evidence_matrix' | 'remediation'>('hypotheses');
  const [setupError, setSetupError] = useState<{ message: string; instructions?: string | null } | null>(null);

  // Check model status
  const { data: modelStatus, refetch: refetchModelStatus } = useQuery<ModelStatus>({
    queryKey: ['model-status'],
    queryFn: () => api.getModelStatus(),
  });

  // Fetch list of investigations for this incident
  const {
    data: investigations = [],
    isLoading: isLoadingList,
    refetch: refetchList,
  } = useQuery<Investigation[]>({
    queryKey: ['incident-investigations', incidentId],
    queryFn: () => api.getIncidentInvestigations(incidentId),
    enabled: !!incidentId,
  });

  // Select the latest investigation by default
  useEffect(() => {
    if (investigations.length > 0 && !selectedInvestigationId) {
      setSelectedInvestigationId(investigations[0].id);
    }
  }, [investigations, selectedInvestigationId]);

  // Fetch full details of selected investigation
  const {
    data: investigationDetail,
    isLoading: isLoadingDetail,
    refetch: refetchDetail,
  } = useQuery<InvestigationDetail>({
    queryKey: ['investigation-detail', selectedInvestigationId],
    queryFn: () => (selectedInvestigationId ? api.getInvestigationDetail(selectedInvestigationId) : Promise.reject('No ID')),
    enabled: !!selectedInvestigationId,
  });

  // Active investigation: either detail or summary from list
  const activeInvestigation = investigationDetail || investigations.find((inv) => inv.id === selectedInvestigationId);

  // Poll investigation status if running or queued
  const isJobRunning = activeInvestigation?.status === 'queued' || activeInvestigation?.status === 'running';

  useEffect(() => {
    if (!isJobRunning || !selectedInvestigationId) return;

    const interval = setInterval(async () => {
      try {
        const statusData = await api.getInvestigationStatus(selectedInvestigationId);
        if (statusData.status === 'completed' || statusData.status === 'failed' || statusData.status === 'cancelled') {
          queryClient.invalidateQueries({ queryKey: ['incident-investigations', incidentId] });
          queryClient.invalidateQueries({ queryKey: ['investigation-detail', selectedInvestigationId] });
        }
      } catch (err) {
        console.error('Error polling investigation status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isJobRunning, selectedInvestigationId, incidentId, queryClient]);

  // Trigger Investigation Mutation
  const investigateMutation = useMutation({
    mutationFn: () => api.triggerInvestigation(incidentId),
    onSuccess: (newInv) => {
      setSetupError(null);
      setSelectedInvestigationId(newInv.id);
      queryClient.invalidateQueries({ queryKey: ['incident-investigations', incidentId] });
    },
    onError: (err: any) => {
      const errorData = err?.data?.detail;
      if (typeof errorData === 'object' && errorData !== null) {
        setSetupError({
          message: errorData.message || 'Model service unavailable.',
          instructions: errorData.setup_instructions,
        });
      } else {
        setSetupError({
          message: err?.message || 'Failed to start investigation.',
          instructions: `Ensure Ollama is running (\`ollama serve\`) and the configured Gemma model is available (\`ollama pull ${modelStatus?.configured_model || 'gemma4:e2b'}\`).`,
        });
      }
    },
  });

  const toggleHypothesis = (id: string) => {
    setExpandedHypotheses((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const handleExportReport = () => {
    if (!activeInvestigation) return;

    const report = `# RIFT Incident Investigation Report
**Generated by Google Gemma (${activeInvestigation.model_name})**
**Prompt Version:** ${activeInvestigation.prompt_version}
**Incident ID:** ${incidentId}
**Trace ID:** ${traceId}
**Investigation ID:** ${activeInvestigation.id}
**Status:** ${activeInvestigation.status.toUpperCase()} (${activeInvestigation.conclusion_status || 'N/A'})
**Inference Latency:** ${activeInvestigation.duration_ms ? `${activeInvestigation.duration_ms}ms` : 'N/A'}
**Generated At:** ${formatDateTime(activeInvestigation.created_at)}

---

## 1. Executive Summary
${activeInvestigation.summary || 'No summary available.'}

### Observed Failure
${activeInvestigation.observed_failure || 'N/A'}

### First Suspicious Telemetry Event
${activeInvestigation.first_suspicious_event_id || 'None identified'}

---

## 2. Root-Cause Hypotheses
${
  investigationDetail?.hypotheses?.length
    ? investigationDetail.hypotheses
        .map(
          (h, i) => `### Hypothesis ${i + 1}: ${h.title}
- **Confidence:** ${h.confidence_level.toUpperCase()}
- **Verification Status:** ${h.verification_status.toUpperCase()}
- **Explanation:** ${h.explanation}
- **Supporting Events:** ${h.evidence.filter((e) => e.relationship === 'supporting').map((e) => e.event_id).join(', ') || 'None'}
- **Contradicting Events:** ${h.evidence.filter((e) => e.relationship === 'contradicting').map((e) => e.event_id).join(', ') || 'None'}
- **Missing Evidence:** ${h.missing_evidence?.join('; ') || 'None reported'}
- **Suggested Verification:** ${h.suggested_check || 'N/A'}
`
        )
        .join('\n')
    : 'No hypotheses generated.'
}

---

## 3. Remediation Suggestions (Informational Only)
${
  investigationDetail?.remediation_suggestions?.length
    ? investigationDetail.remediation_suggestions
        .map(
          (r, i) => `### Remediation ${i + 1}: ${r.description}
- **Risk Level:** ${r.risk_level.toUpperCase()}
- **Requires Human Approval:** ${r.requires_human_approval ? 'YES' : 'NO'}
- **Rationale:** ${r.rationale || 'N/A'}
- **Verification Method:** ${r.verification_method || 'N/A'}
`
        )
        .join('\n')
    : 'No remediation actions suggested.'
}

---
*Notice: Remediation actions are generated for human review and have not been executed automatically.*
`;

    try {
      navigator.clipboard?.writeText(report);
    } catch {
      // clipboard write might be blocked in some contexts
    }

    try {
      const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rift-investigation-${incidentId}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to trigger download:', err);
    }

    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const [downloadingJson, setDownloadingJson] = useState(false);
  const handleExportJson = async () => {
    if (!activeInvestigation) return;
    try {
      setDownloadingJson(true);
      const blob = await api.exportReport(activeInvestigation.id, 'json');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rift-investigation-${incidentId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to trigger JSON export:', err);
    } finally {
      setDownloadingJson(false);
    }
  };

  const isModelReady = modelStatus?.status === 'ready' || modelStatus?.status === 'connected';

  return (
    <div className="card-antigravity rounded-2xl overflow-hidden shadow-sm space-y-0 transition-all">
      {/* Header Bar */}
      <div className="p-5 border-b border-rift-border bg-rift-surface flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-rift-accent shrink-0 shadow-sm">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-rift-accent">
                Gemma AI Investigation
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold">
                {modelStatus?.configured_model || 'gemma4:e2b'}
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-rift-base text-rift-muted border border-rift-border">
                {modelStatus?.provider === 'cloud' ? 'Ollama Cloud' : 'Local Ollama'}
              </span>
              <span
                className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border uppercase font-semibold ${
                  isModelReady
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isModelReady ? 'Online' : 'Offline'}
              </span>
              {activeInvestigation && (
                <span
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border uppercase font-semibold ${
                    activeInvestigation.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : activeInvestigation.status === 'failed'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                  }`}
                >
                  {activeInvestigation.status}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-rift-text mt-0.5 tracking-tight">
              Root-Cause Hypothesis & Telemetry Verification Engine
            </h3>
          </div>
        </div>

        {/* Action Button & Model Tag */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {investigations.length > 1 && (
            <select
              value={selectedInvestigationId || ''}
              onChange={(e) => setSelectedInvestigationId(e.target.value)}
              className="px-3 py-1.5 bg-rift-surface border border-rift-border rounded-full text-xs font-mono text-rift-text focus:outline-none focus:border-rift-accent shadow-sm"
            >
              {investigations.map((inv, idx) => (
                <option key={inv.id} value={inv.id}>
                  Run #{investigations.length - idx} ({inv.status}) - {formatDateTime(inv.created_at)}
                </option>
              ))}
            </select>
          )}

          {activeInvestigation && activeInvestigation.status === 'completed' && (
            <>
              <button
                onClick={handleExportReport}
                className="btn-secondary !text-xs !py-1.5 !px-3.5"
                title="Download markdown technical report and copy to clipboard"
              >
                {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5 text-rift-accent" />}
                <span>{copiedReport ? 'Downloaded' : 'Export .md'}</span>
              </button>

              <button
                onClick={handleExportJson}
                disabled={downloadingJson}
                className="btn-secondary !text-xs !py-1.5 !px-3.5 disabled:opacity-50"
                title="Download JSON incident report schema"
              >
                <Download className="w-3.5 h-3.5 text-rift-accent" />
                <span>{downloadingJson ? 'Exporting...' : 'Export .json'}</span>
              </button>
            </>
          )}

          <button
            onClick={() => investigateMutation.mutate()}
            disabled={investigateMutation.isPending || isJobRunning || !isModelReady}
            title={!isModelReady ? 'Local Gemma model is not ready. Check Ollama server.' : undefined}
            className={`btn-primary !text-xs !py-1.5 !px-4 ${
              investigateMutation.isPending || isJobRunning || !isModelReady
                ? 'opacity-60 cursor-not-allowed'
                : ''
            }`}
          >
            {investigateMutation.isPending || isJobRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Investigating with Gemma...</span>
              </>
            ) : !isModelReady ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Model Offline</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{investigations.length > 0 ? 'Re-Investigate with Gemma' : 'Investigate with Gemma'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Model Unavailable or Setup Error Banner */}
      {(setupError || (modelStatus && !isModelReady)) && (
        <div className="p-4 mx-5 my-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Local Gemma Model Inference Unavailable</span>
          </div>
          <p className="font-sans leading-relaxed text-amber-800">
            {setupError?.message || modelStatus?.message || 'Cannot reach local Ollama daemon at configured endpoint.'}
          </p>
          {(() => {
            const raw = setupError?.instructions || modelStatus?.setup_instructions;
            if (!raw || (Array.isArray(raw) && raw.length === 0)) return null;
            const text = Array.isArray(raw) ? raw.join('\n') : String(raw);
            return (
              <div className="mt-2 p-2.5 rounded-lg bg-white border border-amber-200 font-mono text-[11px] text-amber-950 whitespace-pre-wrap">
                {text}
              </div>
            );
          })()}
        </div>
      )}

      {/* Active Job Progress View */}
      {isJobRunning && (
        <div className="p-8 text-center space-y-4">
          <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-blue-200 border-t-rift-accent animate-spin" />
            <Cpu className="w-6 h-6 text-rift-accent animate-pulse" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rift-text">Gemma Model Reasoning in Progress</h4>
            <p className="text-xs text-rift-muted font-mono max-w-md mx-auto">
              Analyzing bounded evidence package for trace <span className="text-rift-accent font-semibold">{traceId}</span>...
              Verifying execution citations and causal hypotheses.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[11px] font-mono text-rift-accent">
            <span className="w-2 h-2 rounded-full bg-rift-accent animate-ping" />
            <span>Status: {activeInvestigation?.status.toUpperCase()}</span>
          </div>
        </div>
      )}

      {/* Failed Investigation View */}
      {activeInvestigation?.status === 'failed' && (
        <div className="p-6 m-5 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
              <AlertOctagon className="w-4 h-4 text-rose-600" />
              <span>Investigation Job Failed</span>
            </div>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold">
              {activeInvestigation.failure_code || 'INFERENCE_ERROR'}
            </span>
          </div>
          <p className="text-rose-900 font-mono leading-relaxed bg-white p-3 rounded-lg border border-rose-200">
            {activeInvestigation.failure_message || 'The model did not return a valid structured response.'}
          </p>
          <div className="flex items-center justify-between pt-2">
            <span className="text-rose-700 text-[11px]">You can retry after ensuring your local model is loaded.</span>
            <button
              onClick={() => investigateMutation.mutate()}
              className="px-3.5 py-1.5 rounded-full bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition shadow-sm"
            >
              Retry Investigation
            </button>
          </div>
        </div>
      )}

      {/* No Investigations Yet View */}
      {!isJobRunning && !activeInvestigation && !setupError && (
        <div className="p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-rift-accent mx-auto">
            <Cpu className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rift-text">No Gemma Investigation Run Yet</h4>
            <p className="text-xs text-rift-muted max-w-lg mx-auto leading-relaxed">
              Synthesize a multi-hypothesis technical failure report grounded in trace telemetry, tool inputs, and validation results.
              Gemma will evaluate causal factors and verify all claims against persisted evidence.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => investigateMutation.mutate()}
              className="btn-primary !text-xs !py-2 !px-5 inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Investigation with Gemma</span>
            </button>
          </div>
        </div>
      )}

      {/* Completed Investigation Results View */}
      {activeInvestigation && activeInvestigation.status === 'completed' && (
        <div className="p-5 space-y-6">
          {/* Executive Summary Card */}
          <div className="p-4 rounded-xl bg-rift-base border border-rift-border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rift-border/60 pb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-rift-accent" />
                <h4 className="text-xs font-bold text-rift-text uppercase tracking-wider font-mono">
                  Synthesized Incident Report
                </h4>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono flex-wrap">
                <span className="text-rift-muted">Conclusion:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                    activeInvestigation.conclusion_status === 'conclusive'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : activeInvestigation.conclusion_status === 'partially_conclusive'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                  }`}
                >
                  {activeInvestigation.conclusion_status || 'analyzed'}
                </span>
                <span className="text-rift-muted">•</span>
                <span className="text-rift-muted">{activeInvestigation.evidence_count} Verified Citations</span>
              </div>
            </div>

            <p className="text-xs text-rift-text/95 leading-relaxed font-sans">
              {activeInvestigation.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-rift-surface border border-rift-border text-xs space-y-1">
                <span className="text-[10px] font-mono text-rift-muted uppercase tracking-wider block">
                  Observed Failure
                </span>
                <span className="text-rift-text font-medium text-xs leading-snug block">
                  {activeInvestigation.observed_failure || 'N/A'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-rift-surface border border-rift-border text-xs space-y-1">
                <span className="text-[10px] font-mono text-rift-muted uppercase tracking-wider block">
                  First Suspicious Telemetry Event
                </span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-amber-600 font-semibold truncate">
                    {activeInvestigation.first_suspicious_event_id || 'None flagged'}
                  </span>
                  {activeInvestigation.first_suspicious_event_id && onNavigateToEvent && (
                    <button
                      onClick={() => onNavigateToEvent(activeInvestigation.first_suspicious_event_id!)}
                      className="inline-flex items-center gap-1 text-[11px] text-rift-accent hover:underline shrink-0 ml-2 font-mono"
                    >
                      <span>Jump to event</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs (Hypotheses, Evidence Matrix, Remediation) */}
          <div className="flex items-center gap-2 border-b border-rift-border pb-2 text-xs font-mono">
            <button
              onClick={() => setActiveTab('hypotheses')}
              className={`px-3.5 py-1.5 rounded-full font-medium transition flex items-center gap-1.5 ${
                activeTab === 'hypotheses'
                  ? 'bg-rift-accent text-white shadow-sm'
                  : 'text-rift-muted hover:text-rift-text hover:bg-rift-base'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Causal Hypotheses ({(activeInvestigation as InvestigationDetail)?.hypotheses?.length || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab('evidence_matrix')}
              className={`px-3.5 py-1.5 rounded-full font-medium transition flex items-center gap-1.5 ${
                activeTab === 'evidence_matrix'
                  ? 'bg-rift-accent text-white shadow-sm'
                  : 'text-rift-muted hover:text-rift-text hover:bg-rift-base'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Evidence Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('remediation')}
              className={`px-3.5 py-1.5 rounded-full font-medium transition flex items-center gap-1.5 ${
                activeTab === 'remediation'
                  ? 'bg-rift-accent text-white shadow-sm'
                  : 'text-rift-muted hover:text-rift-text hover:bg-rift-base'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Remediation Suggestions ({(activeInvestigation as InvestigationDetail)?.remediation_suggestions?.length || 0})</span>
            </button>
          </div>

          {/* TAB 1: HYPOTHESIS EXPLORER */}
          {activeTab === 'hypotheses' && (
            <div className="space-y-4">
              {(activeInvestigation as InvestigationDetail)?.hypotheses && (activeInvestigation as InvestigationDetail).hypotheses.length > 0 ? (
                (activeInvestigation as InvestigationDetail).hypotheses.map((hyp: HypothesisItem) => {
                  const isExpanded = expandedHypotheses[hyp.id] ?? true;
                  const supportingEv = hyp.evidence.filter((e) => e.relationship === 'supporting');
                  const contradictingEv = hyp.evidence.filter((e) => e.relationship === 'contradicting');

                  return (
                    <div
                      key={hyp.id}
                      className="rounded-xl border border-rift-border bg-rift-elevated/20 overflow-hidden transition"
                    >
                      {/* Hypothesis Header */}
                      <div
                        onClick={() => toggleHypothesis(hyp.id)}
                        className="p-4 bg-rift-elevated/40 flex items-start justify-between gap-3 cursor-pointer hover:bg-rift-elevated/60 transition"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <button className="text-rift-muted hover:text-rift-text mt-0.5">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rift-surface border border-rift-border font-bold text-rift-muted">
                                Rank #{hyp.rank}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold border ${
                                  hyp.verification_status === 'supported'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : hyp.verification_status === 'partially_supported'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : hyp.verification_status === 'contradicted'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                                }`}
                              >
                                {hyp.verification_status.replace('_', ' ')}
                              </span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                                  hyp.confidence_level === 'high'
                                    ? 'text-emerald-400'
                                    : hyp.confidence_level === 'medium'
                                    ? 'text-amber-400'
                                    : 'text-zinc-400'
                                }`}
                              >
                                {hyp.confidence_level} Confidence
                              </span>
                            </div>
                            <h5 className="text-sm font-bold text-rift-text tracking-tight">
                              {hyp.title}
                            </h5>
                          </div>
                        </div>

                        <div className="text-right shrink-0 text-[11px] font-mono text-rift-muted">
                          <span>{supportingEv.length} supporting</span>
                          {contradictingEv.length > 0 && (
                            <span className="text-rose-400 ml-2">({contradictingEv.length} contradicting)</span>
                          )}
                        </div>
                      </div>

                      {/* Hypothesis Expanded Body */}
                      {isExpanded && (
                        <div className="p-4 space-y-4 border-t border-rift-border/50 text-xs">
                          {/* Explanation */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-rift-muted uppercase tracking-wider block">
                              Technical Explanation
                            </span>
                            <p className="text-rift-text/90 leading-relaxed font-sans">
                              {hyp.explanation}
                            </p>
                          </div>

                          {/* Supporting Evidence */}
                          <div className="space-y-2">
                            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Supporting Telemetry Citations ({supportingEv.length})</span>
                            </span>
                            {supportingEv.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {supportingEv.map((ev) => (
                                  <div
                                    key={ev.id}
                                    className="p-2.5 rounded-lg bg-rift-surface border border-emerald-500/20 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-mono text-xs font-semibold text-emerald-300 block truncate">
                                        {ev.event_id}
                                      </span>
                                      {ev.explanation && (
                                        <span className="text-[10px] text-rift-muted block truncate font-sans">
                                          {ev.explanation}
                                        </span>
                                      )}
                                    </div>
                                    {onNavigateToEvent && (
                                      <button
                                        onClick={() => onNavigateToEvent(ev.event_id)}
                                        className="text-rift-muted hover:text-rift-accent transition shrink-0 p-1"
                                        title="Navigate to trace event"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-rift-muted italic">No direct supporting citations provided.</p>
                            )}
                          </div>

                          {/* Contradicting Evidence (if any) */}
                          {contradictingEv.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider flex items-center gap-1">
                                <AlertOctagon className="w-3 h-3" />
                                <span>Contradicting Telemetry Citations ({contradictingEv.length})</span>
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {contradictingEv.map((ev) => (
                                  <div
                                    key={ev.id}
                                    className="p-2.5 rounded-lg bg-rift-surface border border-rose-500/20 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <span className="font-mono text-xs font-semibold text-rose-300 block truncate">
                                        {ev.event_id}
                                      </span>
                                      {ev.explanation && (
                                        <span className="text-[10px] text-rift-muted block truncate font-sans">
                                          {ev.explanation}
                                        </span>
                                      )}
                                    </div>
                                    {onNavigateToEvent && (
                                      <button
                                        onClick={() => onNavigateToEvent(ev.event_id)}
                                        className="text-rift-muted hover:text-rift-accent transition shrink-0 p-1"
                                        title="Navigate to trace event"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Missing Evidence / Information Gaps */}
                          {hyp.missing_evidence && hyp.missing_evidence.length > 0 && (
                            <div className="space-y-1.5 p-3 rounded-lg bg-rift-surface/60 border border-rift-border">
                              <span className="text-[10px] font-mono text-rift-muted uppercase tracking-wider block">
                                Missing Information / Unobserved Signals
                              </span>
                              <ul className="list-disc list-inside space-y-1 text-[11px] text-rift-muted">
                                {hyp.missing_evidence.map((gap, gIdx) => (
                                  <li key={gIdx}>{gap}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Suggested Verification Check */}
                          {hyp.suggested_check && (
                            <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200/80 text-[11px] space-y-1">
                              <span className="text-[10px] font-mono text-rift-accent uppercase tracking-wider block font-bold">
                                Recommended Verification Check
                              </span>
                              <p className="text-rift-text font-mono">{hyp.suggested_check}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-rift-muted">
                  No structured hypotheses returned.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EVIDENCE MATRIX */}
          {activeTab === 'evidence_matrix' && (
            <div className="overflow-x-auto rounded-xl border border-rift-border">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-rift-base text-[10px] font-mono uppercase text-rift-muted border-b border-rift-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Hypothesis</th>
                    <th className="py-2.5 px-4 font-semibold">Supporting Events</th>
                    <th className="py-2.5 px-4 font-semibold">Contradicting Events</th>
                    <th className="py-2.5 px-4 font-semibold">Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rift-border/60">
                  {(activeInvestigation as InvestigationDetail)?.hypotheses?.map((hyp) => {
                    const sup = hyp.evidence.filter((e) => e.relationship === 'supporting');
                    const con = hyp.evidence.filter((e) => e.relationship === 'contradicting');

                    return (
                      <tr key={hyp.id} className="hover:bg-rift-base/50 transition">
                        <td className="py-3 px-4 font-medium text-rift-text max-w-xs">
                          <div className="font-bold text-xs">{hyp.title}</div>
                          <div className="text-[11px] text-rift-muted line-clamp-1 mt-0.5">{hyp.explanation}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {sup.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {sup.map((e) => (
                                <button
                                  key={e.id}
                                  onClick={() => onNavigateToEvent && onNavigateToEvent(e.event_id)}
                                  className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                                >
                                  {e.event_id}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-rift-muted">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {con.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {con.map((e) => (
                                <button
                                  key={e.id}
                                  onClick={() => onNavigateToEvent && onNavigateToEvent(e.event_id)}
                                  className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                                >
                                  {e.event_id}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-rift-muted">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase font-bold border ${
                              hyp.verification_status === 'supported'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : hyp.verification_status === 'partially_supported'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : hyp.verification_status === 'contradicted'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                            }`}
                          >
                            {hyp.verification_status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: REMEDIATION SUGGESTIONS */}
          {activeTab === 'remediation' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">Human-in-the-Loop Safe Remediation:</span> Suggestions below are generated for engineering review.
                  RIFT does not automatically execute changes or destructive fixes in this phase.
                </div>
              </div>

              {(activeInvestigation as InvestigationDetail)?.remediation_suggestions && (activeInvestigation as InvestigationDetail).remediation_suggestions.length > 0 ? (
                (activeInvestigation as InvestigationDetail).remediation_suggestions.map((rem: RemediationItem, rIdx: number) => (
                  <div
                    key={rem.id}
                    className="p-4 rounded-xl border border-rift-border bg-rift-base/40 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-rift-surface border border-rift-border font-bold text-rift-muted">
                            Action #{rIdx + 1}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase font-bold border ${
                              rem.risk_level === 'high'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : rem.risk_level === 'medium'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {rem.risk_level} Risk
                          </span>
                          {rem.requires_human_approval && (
                            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                              Requires Human Approval
                            </span>
                          )}
                        </div>
                        <h5 className="text-sm font-bold text-rift-text font-sans">
                          {rem.description}
                        </h5>
                      </div>
                    </div>

                    {rem.rationale && (
                      <div className="space-y-1 text-xs">
                        <span className="text-[10px] font-mono text-rift-muted uppercase tracking-wider block">
                          Technical Rationale
                        </span>
                        <p className="text-rift-text/90 font-sans leading-relaxed">
                          {rem.rationale}
                        </p>
                      </div>
                    )}

                    {rem.verification_method && (
                      <div className="p-2.5 rounded-lg bg-rift-surface border border-rift-border text-xs font-mono text-rift-muted">
                        <span className="text-rift-accent font-semibold">Verification Method:</span>{' '}
                        {rem.verification_method}
                      </div>
                    )}

                    {/* Phase 5: Replay Lab Integration */}
                    <div className="pt-2 flex items-center justify-between border-t border-rift-border/50">
                      {rem.description.toLowerCase().includes('delete') ||
                      rem.description.toLowerCase().includes('cache') ||
                      rem.description.toLowerCase().includes('file') ||
                      rem.description.toLowerCase().includes('argument') ? (
                        <a
                          href={`/replay?incidentId=${incidentId}&operation=delete_file&path=tmp/cache.json`}
                          className="btn-secondary !text-xs !py-1.5 !px-3.5 inline-flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rift-accent" />
                          <span>Prepare Counterfactual Replay</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-rift-muted italic">
                          This recommendation requires manual verification and cannot be replayed automatically.
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-rift-muted">
                  No remediation suggestions recorded.
                </div>
              )}
            </div>
          )}

          {/* Model Transparency & Runtime Telemetry Card */}
          <div className="pt-3 border-t border-rift-border/80 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-rift-base border border-rift-border space-y-0.5">
                <span className="text-[10px] text-rift-muted block">Gemma Model</span>
                <span className="text-rift-accent font-bold truncate block">{activeInvestigation.model_name}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rift-base border border-rift-border space-y-0.5">
                <span className="text-[10px] text-rift-muted block">Inference Runtime</span>
                <span className="text-rift-text block">Local Ollama</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rift-base border border-rift-border space-y-0.5">
                <span className="text-[10px] text-rift-muted block">Prompt Version</span>
                <span className="text-rift-text block">{activeInvestigation.prompt_version}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rift-base border border-rift-border space-y-0.5">
                <span className="text-[10px] text-rift-muted block">Inference Duration</span>
                <span className="text-rift-accent font-bold block">
                  {activeInvestigation.duration_ms ? `${activeInvestigation.duration_ms}ms` : 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rift-base border border-rift-border space-y-0.5">
                <span className="text-[10px] text-rift-muted block">Telemetry Citations</span>
                <span className="text-emerald-700 font-bold block">{activeInvestigation.evidence_count} verified</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rift-base border border-rift-border space-y-0.5">
                <span className="text-[10px] text-rift-muted block">Context Truncated</span>
                <span className={activeInvestigation.is_truncated ? 'text-amber-700 font-bold block' : 'text-rift-muted block'}>
                  {activeInvestigation.is_truncated ? 'Yes (Budget Capped)' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
