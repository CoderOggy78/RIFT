import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Sparkles,
  Box,
  Activity,
  Copy,
  Check,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Layers,
  CheckCircle2,
} from 'lucide-react';

export interface IntegrationItem {
  id: string;
  name: string;
  subtitle: string;
  tag: string;
  badgeColor: string;
  version: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  features: string[];
  codeTabs: {
    label: string;
    lang: string;
    code: string;
  }[];
  exploreLink: string;
  exploreLabel: string;
  diagramType: 'ast' | 'gemma' | 'sandbox' | 'otel';
}

const INTEGRATIONS_DATA: IntegrationItem[] = [
  {
    id: 'graphify',
    name: 'Graphify AST Knowledge',
    subtitle: 'Codebase Static Knowledge Graph',
    tag: 'AST Tree-Sitter',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    version: 'v0.9.92',
    icon: Compass,
    description:
      'Extracts code symbols, call graphs, and architectural dependencies directly from your source tree. RIFT uses this deterministic graph to correlate agent actions against actual code definitions without vector hallucination.',
    features: [
      'AST-based deterministic symbol resolution via local tree-sitter',
      'Community clustering for hierarchical architecture grouping',
      'Zero external API cost or vector embeddings required',
      'Real-time evidence grounding for anomalous tool invocations',
    ],
    codeTabs: [
      {
        label: 'CLI Extract',
        lang: 'bash',
        code: `# Generate deterministic AST graph for your repo\ngraphify extract . --code-only\ngraphify cluster-only . --no-label\n\n# Graph is saved to graphify-out/graph.json`,
      },
      {
        label: 'Python SDK',
        lang: 'python',
        code: `from rift.services.code_knowledge import CodeKnowledgeService\n\n# Query AST entities & verify citations\nservice = CodeKnowledgeService()\nstatus = service.get_status()\nresult = service.query_symbol("IncidentDetector", max_depth=2)`,
      },
      {
        label: 'Environment',
        lang: 'env',
        code: `# Enable codebase knowledge in RIFT backend\nRIFT_ENABLE_CODEBASE_KNOWLEDGE=true\nGRAPHIFY_GRAPH_PATH=graphify-out/graph.json\nGRAPHIFY_TIMEOUT_SECONDS=15`,
      },
    ],
    exploreLink: '/graphify',
    exploreLabel: 'Open Graphify Hub',
    diagramType: 'ast',
  },
  {
    id: 'gemma',
    name: 'Google Gemma 4 & Argon',
    subtitle: 'Counterfactual Discrepancy Analysis',
    tag: 'Counterfactual AI',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    version: 'Argon v1.0',
    icon: Sparkles,
    description:
      'Autonomous incident investigator powered by Gemma counterfactual reasoning. Detects silent divergences between the agent plan and actual tool execution, generating verified audit evidence and corrective actions.',
    features: [
      'Identifies the exact first suspicious divergence step',
      'Grounded hypothesis generation with causal step hierarchy',
      'Works with local Ollama, vLLM, or Google Vertex AI',
      'Counterfactual verification with automated hypothesis scoring',
    ],
    codeTabs: [
      {
        label: 'Ollama Run',
        lang: 'bash',
        code: `# Pull and run local Gemma model for RIFT\nollama pull gemma:7b-instruct\nollama run gemma:7b-instruct`,
      },
      {
        label: 'AI Audit SDK',
        lang: 'python',
        code: `from rift.services.ai.gemma_client import GemmaClient\n\nclient = GemmaClient(model="gemma:7b-instruct")\ninvestigation = await client.investigate_trace(\n    trace_id="trace-accidental-deletion-001",\n    temperature=0.2\n)`,
      },
      {
        label: 'Config',
        lang: 'yaml',
        code: `rift:\n  investigation:\n    provider: "ollama" # or "vertex_ai"\n    model: "gemma:7b-instruct"\n    timeout_seconds: 45\n    temperature: 0.1`,
      },
    ],
    exploreLink: '/investigations',
    exploreLabel: 'View AI Investigations',
    diagramType: 'gemma',
  },
  {
    id: 'docker',
    name: 'Docker Replay Sandbox',
    subtitle: 'Isolated Environment Verification',
    tag: 'Sandbox Security',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    version: 'Container v2',
    icon: Box,
    description:
      'Re-executes counterfactual steps inside ephemeral, network-isolated sandboxes. Validates that proposed agent bugfixes or rollback commands run cleanly without touching host filesystem state.',
    features: [
      'Ephemeral container isolation with automated teardown',
      'Deterministic environment mocking and stdout/stderr capture',
      'Diff visualizer comparing original vs replayed execution',
      'Enforces strict read-only and memory-budget limits',
    ],
    codeTabs: [
      {
        label: 'Replay CLI',
        lang: 'bash',
        code: `# Re-execute trace step in isolated Docker sandbox\ncurl -X POST http://127.0.0.1:8000/api/replay \\\n  -H "Content-Type: application/json" \\\n  -d '{"trace_id": "trace-accidental-deletion-001", "step_index": 5, "mode": "counterfactual"}'`,
      },
      {
        label: 'Python Sandbox',
        lang: 'python',
        code: `from rift.sandbox import IsolatedSandboxRunner\n\nrunner = IsolatedSandboxRunner(image="rift-sandbox:latest")\nresult = await runner.execute_command(\n    command="npm test",\n    timeout_ms=10000,\n    mount_readonly=True\n)`,
      },
    ],
    exploreLink: '/replay',
    exploreLabel: 'Open Replay Lab',
    diagramType: 'sandbox',
  },
  {
    id: 'opentelemetry',
    name: 'OpenTelemetry & Agent Frameworks',
    subtitle: 'Drop-in Telemetry Instrumentation',
    tag: 'Telemetry Standard',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    version: 'OTel 1.28',
    icon: Activity,
    description:
      'Seamlessly ingest multi-step execution traces from LangChain, CrewAI, AutoGen, or custom agent frameworks. Emits standard spans, tool calls, and LLM completions into RIFT in real time.',
    features: [
      'Native span hierarchical collectors with parent-child links',
      'Automatic tool call input/output schema capture',
      'Standard OTel OTLP/HTTP exporter compatibility',
      'Low latency streaming via FastAPI async ingest',
    ],
    codeTabs: [
      {
        label: 'Python Exporter',
        lang: 'python',
        code: `from rift.client import RiftClient\nfrom crewai import Crew\n\nclient = RiftClient(api_url="http://localhost:8000")\n\n# Auto-instruments agent planning and tool execution\nclient.instrument_crew(my_crew)`,
      },
      {
        label: 'HTTP Ingest',
        lang: 'bash',
        code: `curl -X POST http://127.0.0.1:8000/api/traces \\\n  -H "Content-Type: application/json" \\\n  -d '{\\n    "id": "trace-custom-001",\\n    "agent_name": "DevOps Assistant",\\n    "objective": "Safe migration",\\n    "spans": []\\n  }'`,
      },
    ],
    exploreLink: '/traces',
    exploreLabel: 'View Ingested Traces',
    diagramType: 'otel',
  },
];

