import React, { useState, useEffect, useCallback } from 'react';
import {
  CodeKnowledgeStatus,
  CodeKnowledgeNode,
  CodeKnowledgeEdge,
  CodeKnowledgeQueryResult,
  CodeKnowledgeExplainResult,
  FilePreview,
} from '../../../types';
import { api } from '../../../lib/api';
import {
  Search,
  RefreshCw,
  GitFork,
  FileCode,
  Layers,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  X,
  Loader2,
  Compass,
  Code2,
} from 'lucide-react';

interface CodebaseKnowledgePanelProps {
  initialSearchTerm?: string;
  onSelectSymbol?: (symbol: string) => void;
}

export const CodebaseKnowledgePanel: React.FC<CodebaseKnowledgePanelProps> = ({
  initialSearchTerm = '',
  onSelectSymbol,
}) => {
  const [status, setStatus] = useState<CodeKnowledgeStatus | null>(null);
  const [query, setQuery] = useState(initialSearchTerm || 'TraceContext');
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchResult, setSearchResult] = useState<CodeKnowledgeQueryResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<CodeKnowledgeNode | null>(null);
  const [explainResult, setExplainResult] = useState<CodeKnowledgeExplainResult | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // File Preview Modal State
  const [previewFile, setPreviewFile] = useState<FilePreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Load Status
  const loadStatus = useCallback(async () => {
    try {
      const s = await api.getCodeKnowledgeStatus();
      setStatus(s);
    } catch (err) {
      console.error('Failed to load code knowledge status:', err);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Execute Search
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    try {
      setIsSearching(true);
      const res = await api.queryCodeKnowledge(searchQuery.trim());
      setSearchResult(res);
      if (res.nodes.length > 0) {
        handleSelectNode(res.nodes[0]);
      } else {
        setSelectedNode(null);
        setExplainResult(null);
      }
    } catch (err) {
      console.error('Code knowledge query failed:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Initial search on mount
  useEffect(() => {
    if (query) {
      handleSearch(query);
    }
  }, []);

  // Handle Node Selection / Explain
  const handleSelectNode = async (node: CodeKnowledgeNode) => {
    setSelectedNode(node);
    if (onSelectSymbol) {
      onSelectSymbol(node.label);
    }
    try {
      setIsExplaining(true);
      const exp = await api.explainCodeKnowledge(node.label || node.id);
      setExplainResult(exp);
    } catch (err) {
      console.error('Failed to explain node:', err);
    } finally {
      setIsExplaining(false);
    }
  };

  // Handle Refresh Graph
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await api.refreshCodeKnowledge();
      await loadStatus();
      if (query) {
        await handleSearch(query);
      }
    } catch (err) {
      console.error('Failed to refresh graph:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Safe File Preview
  const handleOpenFilePreview = async (filePath: string, line?: string | null) => {
    try {
      setIsLoadingPreview(true);
      setPreviewError(null);
      let lineNum: number | undefined;
      if (line) {
        const parsed = parseInt(line.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsed)) lineNum = parsed;
      }
      const data = await api.previewSourceFile(filePath, lineNum, 20);
      setPreviewFile(data);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to preview file');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;
    switch (status.status) {
      case 'ready':
        return (
          <span className="badge-status badge-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Ready ({status.node_count} nodes, {status.edge_count} edges)
          </span>
        );
      case 'disabled':
        return (
          <span className="badge-status badge-neutral">
            <XCircle className="w-3.5 h-3.5" />
            Disabled
          </span>
        );
      case 'not_installed':
        return (
          <span className="badge-status badge-amber">
            <AlertTriangle className="w-3.5 h-3.5" />
            CLI Not Installed
          </span>
        );
      case 'graph_not_generated':
        return (
          <span className="badge-status badge-amber">
            <AlertTriangle className="w-3.5 h-3.5" />
            Graph Not Generated
          </span>
        );
      case 'updating':
        return (
          <span className="badge-status badge-info">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Updating...
          </span>
        );
      default:
        return (
          <span className="badge-status badge-error">
            <XCircle className="w-3.5 h-3.5" />
            Error
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden relative">
      {/* Top Header & Search Bar */}
      <div className="p-4 border-b border-gray-200 bg-[#F8F9FA] space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-rift-accent">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                Codebase Knowledge Graph
              </h3>
              <p className="text-[11px] text-gray-500 font-mono">
                Powered by Graphify AST extraction · v{status?.graphify_version || '0.9.92'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || status?.status === 'disabled'}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-2.5"
              title="Re-extract codebase knowledge graph"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Search Input & Quick Chips */}
        <div className="space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search functions, classes, models, or modules (e.g. TraceContext, DetectionEngine)..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-xs"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="btn-primary text-xs py-2 px-3.5 shrink-0"
            >
              {isSearching ? 'Searching...' : 'Search AST'}
            </button>
          </form>

          {/* Quick Concept Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              Explore:
            </span>
            {['TraceContext', 'Incident', 'Span', 'DetectionEngine', 'BaseRule', 'GemmaClient'].map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  setQuery(chip);
                  handleSearch(chip);
                }}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition font-mono ${
                  query === chip
                    ? 'bg-blue-50 text-blue-700 border-blue-200 font-semibold'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Disconnection/Provenance Notice */}
      <div className="px-4 py-2 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between text-[11px] text-blue-900">
        <span className="flex items-center gap-1.5 font-medium">
          <GitFork className="w-3.5 h-3.5 text-rift-accent" />
          <span>
            <strong>Deterministic AST Provenance:</strong> Source-code relationships are parsed statically via tree-sitter. Execution telemetry and DAG traces are kept strictly distinct.
          </span>
        </span>
        {searchResult?.duration_ms !== undefined && (
          <span className="font-mono text-blue-600 text-[10px]">
            {searchResult.duration_ms}ms
          </span>
        )}
      </div>

      {/* Two-Column Explorer Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left List: Matched Nodes */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-[#FBFBFC] shrink-0">
          <div className="p-2.5 border-b border-gray-200 bg-white flex items-center justify-between text-xs text-gray-500 font-medium">
            <span>Matched Entities ({searchResult?.nodes.length || 0})</span>
            {searchResult?.raw_summary && (
              <span className="text-[10px] text-gray-400 truncate max-w-[140px]" title={searchResult.raw_summary}>
                {searchResult.raw_summary}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {isSearching ? (
              <div className="p-8 text-center text-gray-400 space-y-2">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-rift-accent" />
                <p className="text-xs">Traversing knowledge graph...</p>
              </div>
            ) : searchResult?.nodes && searchResult.nodes.length > 0 ? (
              searchResult.nodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <button
                    key={node.id}
                    onClick={() => handleSelectNode(node)}
                    className={`w-full text-left p-2.5 rounded-lg border transition ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-semibold font-mono truncate ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                        {node.label}
                      </span>
                      {node.file_type && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-mono uppercase">
                          {node.file_type}
                        </span>
                      )}
                    </div>
                    {node.source_file && (
                      <div className="text-[10px] text-gray-500 font-mono truncate flex items-center gap-1">
                        <FileCode className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="truncate">{node.source_file}</span>
                        {node.source_location && (
                          <span className="text-gray-400 shrink-0">:{node.source_location}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-gray-400 space-y-1">
                <p className="text-xs font-medium text-gray-500">No matching concepts found</p>
                <p className="text-[11px]">Try searching for functions, classes, or modules above.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Detail: Selected Entity & Relationships */}
        <div className="flex-1 overflow-y-auto p-5 bg-white space-y-5">
          {selectedNode ? (
            <>
              {/* Concept Header Card */}
              <div className="card-antigravity p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-gray-900 font-mono">
                        {selectedNode.label}
                      </h4>
                      {selectedNode.community_name && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                          {selectedNode.community_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      ID: {selectedNode.id}
                    </p>
                  </div>
                  {selectedNode.source_file && (
                    <button
                      onClick={() => handleOpenFilePreview(selectedNode.source_file!, selectedNode.source_location)}
                      className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-2.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                      <span>Preview Source</span>
                    </button>
                  )}
                </div>

                {/* Source File Location */}
                {selectedNode.source_file && (
                  <div className="p-2.5 rounded-lg bg-[#F8F9FA] border border-gray-200 flex items-center justify-between text-xs font-mono">
                    <span className="text-gray-600 truncate flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-gray-400" />
                      <span>{selectedNode.source_file}</span>
                      {selectedNode.source_location && (
                        <span className="text-blue-600 font-semibold">{selectedNode.source_location}</span>
                      )}
                    </span>
                    <button
                      onClick={() => handleOpenFilePreview(selectedNode.source_file!, selectedNode.source_location)}
                      className="text-rift-accent hover:underline text-[11px] shrink-0 ml-2"
                    >
                      View Line
                    </button>
                  </div>
                )}
              </div>

              {/* Connected Relationships */}
              {isExplaining ? (
                <div className="p-12 text-center text-gray-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-rift-accent" />
                  <p className="text-xs">Resolving graph edges and connections...</p>
                </div>
              ) : explainResult ? (
                <div className="space-y-4">
                  {/* Outgoing Edges */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                      <ArrowRight className="w-4 h-4 text-blue-600" />
                      <span>Outgoing Dependencies ({explainResult.outgoing_edges.length})</span>
                    </div>
                    {explainResult.outgoing_edges.length > 0 ? (
                      <div className="space-y-1.5">
                        {explainResult.outgoing_edges.map((edge, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-semibold text-gray-900 font-mono truncate">
                                {edge.target}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                                [{edge.relation}]
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                  edge.confidence === 'EXTRACTED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {edge.confidence}
                              </span>
                              {edge.source_file && (
                                <button
                                  onClick={() => handleOpenFilePreview(edge.source_file!, edge.source_location)}
                                  className="text-[10px] text-gray-400 hover:text-rift-accent"
                                  title={`View citation at ${edge.source_file}:${edge.source_location || ''}`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic pl-6">No outgoing connections.</p>
                    )}
                  </div>

                  {/* Incoming Edges */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                      <ArrowLeft className="w-4 h-4 text-emerald-600" />
                      <span>Incoming References ({explainResult.incoming_edges.length})</span>
                    </div>
                    {explainResult.incoming_edges.length > 0 ? (
                      <div className="space-y-1.5">
                        {explainResult.incoming_edges.map((edge, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg border border-gray-200 bg-white hover:border-gray-300 transition flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-semibold text-gray-900 font-mono truncate">
                                {edge.source}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                                [{edge.relation}]
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                  edge.confidence === 'EXTRACTED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {edge.confidence}
                              </span>
                              {edge.source_file && (
                                <button
                                  onClick={() => handleOpenFilePreview(edge.source_file!, edge.source_location)}
                                  className="text-[10px] text-gray-400 hover:text-rift-accent"
                                  title={`View citation at ${edge.source_file}:${edge.source_location || ''}`}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic pl-6">No incoming references.</p>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400 space-y-2">
              <Layers className="w-8 h-8 text-gray-300" />
              <p className="text-xs font-medium text-gray-500">Select an entity from the list</p>
              <p className="text-[11px] max-w-sm">
                Explore its AST definitions, file citations, and directional dependencies across the codebase.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Safe File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-3.5 border-b border-gray-200 bg-[#F8F9FA] flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs">
                <FileCode className="w-4 h-4 text-rift-accent" />
                <span className="font-semibold text-gray-900">{previewFile.file_path}</span>
                {previewFile.line_number && (
                  <span className="text-blue-600 font-bold">Line {previewFile.line_number}</span>
                )}
                <span className="text-gray-400">({previewFile.total_lines} total lines)</span>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="w-7 h-7 rounded-lg hover:bg-gray-200 flex items-center justify-center text-gray-500 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Code Snippet with Line Numbers */}
            <div className="flex-1 overflow-auto bg-[#1E1E1E] text-gray-200 p-4 font-mono text-xs leading-relaxed">
              <pre className="m-0">
                {previewFile.content_snippet.split('\n').map((line, idx) => {
                  const currentLineNumber = previewFile.start_line + idx;
                  const isTargetLine = previewFile.line_number === currentLineNumber;
                  return (
                    <div
                      key={idx}
                      className={`flex ${isTargetLine ? 'bg-blue-900/40 -mx-4 px-4 border-l-2 border-blue-400' : ''}`}
                    >
                      <span className="w-12 select-none text-gray-500 text-right pr-4 shrink-0">
                        {currentLineNumber}
                      </span>
                      <span className="flex-1 whitespace-pre">{line}</span>
                    </div>
                  );
                })}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-[11px] text-gray-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Path traversal protection active · Read-only repository access</span>
              </span>
              <button
                onClick={() => setPreviewFile(null)}
                className="btn-secondary text-xs py-1 px-3"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading & Error Overlays */}
      {isLoadingPreview && (
        <div className="fixed inset-0 z-50 bg-black/20 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-rift-accent" />
            <span>Loading source preview...</span>
          </div>
        </div>
      )}

      {previewError && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg shadow-lg text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{previewError}</span>
          <button onClick={() => setPreviewError(null)} className="ml-2 text-red-500 hover:text-red-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
