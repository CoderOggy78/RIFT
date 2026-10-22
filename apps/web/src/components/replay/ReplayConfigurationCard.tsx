import React, { useState, useEffect } from 'react';
import { ArrowRight, AlertTriangle, Shield, CheckCircle2, Play, Eye, RotateCcw } from 'lucide-react';
import { ReplayFixture, Incident } from '../../types';

interface ReplayConfigurationCardProps {
  incidents: Incident[];
  selectedIncidentId: string;
  onSelectIncident: (id: string) => void;
  fixtures: ReplayFixture[];
  selectedFixtureId: string;
  onSelectFixture: (id: string) => void;
  operationType: string;
  onChangeOperationType: (op: string) => void;
  argumentsJson: Record<string, any>;
  onChangeArguments: (args: Record<string, any>) => void;
  onPreview: () => void;
  isGeneratingPreview: boolean;
  canExecute: boolean;
}

export const ReplayConfigurationCard: React.FC<ReplayConfigurationCardProps> = ({
  incidents,
  selectedIncidentId,
  onSelectIncident,
  fixtures,
  selectedFixtureId,
  onSelectFixture,
  operationType,
  onChangeOperationType,
  argumentsJson,
  onChangeArguments,
  onPreview,
  isGeneratingPreview,
  canExecute,
}) => {
  const currentIncident = incidents.find((i) => i.id === selectedIncidentId);
  const currentFixture = fixtures.find((f) => f.fixture_id === selectedFixtureId);

  const [pathInput, setPathInput] = useState(argumentsJson.path || 'tmp/cache.json');
  const [contentInput, setContentInput] = useState(argumentsJson.content || '');
  const [sourceInput, setSourceInput] = useState(argumentsJson.source || 'tmp/old.json');
  const [destInput, setDestInput] = useState(argumentsJson.destination || 'tmp/new.json');
  const [validatorInput, setValidatorInput] = useState(argumentsJson.validator_id || 'fixture-integrity');

  // Sync state changes to parent arguments object
  useEffect(() => {
    if (operationType === 'delete_file') {
      onChangeArguments({ path: pathInput });
    } else if (operationType === 'write_file') {
      onChangeArguments({ path: pathInput, content: contentInput });
    } else if (operationType === 'move_file') {
      onChangeArguments({ source: sourceInput, destination: destInput });
    } else if (operationType === 'run_validation') {
      onChangeArguments({ validator_id: validatorInput });
    }
  }, [operationType, pathInput, contentInput, sourceInput, destInput, validatorInput]);

  return (
    <div className="card-antigravity overflow-hidden">
      <div className="px-5 py-4 border-b border-rift-border flex items-center justify-between bg-rift-base/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-rift-accent animate-pulse" />
          <h3 className="font-semibold text-rift-text text-sm">
            Counterfactual Replay Configuration
          </h3>
        </div>
        <div className="text-xs text-rift-muted font-mono">
          Fixture: <span className="font-semibold text-rift-text">{currentFixture?.title || selectedFixtureId}</span>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Original Failing Action */}
        <div className="bg-rose-50/40 border border-rose-200/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Original Failing Action
              </span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-800 font-semibold">
                Variant: Original
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-rift-muted block mb-1">Target Incident</label>
                <select
                  value={selectedIncidentId}
                  onChange={(e) => onSelectIncident(e.target.value)}
                  className="w-full bg-rift-surface border border-rift-border rounded-xl px-3 py-2 text-xs text-rift-text focus:outline-none focus:border-rose-400 shadow-sm"
                >
                  {incidents.map((inc) => (
                    <option key={inc.id} value={inc.id}>
                      {inc.title} ({inc.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-rift-muted block mb-1">Original Tool Execution</label>
                <div className="bg-rift-surface border border-rift-border rounded-xl p-3 font-mono text-xs shadow-sm">
                  <div className="text-amber-700 font-semibold mb-1">Tool: delete_file</div>
                  <div className="text-rift-text">
                    Arguments: <code className="text-rose-700 font-bold">{"{ path: 'src/config.ts' }"}</code>
                  </div>
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
                <div className="font-semibold mb-0.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Policy Violation Triggered
                </div>
                <div className="text-rose-900 text-xs leading-relaxed">
                  Action deleted protected source file <code className="text-rose-700 font-bold">src/config.ts</code>, breaking
                  build invariants.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-rose-200/60 text-xs text-rift-muted flex items-center justify-between">
            <span>Isolation: Disposable Container</span>
            <span className="text-rose-700 font-semibold">Expected: Validation Failure</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Counterfactual Correction */}
        <div className="bg-blue-50/40 border border-blue-200/80 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Counterfactual Correction
              </span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-800 font-semibold">
                Variant: Counterfactual
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-rift-muted block mb-1">Typed Operation</label>
                  <select
                    value={operationType}
                    onChange={(e) => onChangeOperationType(e.target.value)}
                    className="w-full bg-rift-surface border border-rift-border rounded-xl px-3 py-2 text-xs text-rift-text focus:outline-none focus:border-rift-accent shadow-sm"
                  >
                    <option value="delete_file">delete_file</option>
                    <option value="write_file">write_file</option>
                    <option value="move_file">move_file</option>
                    <option value="run_validation">run_validation</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-rift-muted block mb-1">Replay Fixture</label>
                  <select
                    value={selectedFixtureId}
                    onChange={(e) => onSelectFixture(e.target.value)}
                    className="w-full bg-rift-surface border border-rift-border rounded-xl px-3 py-2 text-xs text-rift-text focus:outline-none focus:border-rift-accent shadow-sm"
                  >
                    {fixtures.map((f) => (
                      <option key={f.fixture_id} value={f.fixture_id}>
                        {f.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Arguments Editor based on Operation */}
              {operationType === 'delete_file' && (
                <div>
                  <label className="text-xs font-medium text-rift-muted block mb-1">Target Relative Path</label>
                  <input
                    type="text"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    placeholder="e.g. tmp/cache.json"
                    className="w-full bg-rift-surface border border-rift-border rounded-xl px-3 py-2 text-xs text-rift-text font-mono focus:outline-none focus:border-rift-accent shadow-sm"
                  />
                  <span className="text-[10px] text-rift-muted mt-1 block">
                    Permitted: <code className="text-emerald-700 font-semibold">{currentFixture?.permitted_paths?.join(', ') || 'tmp/*'}</code>
                  </span>
                </div>
              )}

              {operationType === 'write_file' && (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs font-medium text-rift-muted block mb-1">Path</label>
                    <input
                      type="text"
                      value={pathInput}
                      onChange={(e) => setPathInput(e.target.value)}
                      placeholder="e.g. tmp/config_patch.json"
                      className="w-full bg-rift-surface border border-rift-border rounded-xl px-3 py-2 text-xs text-rift-text font-mono focus:outline-none focus:border-rift-accent shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-rift-muted block mb-1">Content (max 1MB)</label>
                    <textarea
                      rows={2}
                      value={contentInput}
                      onChange={(e) => setContentInput(e.target.value)}
                      placeholder="Enter file text content..."
                      className="w-full bg-rift-surface border border-rift-border rounded-xl px-3 py-2 text-xs text-rift-text font-mono focus:outline-none focus:border-rift-accent resize-none shadow-sm"
                    />
                  </div>
                </div>
              )}

              {operationType === 'move_file' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-rift-muted block mb-1">Source</label>
                    <input
                      type="text"
                      value={sourceInput}
                      onChange={(e) => setSourceInput(e.target.value)}
                      className="w-full bg-rift-surface border border-rift-border rounded-xl px-3 py-2 text-xs text-rift-text font-mono focus:outline-none focus:border-rift-accent shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-rift-muted block mb-1">Destination</label>
                    <input
                      type="text"
                      value={destInput}
                      onChange={(e) => setDestInput(e.target.value)}
                      className="w-full bg-rift-surface border border-rift-border rounded-xl px-3 py-2 text-xs text-rift-text font-mono focus:outline-none focus:border-rift-accent shadow-sm"
                    />
                  </div>
                </div>
              )}

              {operationType === 'run_validation' && (
                <div>
                  <label className="text-xs font-medium text-rift-muted block mb-1">Deterministic Validator</label>
                  <select
                    value={validatorInput}
                    onChange={(e) => setValidatorInput(e.target.value)}
                    className="w-full bg-rift-surface border border-rift-border rounded-xl px-3 py-2 text-xs text-rift-text focus:outline-none focus:border-rift-accent shadow-sm"
                  >
                    <option value="fixture-integrity">fixture-integrity (Source & cache invariant check)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-between">
            <button
              onClick={onPreview}
              disabled={isGeneratingPreview}
              className="px-4 py-2 bg-rift-accent hover:bg-rift-accent/90 disabled:opacity-50 text-white rounded-full text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Eye className="w-3.5 h-3.5" />
              {isGeneratingPreview ? 'Analyzing Preview...' : 'Preview Replay & Security Boundary'}
            </button>
            <span className="text-emerald-700 font-semibold text-xs">Expected: Validation Pass</span>
          </div>
        </div>
      </div>
    </div>
  );
};