export const IntegrationsMenu: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('graphify');
  const [activeCodeTab, setActiveCodeTab] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const selected = INTEGRATIONS_DATA.find((item) => item.id === selectedId) || INTEGRATIONS_DATA[0];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderDiagram = (type: IntegrationItem['diagramType']) => {
    switch (type) {
      case 'ast':
        return (
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-white font-mono text-[11px] space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                AST PIPELINE ARCHITECTURE
              </span>
              <span className="text-slate-500">Tree-sitter</span>
            </div>
            <div className="flex items-center justify-between gap-1 text-center pt-1">
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-emerald-400 font-bold block text-xs">Repo Code</span>
                <span className="text-[10px] text-slate-400">.ts .py .rs</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-cyan-400 font-bold block text-xs">Graphify</span>
                <span className="text-[10px] text-slate-400">1051 nodes</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-blue-400 font-bold block text-xs">RIFT Audit</span>
                <span className="text-[10px] text-slate-400">Code Proof</span>
              </div>
            </div>
          </div>
        );
      case 'gemma':
        return (
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-white font-mono text-[11px] space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                COUNTERFACTUAL AUDITOR
              </span>
              <span className="text-slate-500">Gemma 4 Argon</span>
            </div>
            <div className="flex items-center justify-between gap-1 text-center pt-1">
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-purple-400 font-bold block text-xs">Trace DAG</span>
                <span className="text-[10px] text-slate-400">Tool Calls</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-pink-400 font-bold block text-xs">Gemma LLM</span>
                <span className="text-[10px] text-slate-400">Discrepancy</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-emerald-400 font-bold block text-xs">Root Cause</span>
                <span className="text-[10px] text-slate-400">Fix Plan</span>
              </div>
            </div>
          </div>
        );
      case 'sandbox':
        return (
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-white font-mono text-[11px] space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                ISOLATED CONTAINER RUNTIME
              </span>
              <span className="text-slate-500">Docker Scratch</span>
            </div>
            <div className="flex items-center justify-between gap-1 text-center pt-1">
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-blue-400 font-bold block text-xs">Snapshot</span>
                <span className="text-[10px] text-slate-400">State t-1</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-amber-400 font-bold block text-xs">Replay Lab</span>
                <span className="text-[10px] text-slate-400">Isolated Bash</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-emerald-400 font-bold block text-xs">Verified</span>
                <span className="text-[10px] text-slate-400">Diff Match</span>
              </div>
            </div>
          </div>
        );
      case 'otel':
        return (
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-white font-mono text-[11px] space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                OTEL AGENT INGESTION
              </span>
              <span className="text-slate-500">OTLP Standard</span>
            </div>
            <div className="flex items-center justify-between gap-1 text-center pt-1">
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-amber-400 font-bold block text-xs">CrewAI / AutoGen</span>
                <span className="text-[10px] text-slate-400">Agent Spans</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-cyan-400 font-bold block text-xs">OTLP Exporter</span>
                <span className="text-[10px] text-slate-400">HTTP JSON</span>
              </div>
              <span className="text-slate-500 font-bold">→</span>
              <div className="flex-1 p-2 rounded bg-slate-800/80 border border-slate-700">
                <span className="text-purple-400 font-bold block text-xs">RIFT Engine</span>
                <span className="text-[10px] text-slate-400">Real-time DAG</span>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Navbar Dropdown Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs lg:text-sm font-medium transition-all ${
          isOpen
            ? 'text-rift-accent bg-blue-50/80 font-semibold shadow-xs'
            : 'text-[#5f6368] hover:text-[#202124] hover:bg-gray-100/70'
        }`}
        aria-expanded={isOpen}
      >
        <span>Integrations</span>
        <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
          ✦ NEW
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-rift-accent' : ''
          }`}
        />
      </button>

      {/* Flyout Mega Menu Dropdown */}
      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2.5 w-[880px] max-w-[94vw] bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header Strip */}
          <div className="px-6 py-3.5 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600/10 flex items-center justify-center text-rift-accent">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Latest Ecosystem Integrations
                </h3>
                <p className="text-xs text-slate-500">
                  Connect code knowledge graphs, AI models, sandboxes, and telemetry collectors.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/integrations');
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rift-accent hover:text-rift-accent-hover transition group"
            >
              <span>Explore All</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Two-Column Body: Selector on Left, Rich Visuals & Code on Right */}
          <div className="grid grid-cols-12 min-h-[460px]">
            {/* Left Column: Integration Cards List (4 cols) */}
            <div className="col-span-12 md:col-span-5 p-3 bg-slate-50/70 border-r border-slate-100 space-y-1.5">
              <p className="text-[10px] font-mono uppercase font-semibold text-slate-400 px-3 py-1">
                AVAILABLE INTEGRATIONS
              </p>

              {INTEGRATIONS_DATA.map((item) => {
                const Icon = item.icon;
                const isSelected = item.id === selected.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setActiveCodeTab(0);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 border ${
                      isSelected
                        ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-500/10'
                        : 'bg-transparent border-transparent hover:bg-white/80 hover:border-slate-200'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span
                          className={`text-xs font-semibold truncate ${
                            isSelected ? 'text-slate-900' : 'text-slate-700'
                          }`}
                        >
                          {item.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${item.badgeColor}`}
                        >
                          {item.version}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Full Details, Architecture Diagram & Copyable Code (7 cols) */}
            <div className="col-span-12 md:col-span-7 p-5 flex flex-col justify-between space-y-4 bg-white">
              <div className="space-y-3.5">
                {/* Integration Header */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900">{selected.name}</h4>
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${selected.badgeColor}`}
                      >
                        {selected.tag}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {selected.description}
                    </p>
                  </div>
                </div>

                {/* Feature Bullets */}
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                  {selected.features.map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-tight">{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Visual Architecture Diagram */}
                <div>
                  <p className="text-[10px] font-mono uppercase font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>ARCHITECTURE & DATA FLOW</span>
                    <span className="text-emerald-600 font-sans font-medium text-[11px]">
                      ● Live Integration
                    </span>
                  </p>
                  {renderDiagram(selected.diagramType)}
                </div>

                {/* Copyable Code Snippet */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {selected.codeTabs.map((tab, idx) => (
                        <button
                          key={tab.label}
                          onClick={() => setActiveCodeTab(idx)}
                          className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition ${
                            activeCodeTab === idx
                              ? 'bg-white text-slate-900 shadow-xs font-semibold'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        handleCopyCode(selected.codeTabs[activeCodeTab]?.code || '')
                      }
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition"
                      title="Copy code to clipboard"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700 font-sans">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span className="font-sans">Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-3">
                    <pre className="font-mono text-[11px] text-slate-200 leading-relaxed overflow-x-auto select-all max-h-32">
                      <code>{selected.codeTabs[activeCodeTab]?.code}</code>
                    </pre>
                  </div>
                </div>
              </div>

              {/* Bottom Quick Action Link */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5 font-sans">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Production verified · Zero disruption to core RIFT pipeline</span>
                </span>

                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate(selected.exploreLink);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-medium transition shadow-sm"
                >
                  <span>{selected.exploreLabel}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
