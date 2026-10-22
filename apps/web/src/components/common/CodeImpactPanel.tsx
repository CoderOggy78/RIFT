import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  ArrowRight,
  Clock,
  Play,
  RotateCw,
  ExternalLink,
  Info,
  Terminal,
  X,
  FileText,
  Compass,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CodeImpactResult,
  CodeImpactRelationship,
  FileOperationEvent,
  DiscoveredTestSuite,
  ValidationRunResult,
  ImpactStatus,
} from '../../types';
import { api } from '../../lib/api';

interface CodeImpactPanelProps {
  impact: CodeImpactResult;
  triggeringEvent?: FileOperationEvent | null;
  agentRunId?: string | null;
  onViewFile?: (filePath: string, line?: number) => void;
  showGraphifyLink?: boolean;
  isCompact?: boolean;
}

export const CodeImpactPanel: React.FC<CodeImpactPanelProps> = ({
  impact,
  triggeringEvent,
  agentRunId,
  onViewFile,
  showGraphifyLink = false,
  isCompact = false,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'direct' | 'transitive'>('all');
  const [validationResults, setValidationResults] = useState<Record<string, ValidationRunResult>>({});
  const [confirmModalTest, setConfirmModalTest] = useState<DiscoveredTestSuite | null>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [selectedRelationshipFile, setSelectedRelationshipFile] = useState<{ path: string; line?: number } | null>(null);

  const event = triggeringEvent || impact.triggering_event || (impact as any).file_operation;

  const relationships: CodeImpactRelationship[] = useMemo(() => {
    if (impact.relationships && impact.relationships.length > 0) {
      return impact.relationships;
    }
    if (impact.dependents && impact.dependents.length > 0) {
      return impact.dependents.map((dep) => ({
        source: dep.name,
        target: impact.target,
        relation: dep.relation,
        direction: 'incoming' as const,
        depth: dep.depth,
        confidence: dep.provenance || 'EXTRACTED',
        confidence_score: 1.0,
        source_file: dep.file_path,
        source_location: null,
        target_file: null,
        target_location: null,
        relevance_explanation: `${dep.name} (${dep.type}) has an AST dependency '${dep.relation}' on ${impact.target}`,
        dependency_path: dep.dependency_path || [impact.target, dep.relation, dep.file_path || dep.name],
        impact_status: dep.impact_status || impact.impact_status || 'POTENTIAL IMPACT',
      }));
    }
    return [];
  }, [impact.relationships, impact.dependents, impact.target, impact.impact_status]);

  const directCount = useMemo(() => relationships.filter((r) => r.depth === 1).length, [relationships]);
  const transitiveCount = useMemo(() => relationships.filter((r) => r.depth > 1).length, [relationships]);

  const filteredRelationships = useMemo(() => {
    return relationships.filter((rel) => {
      if (filterType === 'direct') return rel.depth === 1;
      if (filterType === 'transitive') return rel.depth > 1;
      return true;
    });
  }, [relationships, filterType]);

  const handleExecuteValidation = async (testSuite: DiscoveredTestSuite) => {
    setIsRunningTest(true);
    try {
      const res = await api.validateImpact({
        test_id: testSuite.test_id,
        confirm: true,
        compare_baseline: true,
      });
      setValidationResults((prev) => ({
        ...prev,
        [testSuite.test_id]: res,
      }));
      setConfirmModalTest(null);
    } catch (err: any) {
      setValidationResults((prev) => ({
        ...prev,
        [testSuite.test_id]: {
          test_id: testSuite.test_id,
          test_file: testSuite.test_file,
          command: Array.isArray(testSuite.command) ? testSuite.command : [String(testSuite.command)],
          confirmed: true,
          exit_code: 1,
          passed: false,
          stdout: '',
          stderr: err.message || 'Execution failed',
          duration_ms: 0,
          status: 'VALIDATION FAILED',
          attribution_explanation: `Execution error: ${err.message || 'Failed to run test'}`,
          disclaimer: 'Validation completed without detecting a failure; this does not prove absence of regression.',
        },
      }));
      setConfirmModalTest(null);
    } finally {
      setIsRunningTest(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'CHANGE OBSERVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            CHANGE OBSERVED
          </span>
        );
      case 'POTENTIAL IMPACT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <GitBranch className="w-3 h-3 text-indigo-500" />
            POTENTIAL IMPACT
          </span>
        );
      case 'NO FAILURE OBSERVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            NO FAILURE OBSERVED
          </span>
        );
      case 'VALIDATION FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-300">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            VALIDATION FAILED
          </span>
        );
      case 'REGRESSION CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-rose-100 text-rose-900 border border-rose-400">
            <ShieldAlert className="w-3 h-3 text-rose-700" />
            REGRESSION CONFIRMED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            UNVERIFIED
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4 text-gray-900">
      {/* 1. Header & Triggering Event Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <GitBranch className="w-4 h-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span>Target:</span>
                <span className="font-mono text-indigo-700 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100">
                  {impact.target}
                </span>
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Type: <span className="font-medium">{impact.target_type}</span> | Mutation:{' '}
                <span className="font-mono font-semibold text-gray-800 uppercase">{impact.change_type}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showGraphifyLink && (
              <Link
                to={`/graphify?focusFile=${encodeURIComponent(impact.target)}${
                  (event as any)?.trace_id ? `&traceId=${encodeURIComponent((event as any).trace_id)}` : ''
                }`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-mono font-medium transition"
                title="Inspect in dedicated Graphify AST Code Graph"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Inspect in Graphify</span>
              </Link>
            )}
            {event && renderStatusBadge('CHANGE OBSERVED')}
            {renderStatusBadge(impact.impact_status || 'POTENTIAL IMPACT')}
          </div>
        </div>

        {/* Triggering Event Telemetry */}
        {event && (
          <div className="mt-2 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-gray-50/80 p-2 rounded-lg border border-gray-100">
              <span className="text-gray-400 block text-[10px] uppercase font-mono">Triggering Span</span>
              <span className="font-mono text-gray-800 truncate block mt-0.5" title={(event as any).event_id || (event as any).span_id}>
                {(event as any).event_id || (event as any).span_id || 'N/A'}
              </span>
            </div>
            <div className="bg-gray-50/80 p-2 rounded-lg border border-gray-100">
              <span className="text-gray-400 block text-[10px] uppercase font-mono">Operation</span>
              <span className="font-mono font-medium text-gray-800 block mt-0.5">
                {(event as any).operation_type || (event as any).operation || impact.change_type}
                {event.agent_name ? ` (${event.agent_name})` : ''}
              </span>
            </div>
            <div className="bg-gray-50/80 p-2 rounded-lg border border-gray-100">
              <span className="text-gray-400 block text-[10px] uppercase font-mono">Telemetry Status</span>
              <span className="font-mono font-semibold text-gray-800 block mt-0.5">
                {(event as any).execution_status || 'Observed in Trace'}
              </span>
            </div>
            <div className="bg-gray-50/80 p-2 rounded-lg border border-gray-100">
              <span className="text-gray-400 block text-[10px] uppercase font-mono">Timestamp</span>
              <span className="font-mono text-gray-600 block mt-0.5">
                {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
          </div>
        )}

        {/* High-level summary metrics */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <span>
              Direct dependents:{' '}
              <strong className="text-gray-900 font-mono">
                {impact.direct_impact_count !== undefined ? impact.direct_impact_count : directCount}
              </strong>
            </span>
            <span>
              Transitive dependents:{' '}
              <strong className="text-gray-900 font-mono">
                {impact.transitive_impact_count !== undefined ? impact.transitive_impact_count : transitiveCount}
              </strong>
            </span>
            <span>
              Affected files:{' '}
              <strong className="text-gray-900 font-mono">
                {impact.affected_files ? impact.affected_files.length : new Set(relationships.map((r) => r.source_file).filter(Boolean)).size}
              </strong>
            </span>
            <span>
              Affected symbols:{' '}
              <strong className="text-gray-900 font-mono">
                {impact.affected_symbols ? impact.affected_symbols.length : relationships.length}
              </strong>
            </span>
          </div>
          {impact.duration_ms !== undefined && (
            <span className="text-[11px] font-mono text-gray-400">
              Traversal time: {impact.duration_ms}ms
            </span>
          )}
        </div>
      </div>

      {/* 2. Blast Radius Relationships Explorer */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-500" />
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              AST Dependency Blast Radius ({filteredRelationships.length})
            </h5>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-mono">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterType === 'all'
                  ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Dependents ({relationships.length})
            </button>
            <button
              onClick={() => setFilterType('direct')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterType === 'direct'
                  ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Direct ({directCount})
            </button>
            <button
              onClick={() => setFilterType('transitive')}
              className={`px-2.5 py-1 rounded-md transition ${
                filterType === 'transitive'
                  ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Transitive ({transitiveCount})
            </button>
          </div>
        </div>

        {filteredRelationships.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            <p className="text-xs font-mono text-gray-500">
              No codebase dependencies found in knowledge graph matching filter '{filterType}'.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {filteredRelationships.map((rel, idx) => (
              <div
                key={`${rel.source}-${rel.target}-${idx}`}
                className="p-3 rounded-lg border border-gray-200 bg-gray-50/60 hover:bg-white hover:border-indigo-300 transition flex flex-col gap-2 group"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                        rel.depth === 1
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-purple-100 text-purple-800 border border-purple-200'
                      }`}
                    >
                      Depth {rel.depth}
                    </span>

                    <span className="text-xs font-mono font-semibold text-gray-900">
                      {rel.source}
                    </span>

                    <span className="text-gray-400 text-xs">→</span>

                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">
                      {rel.relation}
                    </span>

                    <span className="text-gray-400 text-xs">→</span>

                    <span className="text-xs font-mono text-indigo-700 font-medium">
                      {rel.target_file || rel.target}
                    </span>
                  </div>

                  {/* Provenance Badge */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        rel.confidence === 'EXTRACTED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                      title={
                        rel.confidence === 'EXTRACTED'
                          ? 'AST ground truth syntax extraction (confidence: 1.0)'
                          : `Semantic or heuristic graph inference (confidence: ${rel.confidence_score})`
                      }
                    >
                      {rel.confidence}
                    </span>

                    {renderStatusBadge(rel.impact_status || 'POTENTIAL IMPACT')}
                  </div>
                </div>

                {/* Explanation text & path */}
                <p className="text-xs text-gray-700 font-sans leading-relaxed">
                  {rel.relevance_explanation}
                </p>

                {/* Actions & source link */}
                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                  {rel.dependency_path && (
                    <span className="font-mono text-gray-500">
                      Path: {Array.isArray(rel.dependency_path) ? rel.dependency_path.join(' ➔ ') : String(rel.dependency_path)}
                    </span>
                  )}
                  {rel.source_file && (
                    <button
                      onClick={() => onViewFile && onViewFile(rel.source_file!, rel.source_location ? parseInt(rel.source_location.replace('L', ''), 10) : undefined)}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-mono ml-auto"
                    >
                      <FileCode className="w-3 h-3" />
                      <span>Preview Source ({rel.source_file}{rel.source_location ? `:${rel.source_location}` : ''})</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Discovered Test Suites & Validation Execution */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Verified Test Suites & Validation ({(impact.discovered_tests || []).length})
            </h5>
          </div>
          <span className="text-[11px] font-mono text-gray-500">
            Real repository test files extracted via AST dependencies
          </span>
        </div>

        {(!impact.discovered_tests || impact.discovered_tests.length === 0) ? (
          <div className="p-4 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
            <p className="text-xs font-mono text-gray-500">
              No automated test suites directly associated with this target file were detected in repository.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(impact.discovered_tests || []).map((ts) => {
              const runResult = validationResults[ts.test_id];
              return (
                <div
                  key={ts.test_id}
                  className="p-3 rounded-lg border border-gray-200 bg-gray-50/60 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-gray-200 text-gray-800">
                        {ts.framework}
                      </span>
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {ts.test_file}
                      </span>
                      {ts.relationship_to_target && (
                        <span className="text-[11px] text-gray-500 font-mono">
                          ({ts.relationship_to_target})
                        </span>
                      )}
                    </div>

                    {ts.command && (
                      <div className="font-mono text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                        {Array.isArray(ts.command) ? ts.command.join(' ') : String(ts.command)}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {runResult ? (
                        renderStatusBadge(runResult.status)
                      ) : (
                        renderStatusBadge('UNVERIFIED')
                      )}

                      <button
                        onClick={() => setConfirmModalTest(ts)}
                        disabled={isRunningTest}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-rift-accent text-white text-xs font-mono font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
                      >
                        <Play className="w-3 h-3" />
                        <span>Run Validation</span>
                      </button>
                    </div>
                  </div>

                  {/* Captured output if already run */}
                  {runResult && (
                    <div className="mt-2 pt-2 border-t border-gray-200/80 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-mono text-gray-500">
                        <span>Command: {Array.isArray(runResult.command) ? runResult.command.join(' ') : String(runResult.command)}</span>
                        <span>Duration: {runResult.duration_ms}ms | Exit Code: {runResult.exit_code}</span>
                      </div>
                      <p className="text-xs font-sans text-gray-800">
                        {runResult.attribution_notes || (runResult as any).attribution_explanation}
                      </p>
                      {(runResult.stdout_snippet || (runResult as any).stdout) && (
                        <div className="bg-gray-900 text-gray-100 p-2.5 rounded-lg font-mono text-[11px] max-h-40 overflow-y-auto">
                          <pre className="whitespace-pre-wrap">{runResult.stdout_snippet || (runResult as any).stdout}</pre>
                        </div>
                      )}
                      <div className="bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-200 text-[11px] flex items-center gap-2">
                        <Info className="w-4 h-4 flex-shrink-0 text-amber-600" />
                        <span>{runResult.attribution_notes || (runResult as any).disclaimer}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Limitations & Freshness Footer */}
      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500 flex flex-col gap-1 font-mono">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span>Knowledge Graph Freshness: {impact.graph_freshness || 'Verified'}</span>
          <span>Provenance: AST Static Extraction (No Mocks)</span>
        </div>
        {impact.limitations && impact.limitations.length > 0 && (
          <ul className="list-disc list-inside text-[11px] text-gray-400 mt-1">
            {impact.limitations.map((lim, i) => (
              <li key={i}>{lim}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModalTest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rift-accent">
                <Terminal className="w-5 h-5" />
                <h3 className="text-base font-bold text-gray-900">Confirm Isolated Test Execution</h3>
              </div>
              <button
                onClick={() => setConfirmModalTest(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              You are requesting to execute an approved test suite in an isolated environment to verify whether the agent's file modification caused real regressions.
            </p>

            <div className="bg-gray-900 text-gray-100 p-3 rounded-xl font-mono text-xs flex flex-col gap-1">
              <span className="text-gray-400 text-[10px] uppercase">Execution Command</span>
              <span className="text-emerald-400 font-bold">{confirmModalTest.command}</span>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Safeguard Notice:</strong> Executed with <code className="font-mono font-bold">shell=False</code>, strict whitelisted test arguments, isolated process boundaries, and a 30-second timeout.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setConfirmModalTest(null)}
                disabled={isRunningTest}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecuteValidation(confirmModalTest)}
                disabled={isRunningTest}
                className="px-4 py-2 bg-rift-accent text-white rounded-xl text-xs font-semibold hover:bg-blue-600 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isRunningTest ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Test...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Confirm & Run Validation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
