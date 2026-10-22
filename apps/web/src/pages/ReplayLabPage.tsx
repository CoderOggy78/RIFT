import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { ReplayCapabilitiesBanner } from '../components/replay/ReplayCapabilitiesBanner';
import { ReplayConfigurationCard } from '../components/replay/ReplayConfigurationCard';
import { SecurityPreviewModal } from '../components/replay/SecurityPreviewModal';
import { ReplayComparisonPanel } from '../components/replay/ReplayComparisonPanel';
import { FilesystemDiffViewer } from '../components/replay/FilesystemDiffViewer';
import { ReplayAuditManifestModal } from '../components/replay/ReplayAuditManifestModal';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Layers,
  ShieldCheck,
  AlertTriangle,
  History,
} from 'lucide-react';
import { Replay, ReplayPreview } from '../types';

export const ReplayLabPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const queryIncidentId = searchParams.get('incidentId');
  const queryOp = searchParams.get('operation') || 'delete_file';
  const queryPath = searchParams.get('path') || 'tmp/cache.json';

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(queryIncidentId || '');
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>('fixture-accidental-deletion');
  const [operationType, setOperationType] = useState<string>(queryOp);
  const [argumentsJson, setArgumentsJson] = useState<Record<string, any>>({ path: queryPath });

  const [previewData, setPreviewData] = useState<ReplayPreview | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isManifestOpen, setIsManifestOpen] = useState(false);
  const [activeReplayId, setActiveReplayId] = useState<string | null>(null);

  // 1. Fetch Capabilities
  const { data: capabilities, isLoading: isLoadingCaps } = useQuery({
    queryKey: ['replay-capabilities'],
    queryFn: () => api.getReplayCapabilities(),
  });

  // 2. Fetch Fixtures
  const { data: fixtures = [] } = useQuery({
    queryKey: ['replay-fixtures'],
    queryFn: () => api.listReplayFixtures(),
  });

  // 3. Fetch Incidents
  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents-list'],
    queryFn: () => api.listIncidents(),
  });

  // Ensure default incident selection
  React.useEffect(() => {
    if (!selectedIncidentId && incidents.length > 0) {
      setSelectedIncidentId(incidents[0].id);
    }
  }, [incidents, selectedIncidentId]);

  // 4. Fetch All Replays
  const { data: replays = [], isLoading: isLoadingReplays } = useQuery({
    queryKey: ['replays-list'],
    queryFn: () => api.listReplays(),
    refetchInterval: 3000,
  });

  // Set active replay
  const currentReplay: Replay | undefined = activeReplayId
    ? replays.find((r) => r.id === activeReplayId)
    : replays[0];

  // 5. Generate Preview Mutation
  const previewMutation = useMutation({
    mutationFn: () =>
      api.previewReplay(selectedIncidentId, {
        counterfactual_operation: operationType,
        counterfactual_arguments: argumentsJson,
        fixture_id: selectedFixtureId,
      }),
    onSuccess: (data: ReplayPreview) => {
      setPreviewData(data);
      setIsPreviewOpen(true);
    },
  });

  // 6. Execute Replay Mutation
  const executeMutation = useMutation({
    mutationFn: () =>
      api.createReplay(selectedIncidentId, {
        counterfactual_operation: operationType,
        counterfactual_arguments: argumentsJson,
        fixture_id: selectedFixtureId,
        approved_by_user: true,
      }),
    onSuccess: (newReplay: Replay) => {
      setIsPreviewOpen(false);
      setActiveReplayId(newReplay.id);
      queryClient.invalidateQueries({ queryKey: ['replays-list'] });
    },
  });

  // Compute statistics
  const totalReplays = replays.length;
  const completedReplays = replays.filter((r) => r.status === 'completed').length;
  const failedReplays = replays.filter((r) => r.status === 'failed').length;
  const verifiedCorrections = replays.filter(
    (r) => r.comparison?.conclusion === 'counterfactual_passed_original_failed'
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-rift-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-rift-accent/10 border border-rift-accent/30 text-rift-accent">
              Isolated Replay Engine
            </span>
            <span className="text-xs text-rift-muted font-mono">Counterfactual Verification</span>
          </div>
          <h1 className="text-2xl font-semibold text-rift-text tracking-tight flex items-center gap-2.5">
            <RotateCcw className="w-5 h-5 text-rift-accent" />
            <span>Counterfactual Replay Lab</span>
          </h1>
          <p className="text-xs text-rift-muted mt-1 leading-relaxed">
            Compare original failing agent actions against developer-approved corrections in isolated disposable sandboxes.
          </p>
        </div>
      </div>

      {/* Capabilities & Sandbox Status Banner */}
      <ReplayCapabilitiesBanner capabilities={capabilities} isLoading={isLoadingCaps} />

      {/* KPI Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card-antigravity p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-rift-muted block mb-1">Total Replay Sessions</span>
          <div className="text-2xl font-bold text-rift-text font-mono">{totalReplays}</div>
        </div>

        <div className="card-antigravity p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-rift-muted block mb-1">Completed Runs</span>
          <div className="text-2xl font-bold text-rift-text font-mono">{completedReplays}</div>
        </div>

        <div className="card-antigravity p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-rift-muted block mb-1">Verified Corrections</span>
          <div className="text-2xl font-bold text-rift-success font-mono">{verifiedCorrections}</div>
        </div>

        <div className="card-antigravity p-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-rift-muted block mb-1">Failed Runs</span>
          <div className="text-2xl font-bold text-rift-critical font-mono">{failedReplays}</div>
        </div>
      </div>

      {/* Replay Configuration Card */}
      <ReplayConfigurationCard
        incidents={incidents}
        selectedIncidentId={selectedIncidentId}
        onSelectIncident={setSelectedIncidentId}
        fixtures={fixtures}
        selectedFixtureId={selectedFixtureId}
        onSelectFixture={setSelectedFixtureId}
        operationType={operationType}
        onChangeOperationType={setOperationType}
        argumentsJson={argumentsJson}
        onChangeArguments={setArgumentsJson}
        onPreview={() => previewMutation.mutate()}
        isGeneratingPreview={previewMutation.isPending}
        canExecute={capabilities?.available ?? false}
      />

      {/* Active Replay Comparison & Diffs (if a replay exists) */}
      {currentReplay ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-rift-text flex items-center gap-2">
              <History className="w-4 h-4 text-rift-accent" />
              <span>Active Replay Session Results</span>
              <span className="text-xs font-mono font-normal text-rift-muted bg-rift-surface px-2 py-0.5 rounded border border-rift-border">
                {currentReplay.id}
              </span>
            </h2>

            {/* Quick Session Switcher */}
            {replays.length > 1 && (
              <select
                value={currentReplay.id}
                onChange={(e) => setActiveReplayId(e.target.value)}
                className="bg-rift-surface border border-rift-border rounded-lg px-3 py-1.5 text-xs text-rift-text focus:outline-none"
              >
                {replays.map((r) => (
                  <option key={r.id} value={r.id}>
                    Session: {r.id} ({new Date(r.created_at).toLocaleTimeString()})
                  </option>
                ))}
              </select>
            )}
          </div>

          <ReplayComparisonPanel
            replay={currentReplay}
            onOpenDiff={() => {}}
            onOpenManifest={() => setIsManifestOpen(true)}
          />

          {currentReplay.comparison && (
            <FilesystemDiffViewer
              comparison={currentReplay.comparison}
              fixtureProtectedPaths={['src/config.ts', 'src/main.ts', 'package.json']}
            />
          )}
        </div>
      ) : (
        <div className="bg-rift-surface/60 border border-dashed border-rift-border rounded-2xl p-10 text-center space-y-2">
          <RotateCcw className="w-8 h-8 text-rift-muted/40 mx-auto" />
          <h3 className="text-sm font-semibold text-rift-text">No Replay Executed Yet</h3>
          <p className="text-xs text-rift-muted max-w-md mx-auto leading-relaxed">
            Configure the original action and proposed counterfactual correction above, then click &quot;Preview Replay&quot; to inspect container boundaries and authorize isolated execution.
          </p>
        </div>
      )}

      {/* Security Preview Modal */}
      <SecurityPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        preview={previewData}
        onConfirmReplay={() => executeMutation.mutate()}
        isExecuting={executeMutation.isPending}
      />

      {/* Audit Manifest Modal */}
      {currentReplay && (
        <ReplayAuditManifestModal
          isOpen={isManifestOpen}
          onClose={() => setIsManifestOpen(false)}
          replay={currentReplay}
        />
      )}
    </div>
  );
};
