import React, { useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Focus,
  Info,
  RotateCcw,
  Sparkles,
  GitBranch,
} from 'lucide-react';

interface GraphControlsProps {
  isPathFocusActive: boolean;
  onTogglePathFocus: () => void;
  selectedEventId: string | null;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
  isPathFocusActive,
  onTogglePathFocus,
  selectedEventId,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [showLegend, setShowLegend] = useState(false);

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-full border border-gray-200 shadow-md">
      <button
        onClick={() => zoomIn()}
        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>

      <button
        onClick={() => zoomOut()}
        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <button
        onClick={() => fitView({ padding: 0.2, duration: 400 })}
        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition"
        title="Fit View"
      >
        <Focus className="w-4 h-4" />
      </button>

      <div className="w-[1px] h-4 bg-gray-200 mx-0.5" />

      {/* Focus Execution Path */}
      <button
        onClick={onTogglePathFocus}
        disabled={!selectedEventId}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border transition ${
          isPathFocusActive
            ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
            : selectedEventId
            ? 'text-gray-700 hover:bg-gray-100 border-gray-200'
            : 'text-gray-300 border-transparent cursor-not-allowed'
        }`}
        title={
          selectedEventId
            ? isPathFocusActive
              ? 'Clear path focus'
              : 'Focus ancestor & descendant path'
            : 'Select an event to focus its execution path'
        }
      >
        <GitBranch className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">
          {isPathFocusActive ? 'Focused' : 'Focus Path'}
        </span>
      </button>

      {/* Fullscreen Toggle */}
      <button
        onClick={onToggleFullscreen}
        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition"
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Graph'}
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>

      {/* Legend Toggle */}
      <div className="relative">
        <button
          onClick={() => setShowLegend(!showLegend)}
          className={`p-1.5 rounded-full transition ${
            showLegend
              ? 'text-rift-accent bg-blue-50 border border-blue-200'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
          }`}
          title="Edge & Node Semantics Legend"
        >
          <Info className="w-4 h-4" />
        </button>

        {showLegend && (
          <div className="absolute right-0 top-11 w-72 bg-white border border-gray-200 rounded-2xl p-4 shadow-xl z-20 space-y-3 text-xs animate-in fade-in duration-150">
            <div className="font-semibold text-gray-900 font-mono text-[11px] uppercase tracking-wider flex items-center justify-between border-b border-gray-100 pb-2">
              <span>Graph Semantics</span>
              <span className="text-[10px] text-gray-400 font-normal">RIFT DAG</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <span className="w-4 h-[2px] bg-gray-400 mt-2 flex-shrink-0" />
                <div>
                  <span className="font-mono text-gray-900 text-[11px] font-semibold block">Parent-Child</span>
                  <span className="text-[10px] text-gray-500">Observed telemetry span hierarchy</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-4 h-[2px] bg-blue-600 mt-2 flex-shrink-0" />
                <div>
                  <span className="font-mono text-blue-700 text-[11px] font-semibold block">Tool Execution</span>
                  <span className="text-[10px] text-gray-500">Explicit tool_call to tool_result pairing</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-4 h-[2px] border-b-2 border-dashed border-amber-500 mt-2 flex-shrink-0" />
                <div>
                  <span className="font-mono text-amber-700 text-[11px] font-semibold block">Validation Dependency</span>
                  <span className="text-[10px] text-gray-500">Action verified by downstream validation</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-4 h-[2px] border-b-2 border-dashed border-rose-500 mt-2 flex-shrink-0" />
                <div>
                  <span className="font-mono text-rose-700 text-[11px] font-semibold block">Inferred Causal (Flagged)</span>
                  <span className="text-[10px] text-gray-500">Suspected cause linked to failure</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
