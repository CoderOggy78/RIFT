import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: 'J', description: 'Next event in chronological timeline' },
    { key: 'K', description: 'Previous event in chronological timeline' },
    { key: '/', description: 'Focus search bar in execution timeline' },
    { key: 'F', description: 'Fit execution graph to view canvas' },
    { key: 'P', description: 'Toggle Focus Execution Path (ancestors & descendants)' },
    { key: 'Esc', description: 'Clear path focus / close open dialog or inspector' },
    { key: '?', description: 'Show keyboard shortcuts reference' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-rift-surface border border-rift-border rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-rift-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rift-accent/10 border border-rift-accent/30 flex items-center justify-center text-rift-accent">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rift-text">Keyboard Shortcuts</h3>
              <p className="text-xs text-rift-muted">Investigation Workspace hotkeys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-rift-muted hover:text-rift-text hover:bg-rift-elevated transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {shortcuts.map((sc, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-rift-elevated border border-rift-border text-xs"
            >
              <span className="text-rift-text">{sc.description}</span>
              <kbd className="px-2 py-1 rounded bg-rift-bg border border-rift-border font-mono text-[11px] font-bold text-rift-accent shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 text-center">
          <p className="text-[11px] text-rift-muted">
            Hotkeys are automatically disabled while typing in text inputs or code viewers.
          </p>
        </div>
      </div>
    </div>
  );
};
