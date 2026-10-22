import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  Compass,
  Sparkles,
  Box,
  Activity,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Cpu,
  Layers,
  Database,
  Search,
} from 'lucide-react';

export const IntegrationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  const { data: codeKnowledgeStatus } = useQuery({
    queryKey: ['code-knowledge-status'],
    queryFn: api.getCodeKnowledgeStatus,
    staleTime: 30000,
  });

  const { data: systemStatus } = useQuery({
    queryKey: ['system-status'],
    queryFn: api.getSystemStatus,
    staleTime: 30000,
  });

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  return (
    <div className="w-full bg-[#f8f9fa] text-[#202124] min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header Hero */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white border border-slate-200 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono font-semibold text-slate-800 tracking-wider uppercase">
              Ecosystem & Integrations
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500 font-mono text-[11px]">v0.1.0</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#0F172A]">
            Supercharge RIFT with your stack.
          </h1>

          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Connect codebase knowledge graphs, counterfactual AI auditors, isolated sandboxes,
            and telemetry exporters to observe and debug autonomous agent execution safely.
          </p>
        </div>

        {/* Integration Grid (4 Core Integrations) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Graphify AST Knowledge Graph */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Graphify AST Knowledge Graph
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">
                      Static Code AST · Tree-sitter
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {codeKnowledgeStatus?.status === 'ready'
                    ? `Ready (${codeKnowledgeStatus.node_count} nodes)`
                    : 'v0.9.92'}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Generates a deterministic source-code knowledge graph using local AST parsers.
                When agents perform destructive or unexpected tool calls, RIFT maps those calls
                directly to actual code symbols and communities.
              </p>

              {/* Architecture Diagram */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-white font-mono text-[11px] space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    AST INGESTION PIPELINE
                  </span>
                  <span className="text-slate-500">Zero Vector Embeddings</span>
                </div>
                <div className="flex items-center justify-between gap-1 text-center pt-1">
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-emerald-400 font-bold block text-xs">AST Parser</span>
                    <span className="text-[10px] text-slate-400">Tree-sitter</span>
                  </div>
                  <span className="text-slate-500 font-bold">→</span>
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-cyan-400 font-bold block text-xs">Graph JSON</span>
                    <span className="text-[10px] text-slate-400">Communities</span>
                  </div>
                  <span className="text-slate-500 font-bold">→</span>
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-blue-400 font-bold block text-xs">Investigation</span>
                    <span className="text-[10px] text-slate-400">Code Proof</span>
                  </div>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 text-[11px]">Generate Graph:</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        'graphify',
                        'graphify extract . --code-only\ngraphify cluster-only . --no-label'
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-900"
                  >
                    {copiedSnippet === 'graphify' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200">
                  <code>graphify extract . --code-only && graphify cluster-only . --no-label</code>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-sans">
                Status: {codeKnowledgeStatus?.status === 'ready' ? 'Active & Ready' : 'Standby'}
              </span>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-medium transition"
              >
                <span>Manage in Settings</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Card 2: Google Gemma 4 & Argon */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Google Gemma 4 & Argon AI
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">
                      Counterfactual Reasoning · Local Ollama / Vertex
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  Argon v1.0
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Autonomous counterfactual investigation engine. Gemma compares what the agent planned
                with what tools actually executed, identifying the first point of divergence and proposing
                sound corrective actions.
              </p>

              {/* Architecture Diagram */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-white font-mono text-[11px] space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    DISCREPANCY DETECTOR
                  </span>
                  <span className="text-slate-500">Autonomous Reasoning</span>
                </div>
                <div className="flex items-center justify-between gap-1 text-center pt-1">
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-purple-400 font-bold block text-xs">Plan Telemetry</span>
                    <span className="text-[10px] text-slate-400">Agent Intent</span>
                  </div>
                  <span className="text-slate-500 font-bold">→</span>
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-pink-400 font-bold block text-xs">Gemma Model</span>
                    <span className="text-[10px] text-slate-400">Delta Eval</span>
                  </div>
                  <span className="text-slate-500 font-bold">→</span>
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-emerald-400 font-bold block text-xs">Root Cause</span>
                    <span className="text-[10px] text-slate-400">Causal Fix</span>
                  </div>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 text-[11px]">Local Ollama Setup:</span>
                  <button
                    onClick={() =>
                      handleCopy('gemma', 'ollama pull gemma:7b-instruct\nollama run gemma:7b-instruct')
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-900"
                  >
                    {copiedSnippet === 'gemma' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200">
                  <code>ollama pull gemma:7b-instruct && ollama run gemma:7b-instruct</code>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-sans">Provider: Local Ollama / Cloud</span>
              <button
                onClick={() => navigate('/investigations')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-medium transition"
              >
                <span>Open Investigations</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Card 3: Docker Isolated Sandbox Replay */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <Box className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Docker Replay Sandbox</h2>
                    <span className="text-xs text-slate-500 font-mono">
                      Isolated Execution · Container Sandboxing
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Docker Scratch
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Execute agent replay scripts and counterfactual hypotheses in ephemeral, network-isolated
                Docker containers. Verifies bugfixes before they reach production servers.
              </p>

              {/* Architecture Diagram */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-white font-mono text-[11px] space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    CONTAINER LIFECYCLE
                  </span>
                  <span className="text-slate-500">Read-only Host Mount</span>
                </div>
                <div className="flex items-center justify-between gap-1 text-center pt-1">
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-blue-400 font-bold block text-xs">Snapshot</span>
                    <span className="text-[10px] text-slate-400">FS State</span>
                  </div>
                  <span className="text-slate-500 font-bold">→</span>
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-amber-400 font-bold block text-xs">Docker Run</span>
                    <span className="text-[10px] text-slate-400">Isolated</span>
                  </div>
                  <span className="text-slate-500 font-bold">→</span>
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-emerald-400 font-bold block text-xs">Diff Capture</span>
                    <span className="text-[10px] text-slate-400">State Delta</span>
                  </div>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 text-[11px]">Replay API Request:</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        'replay',
                        'curl -X POST http://127.0.0.1:8000/api/replay \\\n  -H "Content-Type: application/json" \\\n  -d \'{"incident_id": "inc-001", "mode": "counterfactual"}\''
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-900"
                  >
                    {copiedSnippet === 'replay' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200">
                  <code>POST /api/replay -d &#123;"incident_id": "inc-001", "mode": "counterfactual"&#125;</code>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-sans">Total Replays: {systemStatus?.total_replays || 0}</span>
              <button
                onClick={() => navigate('/replay')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-medium transition"
              >
                <span>Launch Replay Lab</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Card 4: OpenTelemetry & Agent Frameworks */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">OpenTelemetry Ingest</h2>
                    <span className="text-xs text-slate-500 font-mono">
                      CrewAI · LangChain · AutoGen · LlamaIndex
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  OTel Standard
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Standardized agent telemetry collection. Collect parent-child spans, tool calls, model
                reasoning traces, and execution errors directly into RIFT's high-speed DAG pipeline.
              </p>

              {/* Architecture Diagram */}
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-white font-mono text-[11px] space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    TELEMETRY INGESTION
                  </span>
                  <span className="text-slate-500">Low-Latency Async</span>
                </div>
                <div className="flex items-center justify-between gap-1 text-center pt-1">
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-amber-400 font-bold block text-xs">Multi-Agent</span>
                    <span className="text-[10px] text-slate-400">Frameworks</span>
                  </div>
                  <span className="text-slate-500 font-bold">→</span>
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-cyan-400 font-bold block text-xs">OTLP HTTP</span>
                    <span className="text-[10px] text-slate-400">JSON Exporter</span>
                  </div>
                  <span className="text-slate-500 font-bold">→</span>
                  <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                    <span className="text-purple-400 font-bold block text-xs">DAG Engine</span>
                    <span className="text-[10px] text-slate-400">Incident Flags</span>
                  </div>
                </div>
              </div>

              {/* Code Snippet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-400 text-[11px]">Python Instrumentor:</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        'otel',
                        'from rift.instrumentation import instrument_agent\n\ninstrument_agent(agent, endpoint="http://localhost:8000")'
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-slate-900"
                  >
                    {copiedSnippet === 'otel' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200">
                  <code>instrument_agent(agent, endpoint="http://localhost:8000")</code>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-sans">
                Active Traces: {systemStatus?.total_traces || 0}
              </span>
              <button
                onClick={() => navigate('/traces')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-medium transition"
              >
                <span>View Traces</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
