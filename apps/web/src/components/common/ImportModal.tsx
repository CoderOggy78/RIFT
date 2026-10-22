import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  X,
  UploadCloud,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { isOtlpPayload, otlpToRiftPayload } from '../../utils/otlpAdapter';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedPreview, setParsedPreview] = useState<{
    traceId: string;
    objective: string;
    spanCount: number;
    agentName: string;
    projectName: string;
    rawPayload: any;
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const resetState = () => {
    setSelectedFile(null);
    setParsedPreview(null);
    setParseError(null);
  };

  const importMutation = useMutation({
    mutationFn: async (payload: any) => {
      return api.importTrace(payload, true);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['traces-overview'] });
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
      onClose();
      resetState();
      navigate(`/traces/${data.trace_id}`);
    },
  });

  const demoMutation = useMutation({
    mutationFn: async () => {
      return api.loadSyntheticDemo();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['traces-overview'] });
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
      queryClient.invalidateQueries({ queryKey: ['demo-status'] });
      onClose();
      resetState();
      if (data.incident_id) {
        navigate(`/incidents/${data.incident_id}`);
      } else {
        navigate(`/investigations/${data.trace_id}`);
      }
    },
  });

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    setSelectedFile(file);
    setParseError(null);
    setParsedPreview(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let data = JSON.parse(text);

        // Check if payload is OpenTelemetry (OTLP) format
        if (isOtlpPayload(data)) {
          const normalizedPayload = otlpToRiftPayload(data, file.name);
          if (!normalizedPayload.spans || normalizedPayload.spans.length === 0) {
            setParseError('No execution spans found in OpenTelemetry trace file.');
            return;
          }
          setParsedPreview({
            traceId: normalizedPayload.trace.id,
            objective: normalizedPayload.trace.objective,
            spanCount: normalizedPayload.spans.length,
            agentName: normalizedPayload.agent.name,
            projectName: normalizedPayload.project.name,
            rawPayload: normalizedPayload,
          });
          return;
        }

        // Handle array of spans directly
        const rawSpans = Array.isArray(data)
          ? data
          : Array.isArray(data.spans)
          ? data.spans
          : Array.isArray(data.trace?.spans)
          ? data.trace.spans
          : [];

        // Flexible field resolution (supporting nested RIFT format or flat OpenTelemetry/agent formats)
        const traceId =
          data.trace?.id ||
          data.trace_id ||
          data.id ||
          file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_') ||
          `trace-${Date.now().toString(36)}`;

        const objective =
          data.trace?.objective ||
          data.objective ||
          data.trace_objective ||
          data.task ||
          data.description ||
          `Execution trace from ${file.name}`;

        const projectName =
          data.project?.name ||
          data.project_name ||
          (typeof data.project === 'string' ? data.project : 'Agent Repository');

        const projectId =
          data.project?.id ||
          data.project_id ||
          'proj-main';

        const agentName =
          data.agent?.name ||
          data.agent_name ||
          (typeof data.agent === 'string' ? data.agent : 'Autonomous Agent');

        const agentId =
          data.agent?.id ||
          data.agent_id ||
          'agent-001';

        const agentFramework =
          data.agent?.framework ||
          data.agent_framework ||
          'OpenTelemetry / Agent API';

        const traceStatus = data.trace?.status || data.status || 'success';
        const startedAt =
          data.trace?.started_at ||
          data.started_at ||
          (rawSpans.length > 0 && rawSpans[0].timestamp ? rawSpans[0].timestamp : new Date().toISOString());
        const endedAt =
          data.trace?.ended_at ||
          data.ended_at ||
          (rawSpans.length > 0 && rawSpans[rawSpans.length - 1].timestamp
            ? rawSpans[rawSpans.length - 1].timestamp
            : undefined);

        // Normalize each span to fulfill SpanImportInput schema requirements
        const normalizedSpans = rawSpans.map((span: any, index: number) => ({
          id: span.id || span.span_id || `span-${index + 1}`,
          parent_span_id: span.parent_span_id || null,
          name: span.name || span.operation_name || span.tool_name || `event_${index + 1}`,
          event_type: span.event_type || 'tool_call',
          status: span.status || 'success',
          timestamp: span.timestamp || startedAt,
          duration_ms: typeof span.duration_ms === 'number' ? span.duration_ms : 50.0,
          input_data: span.input_data || span.input || span.args || span.arguments || {},
          output_data: span.output_data || span.output || span.result || {},
          error_data: span.error_data || span.error || {},
          metadata: span.metadata || span.attributes || {},
        }));

        if (normalizedSpans.length === 0) {
          setParseError('No execution spans found in JSON file. Ensure file contains a valid "spans" array or OpenTelemetry "resourceSpans".');
          return;
        }

        const normalizedPayload = {
          project: {
            id: projectId,
            name: projectName,
            description: data.project?.description || '',
          },
          agent: {
            id: agentId,
            name: agentName,
            framework: agentFramework,
          },
          trace: {
            id: traceId,
            objective: objective,
            status: traceStatus,
            started_at: startedAt,
            ended_at: endedAt,
          },
          spans: normalizedSpans,
        };

        setParsedPreview({
          traceId,
          objective,
          spanCount: normalizedSpans.length,
          agentName,
          projectName,
          rawPayload: normalizedPayload,
        });
      } catch (err: any) {
        setParseError(err.message || 'Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const isLoading = importMutation.isPending || demoMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl shadow-modal overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Import Execution Trace</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Upload an OpenTelemetry/GenAI structured trace JSON file
            </p>
          </div>
          <button
            onClick={() => {
              onClose();
              resetState();
            }}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Quick Demo Import Banner */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">
                  Synthetic Demonstration Fixture
                </p>
                <p className="text-xs text-gray-600 font-mono mt-0.5">
                  fixtures/incidents/accidental-deletion.json
                </p>
              </div>
            </div>
            <button
              onClick={() => demoMutation.mutate()}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs font-medium bg-[#1A73E8] hover:bg-[#1557B0] text-white rounded-full transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 shadow-sm"
            >
              {demoMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              Load Demo
            </button>
          </div>

          {/* Drag & drop area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center ${
              dragActive
                ? 'border-blue-500 bg-blue-50/50'
                : selectedFile
                ? 'border-gray-300 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
            />

            <UploadCloud className="w-10 h-10 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-900">
              {selectedFile ? selectedFile.name : 'Click to browse or drag & drop JSON trace'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports standard RIFT structured trace format (max 10MB)
            </p>
          </div>

          {/* Parse error alert */}
          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Import API error alert */}
          {importMutation.isError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{importMutation.error.message}</span>
            </div>
          )}

          {/* Validated preview card */}
          {parsedPreview && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono">
                <span className="text-gray-500">Trace ID:</span>
                <span className="text-blue-600 font-semibold">{parsedPreview.traceId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Project:</span>
                <span className="text-gray-900 font-medium">{parsedPreview.projectName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Agent:</span>
                <span className="text-gray-900 font-medium">{parsedPreview.agentName}</span>
              </div>
              <div className="flex items-center justify-between font-mono">
                <span className="text-gray-500">Spans Count:</span>
                <span className="text-emerald-700 font-semibold">{parsedPreview.spanCount} events</span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <p className="text-gray-500 mb-1">Objective:</p>
                <p className="text-gray-800 italic bg-white p-2.5 rounded-lg border border-gray-200">
                  "{parsedPreview.objective}"
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/50">
          <button
            type="button"
            onClick={() => {
              onClose();
              resetState();
            }}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 rounded-full hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!parsedPreview || isLoading}
            onClick={() => {
              if (parsedPreview?.rawPayload) {
                importMutation.mutate(parsedPreview.rawPayload);
              }
            }}
            className="px-5 py-2 text-xs font-medium bg-[#1A73E8] hover:bg-[#1557B0] text-white rounded-full transition flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Ingesting...</span>
              </>
            ) : (
              <span>Commit & Ingest Trace</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
