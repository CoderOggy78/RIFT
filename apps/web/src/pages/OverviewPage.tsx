import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { DynamicCrystalField } from '../components/common/DynamicCrystalField';
import { TypewriterStatement } from '../components/common/TypewriterStatement';
import { formatDateTime, formatDuration } from '../lib/utils';
import {
  GitFork,
  AlertOctagon,
  SearchCode,
  RotateCcw,
  Upload,
  ArrowRight,
  Play,
  Sparkles,
  RotateCw,
  Trash2,
  CheckCircle2,
  Layers,
  ChevronRight,
  ChevronDown,
  Terminal,
  ShieldCheck,
  Folder,
  Mic,
  Cpu,
  Check,
  Zap,
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { onOpenImport } = useOutletContext<{ onOpenImport: () => void }>();
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const { data: systemStatus, isLoading: isStatusLoading } = useQuery({
    queryKey: ['system-status'],
    queryFn: api.getSystemStatus,
    refetchInterval: 10000,
  });

  const { data: demoStatus } = useQuery({
    queryKey: ['demo-status'],
    queryFn: api.getSyntheticDemoStatus,
    refetchInterval: 10000,
  });

  const { data: traces, isLoading: isTracesLoading } = useQuery({
    queryKey: ['traces-overview'],
    queryFn: () => api.listTraces({ limit: 5 }),
    refetchInterval: 10000,
  });

  const loadDemoMutation = useMutation({
    mutationFn: api.loadSyntheticDemo,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['traces-overview'] });
      queryClient.invalidateQueries({ queryKey: ['demo-status'] });
      setFeedbackMessage('Loaded official Synthetic Demo: Accidental Source Deletion.');
      if (res.incident_id) {
        navigate(`/incidents/${res.incident_id}`);
      } else {
        navigate(`/investigations/${res.trace_id}`);
      }
    },
    onError: (err: any) => {
      setFeedbackMessage(`Demo error: ${err.message || 'Failed to load demo'}`);
    },
  });

  const resetDemoMutation = useMutation({
    mutationFn: api.resetSyntheticDemo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['traces-overview'] });
      queryClient.invalidateQueries({ queryKey: ['demo-status'] });
      setFeedbackMessage('Synthetic demo purged. Operational data reset.');
    },
  });

  const totalTraces = systemStatus?.total_traces ?? 0;
  const totalIncidents = systemStatus?.total_incidents ?? 0;
  const totalInvestigations = systemStatus?.total_investigations ?? 0;
  const totalReplays = systemStatus?.total_replays ?? 0;

  return (
    <div className="w-full bg-[#f8f9fa] text-[#202124] overflow-x-hidden">
      {/* =========================================================================
          SECTION 1: HERO WITH DYNAMIC CRYSTAL FIELD
      ========================================================================= */}
      <section className="relative min-h-[580px] lg:min-h-[660px] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-12 pb-20 bg-white overflow-hidden border-b border-gray-100">
        {/* Dynamic Swirling Crystal Field Canvas (Real smooth interactive motion) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <DynamicCrystalField />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          {/* Minimalist Engineering Status Capsule */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200/90 shadow-subtle mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] font-semibold text-slate-800 tracking-wider uppercase">
              Autonomous Agent Observability
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500 font-mono text-[11px]">v0.1.0</span>
          </div>

          {/* Genuine RIFT Display Headline */}
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-[#0F172A] leading-[1.08]">
            Understand where your agent
            <br />
            went wrong.
          </h1>

          <p className="text-base sm:text-lg text-[#5f6368] max-w-2xl mx-auto leading-relaxed font-normal">
            Trace multi-step autonomous execution, investigate discrepancies with Gemma,
            and verify counterfactual corrections in isolated sandboxes.
          </p>

          {/* Centered CTA Buttons (Solid Dark Pill matching Image 1 "Download") */}
          <div className="pt-4 flex items-center justify-center gap-3.5 flex-wrap">
            <button
              onClick={() => loadDemoMutation.mutate()}
              disabled={loadDemoMutation.isPending}
              className="px-8 py-3.5 bg-[#202124] hover:bg-black text-white rounded-full text-sm font-medium transition shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-2.5"
            >
              {loadDemoMutation.isPending ? (
                <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
              ) : (
                <Play className="w-4 h-4 text-amber-400 fill-amber-400" />
              )}
              <span>Explore Demo Incident</span>
            </button>

            <button
              onClick={onOpenImport}
              className="px-6 py-3.5 bg-white hover:bg-gray-50 text-[#202124] rounded-full text-sm font-medium transition border border-gray-300 hover:border-gray-400 shadow-xs active:scale-[0.98] inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4 text-rift-accent" />
              <span>Import Trace</span>
            </button>
          </div>
        </div>
      </section>

      {/* Feedback Alert if triggered */}
      {feedbackMessage && (
        <div className="max-w-6xl mx-auto px-4 mt-6">
          <div className="flex items-center justify-between px-5 py-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-rift-accent" />
              <span className="font-medium">{feedbackMessage}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: DYNAMIC WORD-BY-WORD TYPOGRAPHIC STATEMENT (Image 2 reference)
      ========================================================================= */}
      <section className="py-20 lg:py-28 px-6 sm:px-12 lg:px-24 bg-white border-b border-gray-200">
        <TypewriterStatement />
      </section>

      {/* =========================================================================
          SECTION 3: AGENT COMMAND CENTER CARD (Image 3 reference)
      ========================================================================= */}
      <section className="py-20 lg:py-28 px-6 sm:px-12 lg:px-20 bg-[#f8f9fa] border-b border-gray-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Headline & Copy */}
          <div className="lg:col-span-5 space-y-6">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#202124] leading-tight">
              Agent Command Center
            </h2>
            <p className="text-base text-[#5f6368] leading-relaxed">
              Your command center to manage multiple autonomous agents in parallel.
              Group traces into Projects, inspect multi-step tool calls across workspaces,
              and intercept semantic drift before irreversible side-effects occur.
            </p>

            <div className="pt-2 flex items-center gap-4">
              <button
                onClick={() => navigate('/traces')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-rift-accent hover:text-rift-accent-hover transition group"
              >
                <span>Browse live agent executions</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Right: Pastel Aura Glowing Interactive Card (Matching Image 3) */}
          <div className="lg:col-span-7 relative">
            {/* Ambient Pastel Glow (Cyan / Purple / Amber Gradient Bloom) */}
            <div className="absolute -inset-4 bg-gradient-to-r from-cyan-200/50 via-purple-200/40 to-amber-200/50 rounded-3xl blur-2xl opacity-70 pointer-events-none" />

            {/* Mockup Card */}
            <div className="relative bg-white rounded-2xl border border-gray-200/80 shadow-xl p-6 sm:p-8 space-y-5">
              {/* Project Dropdown Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="inline-flex items-center gap-2 text-xs font-mono font-medium text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                  <Folder className="w-3.5 h-3.5 text-blue-600" />
                  <span>project-autonomous-builder</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Telemetry Active
                </span>
              </div>

              {/* Floating Prompt Box (Matching Image 3 prompt surface) */}
              <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200 space-y-4">
                <div className="flex items-center justify-between text-xs text-gray-500 font-sans">
                  <span>Ask anything, @ to mention, / for actions</span>
                  <Mic className="w-4 h-4 text-gray-400" />
                </div>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {/* Model Selector */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-medium text-gray-700 shadow-2xs">
                    <span className="text-gray-400">+</span>
                    <span>Gemma 4 (70B Reasoning)</span>
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </div>

                  {/* Worktree / Sandbox Pills */}
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-600 shadow-2xs">
                    <span className="text-blue-500">🔀</span>
                    <span>Isolated Sandbox</span>
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </div>

                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-600 shadow-2xs">
                    <span>ᛘ main</span>
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Active Dropdown Popover (Matching Image 3 dropdown) */}
              <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-lg text-xs space-y-1 w-60">
                <div className="px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2 cursor-pointer transition">
                  <span className="text-gray-400">💻</span>
                  <span>Local Execution</span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-blue-50 text-rift-accent font-medium flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span>🔀</span>
                    <span>Isolated Sandbox</span>
                  </div>
                  <Check className="w-3.5 h-3.5 text-rift-accent" />
                </div>
              </div>

              {/* Real Anomaly Intercept Badge */}
              <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 flex items-center gap-3 text-xs text-rose-800">
                <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-mono text-[11px]">
                  <strong>DETECTOR:</strong> Accidental source deletion identified on <code className="bg-white px-1 py-0.5 rounded border border-rose-200">src/config.ts</code>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 4: ISOLATED REPLAY SANDBOX TERMINAL (Image 4 reference)
      ========================================================================= */}
      <section className="py-20 lg:py-28 px-6 sm:px-12 lg:px-20 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Terminal Specs */}
          <div className="lg:col-span-5 space-y-6">
            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#202124] leading-tight">
              Deterministic Replay Sandbox
            </h2>
            <p className="text-base text-[#5f6368] leading-relaxed">
              The lightweight, fast, terminal-first surface to work with agent traces.
              Run autonomous counterfactual replays, execute sandboxed bash commands in containerized isolation,
              and mathematically prove invariants without touching production state.
            </p>

            <div className="pt-2">
              <button
                onClick={() => navigate('/replay')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-rift-accent hover:text-rift-accent-hover transition group"
              >
                <span>Open Replay Lab</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Right: Dark macOS Terminal Card (Matching Image 4) */}
          <div className="lg:col-span-7">
            <div className="bg-[#181a1f] rounded-2xl border border-gray-800 shadow-2xl p-6 font-mono text-xs text-gray-200 overflow-hidden">
              {/* Terminal Window Controls */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-800 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                </div>
                <div className="text-[11px] text-gray-400 font-mono">
                  rift-replay-sandbox — bash
                </div>
                <div className="text-[11px] text-gray-500 font-mono">v0.1.0</div>
              </div>

              {/* Terminal ASCII / Pixel Glyph Banner (Matching Image 4 retro header) */}
              <div className="mb-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-rose-400 to-amber-300">
                  <span>▲▲▲ RIFT AGENT VERIFIER</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Welcome to RIFT Replay Sandbox Engine!
                </p>
              </div>

              {/* Interactive Diff Transcript */}
              <div className="space-y-3 bg-[#111317] p-4 rounded-xl border border-gray-800/80">
                <div className="text-gray-400">
                  <span className="text-emerald-400">&gt; you:</span> replay step 04 with protected file scope
                </div>

                <div className="text-gray-300">
                  <span className="text-rift-accent font-semibold">RIFT:</span> Analyzing invariant violation:
                </div>

                {/* Diff Block */}
                <div className="py-2 px-3 rounded-lg bg-black/60 border border-gray-800 font-mono text-[11px] space-y-1">
                  <div className="text-rose-400">- rm -rf src/config.ts  # Target file deleted accidentally</div>
                  <div className="text-emerald-400">+ rm -rf /tmp/build_cache/* # Counterfactual sanitized target</div>
                  <div className="text-gray-400">  node ./scripts/validate.js</div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold pt-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>INVARIANT VERIFIED: 0 production files modified. Exit code 0.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: BUILT FOR DEVELOPERS & OPERATIONAL TRUST (Image 5 reference)
      ========================================================================= */}
      <section className="py-20 lg:py-28 px-6 sm:px-12 lg:px-20 bg-[#f8f9fa]">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Section 5 Header (Matching Image 5 split layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6">
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-[#202124] leading-tight">
                Built for developers
                <br />
                for the agent-first era
              </h2>
            </div>
            <div className="lg:col-span-6">
              <p className="text-base text-[#5f6368] leading-relaxed">
                RIFT is built for user trust, whether you're a professional engineer
                debugging autonomous coding swarms in large codebases, a security team
                monitoring multi-agent workflows, or anyone in between.
              </p>
            </div>
          </div>

          {/* Operational Metrics Cards (KPIs) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Traces */}
            <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Imported Traces
                </span>
                <div className="w-8 h-8 rounded-full bg-blue-50 text-rift-accent flex items-center justify-center">
                  <GitFork className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-gray-900 font-display">
                  {isStatusLoading ? '…' : totalTraces}
                </span>
                <span className="text-xs text-gray-500 font-mono">persisted</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Real execution traces ingested
              </p>
            </div>

            {/* Detected Incidents */}
            <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Detected Incidents
                </span>
                <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertOctagon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-gray-900 font-display">
                  {isStatusLoading ? '…' : totalIncidents}
                </span>
                <span className="text-xs text-rose-600 font-mono font-medium">flagged</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Deterministic rule matches
              </p>
            </div>

            {/* Completed Investigations */}
            <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Investigations
                </span>
                <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <SearchCode className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-gray-900 font-display">
                  {isStatusLoading ? '…' : totalInvestigations}
                </span>
                <span className="text-xs text-indigo-600 font-mono font-medium">diagnosed</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Gemma AI root-cause analyses
              </p>
            </div>

            {/* Sandbox Replays */}
            <div className="p-6 bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  Sandbox Replays
                </span>
                <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight text-gray-900 font-display">
                  {isStatusLoading ? '…' : totalReplays}
                </span>
                <span className="text-xs text-emerald-600 font-mono font-medium">verified</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Counterfactual runs executed
              </p>
            </div>
          </div>

          {/* Official Single Synthetic Demo Callout */}
          <div className="p-6 sm:p-7 bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-rift-accent">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-rift-accent border border-blue-200 uppercase tracking-wider">
                  Synthetic Scenario
                </span>
                <span className="text-xs font-mono text-gray-500">fixtures/incidents/accidental-deletion.json</span>
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-gray-900">
                Accidental Source Deletion (<code className="text-blue-700 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">src/config.ts</code>)
              </h3>
              <p className="text-sm text-gray-600 max-w-3xl leading-relaxed">
                Autonomous agent instructed to clean temporary files erroneously deletes critical configuration.
                RIFT intercepts the breach, invokes Gemma 4 root-cause reasoning, and tests counterfactual remediation.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => loadDemoMutation.mutate()}
                disabled={loadDemoMutation.isPending}
                className="px-5 py-2.5 bg-[#202124] hover:bg-black text-white rounded-full text-xs font-medium transition shadow-sm inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                {loadDemoMutation.isPending ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                )}
                <span>{demoStatus?.is_loaded ? 'Re-open Demo' : 'Launch Demo Incident'}</span>
              </button>

              {demoStatus?.is_loaded && (
                <button
                  onClick={() => resetDemoMutation.mutate()}
                  disabled={resetDemoMutation.isPending}
                  className="px-3.5 py-2.5 rounded-full border border-gray-300 text-xs font-medium text-gray-600 hover:text-rose-600 hover:border-rose-300 transition"
                  title="Purge demo data"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Recent Execution Traces Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Recent Execution Traces</h3>
                <p className="text-xs text-gray-500 mt-0.5">Chronological record of ingested agent telemetry</p>
              </div>
              {traces && traces.length > 0 && (
                <button
                  onClick={() => navigate('/traces')}
                  className="text-xs text-rift-accent hover:text-rift-accent-hover flex items-center gap-1 font-medium transition"
                >
                  <span>View all traces</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isTracesLoading ? (
              <div className="p-12 text-center text-xs text-gray-500 font-mono">Loading traces…</div>
            ) : !traces || traces.length === 0 ? (
              <div className="p-16 text-center space-y-4">
                <GitFork className="w-10 h-10 text-gray-300 mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-900">No traces yet</h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Import an execution trace or explore the synthetic demo.
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
                    <tr className="border-b border-gray-200 bg-gray-50/70 text-[11px] font-mono text-gray-500 uppercase tracking-wider">
                      <th className="py-3 px-6">Trace</th>
                      <th className="py-3 px-4">Agent</th>
                      <th className="py-3 px-4">Started</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Incidents</th>
                      <th className="py-3 px-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {traces.map((trace) => (
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
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-gray-900">{trace.agent_name}</div>
                          <div className="text-[11px] text-gray-500">{trace.project_name}</div>
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
      </section>
    </div>
  );
};
