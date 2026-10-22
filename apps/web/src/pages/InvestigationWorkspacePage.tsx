import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { InvestigationWorkspace } from '../features/investigation/components/InvestigationWorkspace';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

export const InvestigationWorkspacePage: React.FC = () => {
  const { traceId } = useParams<{ traceId: string }>();
  const queryClient = useQueryClient();

  const {
    data: trace,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['trace-detail', traceId],
    queryFn: () => (traceId ? api.getTrace(traceId) : Promise.reject('No trace ID')),
    enabled: !!traceId,
  });

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-rift-bg text-rift-text">
        <Loader2 className="w-8 h-8 animate-spin text-rift-accent mb-3" />
        <p className="text-sm font-medium">Loading Investigation Workspace...</p>
        <span className="font-mono text-xs text-rift-muted mt-1">{traceId}</span>
      </div>
    );
  }

  if (isError || !trace) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-rift-bg text-rift-text p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rift-critical/10 border border-rift-critical/30 flex items-center justify-center text-rift-critical mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-rift-text mb-1">Trace Not Found</h2>
        <p className="text-xs text-rift-muted max-w-sm mb-6">
          The requested trace <code className="font-mono text-rift-accent">{traceId}</code> does not exist or has been removed from the database.
        </p>
        <div className="flex items-center gap-3">
          <Link
            to="/investigations"
            className="px-4 py-2 rounded-xl bg-rift-elevated border border-rift-border hover:border-rift-border-hover text-xs font-semibold text-rift-text flex items-center gap-2 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Investigations</span>
          </Link>
          <Link
            to="/traces"
            className="px-4 py-2 rounded-xl bg-rift-accent hover:bg-rift-accent-hover text-xs font-semibold text-rift-bg transition"
          >
            Browse Traces
          </Link>
        </div>
      </div>
    );
  }

  return (
    <InvestigationWorkspace
      trace={trace}
      onRefreshTrace={() => {
        queryClient.invalidateQueries({ queryKey: ['trace-detail', traceId] });
        refetch();
      }}
    />
  );
};
