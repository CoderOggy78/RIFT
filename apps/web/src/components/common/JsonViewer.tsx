import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  title?: string;
  maxHeight?: string;
  isError?: boolean;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  title,
  maxHeight = 'max-h-96',
  isError = false,
}) => {
  const [copied, setCopied] = useState(false);

  const formattedJson = React.useMemo(() => {
    try {
      if (data === undefined || data === null) return 'null';
      if (typeof data === 'string') {
        try {
          return JSON.stringify(JSON.parse(data), null, 2);
        } catch {
          return data;
        }
      }
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const isEmpty =
    !data ||
    (typeof data === 'object' && Object.keys(data).length === 0) ||
    formattedJson === '{}' ||
    formattedJson === '[]';

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Syntax highlighting for JSON (High-contrast, light theme Google Antigravity aesthetic)
  const renderHighlightedJson = (json: string) => {
    if (isEmpty) {
      return <span className="text-gray-400 italic">Empty payload</span>;
    }

    const lines = json.split('\n');
    return lines.map((line, idx) => {
      const highlighted = line.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          let cls = 'text-purple-700'; // number default
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = 'text-blue-700 font-medium'; // key
            } else {
              cls = isError ? 'text-rose-700' : 'text-emerald-700'; // string value
            }
          } else if (/true|false/.test(match)) {
            cls = 'text-amber-700 font-semibold'; // boolean
          } else if (/null/.test(match)) {
            cls = 'text-gray-400 italic'; // null
          }
          return `<span class="${cls}">${match}</span>`;
        }
      );

      return (
        <div key={idx} className="table-row leading-relaxed">
          <span className="table-cell pr-4 text-right select-none text-gray-400 text-xs font-mono">
            {idx + 1}
          </span>
          <span
            className="table-cell font-mono text-xs whitespace-pre text-gray-800"
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </div>
      );
    });
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isError
          ? 'border-rose-200 bg-rose-50/30'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between px-3.5 py-2 bg-gray-50 border-b border-gray-200">
        <span
          className={`text-xs font-mono font-medium uppercase tracking-wider ${
            isError ? 'text-rose-700' : 'text-gray-600'
          }`}
        >
          {title || 'Payload'}
        </span>
        <button
          onClick={handleCopy}
          disabled={isEmpty}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 px-2 py-0.5 rounded hover:bg-gray-200/60 transition disabled:opacity-40"
          title="Copy JSON"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className={`p-3.5 overflow-auto font-mono text-xs ${maxHeight} bg-white`}>
        <div className="table w-full">{renderHighlightedJson(formattedJson)}</div>
      </div>
    </div>
  );
};
