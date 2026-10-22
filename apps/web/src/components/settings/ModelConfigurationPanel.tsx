import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  Shield,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Cloud,
  ExternalLink,
  Save,
  Check,
} from 'lucide-react';
import { ModelStatus, ModelTestResult, ModelSettingsUpdate } from '../../types';
import { api } from '../../lib/api';

interface ModelConfigurationPanelProps {
  modelStatus?: ModelStatus;
  refetchModel: () => void;
  isModelFetching: boolean;
}

export const ModelConfigurationPanel: React.FC<ModelConfigurationPanelProps> = ({
  modelStatus,
  refetchModel,
  isModelFetching,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>(
    modelStatus?.configured_model || 'gemma4:e2b'
  );
  const [provider, setProvider] = useState<'local' | 'cloud'>(
    (modelStatus?.provider as 'local' | 'cloud') || 'local'
  );
  const [apiKey, setApiKey] = useState<string>('');
  const [cloudConsent, setCloudConsent] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isTestingModel, setIsTestingModel] = useState<boolean>(false);
  const [modelTestResult, setModelTestResult] = useState<ModelTestResult | null>(null);

  useEffect(() => {
    if (modelStatus?.configured_model) {
      setSelectedModel(modelStatus.configured_model);
    }
    if (modelStatus?.provider === 'cloud' || modelStatus?.provider === 'local') {
      setProvider(modelStatus.provider);
    }
  }, [modelStatus]);

  const installedModels = modelStatus?.available_models || [];
  const isSelectedModelInstalled = installedModels.some(
    (m) =>
      m === selectedModel ||
      m.startsWith(`${selectedModel}:`) ||
      selectedModel.startsWith(`${m}:`)
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    if (provider === 'cloud' && !cloudConsent) {
      setSaveError('Cloud inference requires explicit user consent before saving.');
      setIsSaving(false);
      return;
    }

    try {
      const payload: ModelSettingsUpdate = {
        model_name: selectedModel,
        provider,
        api_key: provider === 'cloud' && apiKey ? apiKey : undefined,
        cloud_consent_acknowledged: provider === 'cloud' ? cloudConsent : false,
      };

      const res = await api.updateModelSettings(payload);
      setSaveMessage(res.message);
      refetchModel();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to update model settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestInference = async () => {
    setIsTestingModel(true);
    setModelTestResult(null);
    try {
      const res = await api.testModelConnection();
      setModelTestResult(res);
      refetchModel();
    } catch (err: any) {
      setModelTestResult({
        success: false,
        status: 'connection_error',
        message: err?.message || 'Inference test failed',
        setup_instructions:
          'Ensure Ollama service is active: `brew services start ollama` and model is installed: `ollama pull ' +
          selectedModel +
          '`',
      });
    } finally {
      setIsTestingModel(false);
    }
  };

  const hw = modelStatus?.hardware_info;

  return (
    <div className="card-antigravity p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-rift-border pb-4">
        <div className="flex items-center gap-2.5 text-rift-text font-semibold text-sm">
          <Cpu className="w-4 h-4 text-purple-600" />
          <span>Google Gemma 4 Inference Engine & Hardware Profile</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTestInference}
            disabled={isTestingModel || isModelFetching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-purple-200 bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-800 transition disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingModel ? 'animate-spin' : ''}`} />
            <span>{isTestingModel ? 'Testing...' : 'Test Inference'}</span>
          </button>
        </div>
      </div>

      {/* Hardware Profile Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border">
          <span className="text-rift-muted text-[11px] block">Detected Chip</span>
          <span className="font-mono text-rift-text font-semibold">
            {hw?.chip || 'Apple Silicon'}
          </span>
        </div>
        <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border">
          <span className="text-rift-muted text-[11px] block">Unified Memory</span>
          <span className="font-mono text-rift-text font-semibold">
            {hw?.memory_total_gb ? `${hw.memory_total_gb} GB Unified` : '16 GB RAM'}
          </span>
        </div>
        <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border">
          <span className="text-rift-muted text-[11px] block">Operating System</span>
          <span className="font-mono text-rift-text font-semibold">
            {hw?.os || 'macOS'} {hw?.os_version || '27.0.1'}
          </span>
        </div>
        <div className="p-3 bg-rift-base/50 rounded-xl border border-rift-border">
          <span className="text-rift-muted text-[11px] block">Ollama Version</span>
          <span className="font-mono text-rift-text font-semibold">
            {modelStatus?.ollama_version ? `v${modelStatus.ollama_version}` : 'v0.40.6'}
          </span>
        </div>
      </div>

      {/* Provider Selection */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-rift-text block">Inference Provider</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <button
            type="button"
            onClick={() => setProvider('local')}
            className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition ${
              provider === 'local'
                ? 'border-purple-300 bg-purple-50/70 text-rift-text shadow-sm'
                : 'border-rift-border bg-rift-surface text-rift-muted hover:border-rift-border-hover'
            }`}
          >
            <Cpu className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-xs flex items-center gap-1.5 text-rift-text">
                <span>Local Ollama</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                  Air-Gapped
                </span>
              </div>
              <p className="text-[11px] text-rift-muted mt-1 leading-relaxed">
                Executes Google Gemma 4 directly on your Mac. Telemetry and incident traces never leave your machine.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setProvider('cloud')}
            className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition ${
              provider === 'cloud'
                ? 'border-blue-300 bg-blue-50/70 text-rift-text shadow-sm'
                : 'border-rift-border bg-rift-surface text-rift-muted hover:border-rift-border-hover'
            }`}
          >
            <Cloud className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-xs flex items-center gap-1.5 text-rift-text">
                <span>Ollama Cloud</span>
                <span className="px-2 py-0.2 rounded-full text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-mono font-bold">
                  Cloud Hosted
                </span>
              </div>
              <p className="text-[11px] text-rift-muted mt-1 leading-relaxed">
                Optional hosted inference via Ollama Cloud. Requires explicit consent & user API key.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Cloud Consent Notice if Cloud Selected */}
      {provider === 'cloud' && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Cloud Inference Authorization Required</span>
          </div>
          <p className="text-amber-800 text-[11px] leading-relaxed">
            Incident traces and execution logs may contain sensitive environment variables, internal paths, or code snippets. RIFT defaults to air-gapped local execution. To use cloud inference, you must explicitly consent below and supply your personal API key from{' '}
            <a
              href="https://ollama.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-amber-900 font-semibold hover:text-amber-950 inline-flex items-center gap-0.5"
            >
              ollama.com/settings/keys <ExternalLink className="w-3 h-3" />
            </a>
            . RIFT will never create or manage accounts on your behalf.
          </p>

          <div className="space-y-2 pt-2 border-t border-amber-200">
            <label className="text-[11px] font-mono text-rift-muted block">Ollama Cloud API Key</label>
            <input
              type="password"
              placeholder="ollama_api_..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono text-rift-text focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={cloudConsent}
              onChange={(e) => setCloudConsent(e.target.checked)}
              className="mt-0.5 rounded border-amber-400 bg-white text-purple-600 focus:ring-0"
            />
            <span className="text-[11px] text-amber-900 font-medium leading-relaxed">
              I acknowledge that incident traces contain technical telemetry and explicitly authorize sending evidence packages to Ollama Cloud for inference.
            </span>
          </label>
        </div>
      )}

      {/* Model Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-rift-text block">Model Selection</label>
          <span className="text-[11px] font-mono text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 font-medium">
            Only downloaded models available to activate
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Gemma 4 E2B (Default) */}
          {(() => {
            const isDownloaded = installedModels.includes('gemma4:e2b') || installedModels.some((m) => m.startsWith('gemma4:e2b'));
            return (
              <div
                onClick={() => {
                  if (isDownloaded) {
                    setSelectedModel('gemma4:e2b');
                    setSaveError(null);
                  }
                }}
                className={`p-4 rounded-2xl border transition ${
                  isDownloaded ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                } ${
                  selectedModel === 'gemma4:e2b'
                    ? 'border-purple-300 bg-purple-50/60 text-rift-text shadow-sm'
                    : 'border-rift-border bg-rift-surface text-rift-muted hover:border-rift-border-hover'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-purple-800">gemma4:e2b</span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-100 text-purple-800 border border-purple-200 font-bold">
                      Default
                    </span>
                    {isDownloaded ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                        Not Downloaded
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-rift-muted mt-2 leading-relaxed font-sans">
                  Effective 2B edge parameter architecture. Highly optimized for Apple Silicon Macs with 16 GB RAM. Fast reasoning and low memory overhead.
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] font-mono pt-2 border-t border-rift-border/50">
                  <span className="text-rift-muted">Size: ~7.4 GB</span>
                  <span className="text-emerald-700 font-semibold">Available for inference</span>
                </div>
              </div>
            );
          })()}

          {/* Gemma 4 E4B (Optional Higher Quality - Only selectable if downloaded) */}
          {(() => {
            const isDownloaded = installedModels.includes('gemma4:e4b') || installedModels.some((m) => m.startsWith('gemma4:e4b'));
            return (
              <div
                onClick={() => {
                  if (isDownloaded) {
                    setSelectedModel('gemma4:e4b');
                    setSaveError(null);
                  } else {
                    setSaveError("Model 'gemma4:e4b' is not downloaded. Only downloaded models can be made available. Run `ollama pull gemma4:e4b` in terminal with approval to make it available.");
                  }
                }}
                className={`p-4 rounded-2xl border transition ${
                  isDownloaded ? 'cursor-pointer' : 'cursor-not-allowed opacity-60 bg-rift-base/30 border-dashed border-rift-border'
                } ${
                  selectedModel === 'gemma4:e4b'
                    ? 'border-purple-300 bg-purple-50/60 text-rift-text shadow-sm'
                    : 'border-rift-border bg-rift-surface text-rift-muted'
                }`}
                title={!isDownloaded ? "Model not downloaded. Run 'ollama pull gemma4:e4b' to make available." : undefined}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-purple-800">gemma4:e4b</span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-100 text-blue-800 border border-blue-200 font-bold">
                      Enhanced
                    </span>
                    {isDownloaded ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                        Not Downloaded
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-rift-muted mt-2 leading-relaxed font-sans">
                  Effective 4B parameter architecture. Enhanced causal hypothesis generation for complex multi-agent execution traces.
                </p>
                <div className="mt-3 flex items-center justify-between text-[10px] font-mono pt-2 border-t border-rift-border/50">
                  <span className="text-rift-muted">Size: ~9.6 GB</span>
                  {isDownloaded ? (
                    <span className="text-emerald-700 font-semibold">Available for inference</span>
                  ) : (
                    <span className="text-amber-700 font-mono">Unavailable (requires pull)</span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Other Installed Models in Ollama */}
        {installedModels.length > 0 && (
          <div className="pt-2">
            <span className="text-[11px] text-rift-muted font-mono block mb-1.5">
              Detected Installed Models on Local Server:
            </span>
            <div className="flex flex-wrap gap-2">
              {installedModels.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedModel(m)}
                  className={`px-3 py-1 rounded-full font-mono text-[11px] transition flex items-center gap-1.5 ${
                    selectedModel === m
                      ? 'bg-purple-100 text-purple-800 border border-purple-300 font-bold'
                      : 'bg-rift-base border border-rift-border text-rift-muted hover:text-rift-text'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{m}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save Button & Messages */}
      <div className="flex items-center justify-between pt-4 border-t border-rift-border">
        <div className="text-xs">
          {saveMessage && (
            <span className="text-emerald-700 font-mono flex items-center gap-1.5 font-semibold">
              <Check className="w-3.5 h-3.5" />
              {saveMessage}
            </span>
          )}
          {saveError && (
            <span className="text-rose-700 font-mono flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {saveError}
            </span>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-rift-accent hover:bg-rift-accent/90 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Applying...' : 'Apply Configuration'}</span>
        </button>
      </div>

      {/* Test Connection Output Box */}
      {modelTestResult && (
        <div
          className={`p-4 rounded-2xl border font-mono text-xs space-y-1.5 shadow-sm ${
            modelTestResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center justify-between font-bold">
            <span>Inference Test: {modelTestResult.success ? 'PASSED' : 'FAILED'}</span>
            {modelTestResult.duration_ms && (
              <span className="text-[11px] text-rift-muted">{modelTestResult.duration_ms}ms roundtrip</span>
            )}
          </div>
          <p className="text-[11px] leading-relaxed font-sans">{modelTestResult.message}</p>
          {modelTestResult.response_snippet && (
            <div className="p-3 bg-white rounded-xl border border-rift-border text-[11px] whitespace-pre-wrap text-rift-text">
              Output: {modelTestResult.response_snippet}
            </div>
          )}
        </div>
      )}

      {/* Actionable Setup Instructions when Unavailable */}
      {modelStatus?.setup_instructions && !modelTestResult?.success && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2 text-xs">
          <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-600" />
            <span>Actionable Setup Guidance</span>
          </div>
          <pre className="text-[11px] font-mono text-amber-900 whitespace-pre-wrap bg-white p-3 rounded-xl border border-amber-200">
            {typeof modelStatus.setup_instructions === 'string'
              ? modelStatus.setup_instructions
              : JSON.stringify(modelStatus.setup_instructions, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
