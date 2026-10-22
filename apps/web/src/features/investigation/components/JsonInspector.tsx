import React, { useState } from 'react';
import { Copy, Check, Search, X } from 'lucide-react';

interface JsonInspectorProps {
  data: any;
  title?: string;
  isError?: boolean;
}

export const JsonInspector: React.FC<JsonInspectorProps> = ({
  data,
  title,
  isError = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState('');

  const isEmpty =
    data === undefined ||
    data === null ||
    (typeof data === 'object' && Object.keys(data).length === 0);

  const formattedJson = React.useMemo(() => {
    if (isEmpty) return '';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data, isEmpty]);

  const handleCopy = () => {
    if (isEmpty) return;
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = formattedJson.split('\n');
  const filteredLines = search
    ? lines.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
    : lines;

  return (
    <div className={`rounded-xl border overflow-hidden flex flex-col min-h-0 text-xs ${
      isError ? 'border-rose-200 bg-rose-50/20' : 'border-gray-200 bg-white shadow-subtle'
    }`}>
      {/* Top Header Bar */}
      <div className="px-3.5 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] font-semibold text-gray-800 truncate">
            {title || 'Payload'}
          </span>
          <span className="text-[10px] font-mono text-gray-500 px-1.5 py-0.2 rounded-full bg-white border border-gray-200">
            JSON
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isEmpty && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 transition shadow-subtle"
              title="Copy JSON Payload"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-gray-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Optional Search filter */}
      {!isEmpty && lines.length > 10 && (
        <div className="px-3 py-1.5 bg-gray-50/60 border-b border-gray-200 flex items-center gap-1.5 flex-shrink-0">
          <Search className="w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search within payload…"
            className="w-full bg-transparent text-[11px] font-mono text-gray-800 placeholder:text-gray-400 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-700">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Body Content */}
      <div className="flex-1 overflow-auto p-3.5 font-mono text-[11px] leading-relaxed max-h-[500px] bg-white">
        {isEmpty ? (
          <div className="p-8 text-center text-xs text-gray-400 italic">
            No data recorded for this field.
          </div>
        ) : (
          <pre
            className={`whitespace-pre ${
              isError ? 'text-rose-700' : 'text-gray-800'
            }`}
          >
            {filteredLines.join('\n')}
          </pre>
        )}
      </div>
    </div>
  );
};
