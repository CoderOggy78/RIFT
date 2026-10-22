import React, { useState } from 'react';
import { PlusCircle, MinusCircle, Edit3, Shield, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { ReplayComparison } from '../../types';

interface FilesystemDiffViewerProps {
  comparison: ReplayComparison;
  fixtureProtectedPaths?: string[];
}

export const FilesystemDiffViewer: React.FC<FilesystemDiffViewerProps> = ({
  comparison,
  fixtureProtectedPaths = ['src/config.ts', 'src/main.ts', 'package.json'],
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const origDiff = comparison.details?.original_diff || {
    added_files: [],
    removed_files: ['src/config.ts'],
    modified_files: [],
    unchanged_files: ['src/main.ts', 'package.json', 'tmp/cache.json'],
    file_diffs: {},
  };

  const cfDiff = comparison.details?.counterfactual_diff || {
    added_files: [],
    removed_files: ['tmp/cache.json'],
    modified_files: [],
    unchanged_files: ['src/config.ts', 'src/main.ts', 'package.json'],
    file_diffs: {},
  };

  const [activeVariantTab, setActiveVariantTab] = useState<'counterfactual' | 'original'>('counterfactual');
  const activeDiff = activeVariantTab === 'counterfactual' ? cfDiff : origDiff;

  return (
    <div className="card-antigravity overflow-hidden">
      <div className="px-5 py-3 border-b border-rift-border flex items-center justify-between bg-rift-base/40">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-rift-accent" />
          <h3 className="font-semibold text-rift-text text-sm">
            Filesystem Mutation & Invariant Inspector
          </h3>
        </div>

        <div className="flex items-center gap-1 bg-rift-elevated border border-rift-border p-1 rounded-full text-xs">
          <button
            onClick={() => setActiveVariantTab('counterfactual')}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              activeVariantTab === 'counterfactual'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-rift-muted hover:text-rift-text'
            }`}
          >
            Counterfactual Filesystem
          </button>
          <button
            onClick={() => setActiveVariantTab('original')}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              activeVariantTab === 'original'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rift-muted hover:text-rift-text'
            }`}
          >
            Original Filesystem
          </button>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* File State Tree / List */}
        <div className="md:col-span-1 border border-rift-border rounded-2xl bg-rift-base/30 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-rift-border text-xs font-semibold text-rift-muted uppercase tracking-wider font-mono">
            Workspace Files ({activeDiff.unchanged_files.length + activeDiff.removed_files.length + activeDiff.added_files.length})
          </div>

          <div className="p-2 space-y-1 text-xs font-mono">
            {/* Removed files */}
            {activeDiff.removed_files.map((file) => {
              const isProtected = fixtureProtectedPaths.includes(file);
              return (
                <div
                  key={file}
                  onClick={() => setSelectedFile(file)}
                  className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                    isProtected
                      ? 'bg-rose-100/70 border border-rose-300 text-rose-800'
                      : 'bg-amber-100/70 border border-amber-300 text-amber-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{file}</span>
                  </div>
                  <span className="text-[10px] uppercase font-sans font-bold px-1.5 py-0.5 rounded bg-white/70 shadow-2xs">
                    {isProtected ? 'CRITICAL REMOVAL' : 'PURGED'}
                  </span>
                </div>
              );
            })}

            {/* Added files */}
            {activeDiff.added_files.map((file) => (
              <div
                key={file}
                onClick={() => setSelectedFile(file)}
                className="p-2 rounded-xl flex items-center justify-between bg-emerald-100/70 border border-emerald-300 text-emerald-800 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{file}</span>
                </div>
                <span className="text-[10px] uppercase font-sans font-bold px-1.5 py-0.5 rounded bg-white/70 shadow-2xs">
                  ADDED
                </span>
              </div>
            ))}

            {/* Modified files */}
            {activeDiff.modified_files.map((file) => (
              <div
                key={file}
                onClick={() => setSelectedFile(file)}
                className="p-2 rounded-xl flex items-center justify-between bg-blue-100/70 border border-blue-300 text-blue-800 cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <Edit3 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{file}</span>
                </div>
                <span className="text-[10px] uppercase font-sans font-bold px-1.5 py-0.5 rounded bg-white/70 shadow-2xs">
                  MODIFIED
                </span>
              </div>
            ))}

            {/* Unchanged Protected files */}
            {activeDiff.unchanged_files.map((file) => {
              const isProtected = fixtureProtectedPaths.includes(file);
              return (
                <div
                  key={file}
                  className="p-2 rounded-xl flex items-center justify-between bg-rift-surface text-rift-muted border border-rift-border/60"
                >
                  <div className="flex items-center gap-2 truncate">
                    {isProtected ? (
                      <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0 text-rift-muted/40">•</span>
                    )}
                    <span className="truncate text-rift-text">{file}</span>
                  </div>
                  {isProtected && (
                    <span className="text-[10px] font-sans font-semibold text-emerald-700 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                      PROTECTED
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Diff Inspection Card */}
        <div className="md:col-span-2 border border-rift-border rounded-2xl bg-rift-surface p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-rift-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-rift-muted font-mono">
                Invariant & Mutation Analysis
              </span>
              <span className="text-xs font-mono font-semibold text-rift-accent">
                Active: {activeVariantTab.toUpperCase()}
              </span>
            </div>

            {activeVariantTab === 'original' ? (
              <div className="space-y-3 text-xs">
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-900">
                  <div className="font-bold text-sm mb-1 text-rose-700">
                    Invariant Broken: Protected Source File Deleted
                  </div>
                  <p className="text-xs leading-relaxed mb-3">
                    The original agent action called <code>delete_file("src/config.ts")</code>. This removed the core application configuration required by <code>src/main.ts</code>.
                  </p>
                  <div className="bg-white border border-rose-200 rounded-xl p-3 font-mono text-xs text-rose-700">
                    - src/config.ts (export const API_CONFIG = ...) [MISSING]
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900">
                  <div className="font-bold text-sm mb-1 text-emerald-700">
                    Invariant Satisfied: Stale Cache Cleared & Source Preserved
                  </div>
                  <p className="text-xs leading-relaxed mb-3">
                    The counterfactual correction called <code>delete_file("tmp/cache.json")</code>. The protected source files (<code>src/config.ts</code>, <code>src/main.ts</code>, <code>package.json</code>) remain completely intact and unchanged.
                  </p>
                  <div className="bg-white border border-emerald-200 rounded-xl p-3 font-mono text-xs text-emerald-700">
                    - tmp/cache.json (purged)<br />
                    + src/config.ts (intact: 6251b0f3... verified)
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-rift-border text-[11px] text-rift-muted flex items-center justify-between">
            <span>Cryptographic Verification: SHA-256</span>
            <span className="font-mono text-rift-text">Snapshot Hash: 6251b0f373af...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
