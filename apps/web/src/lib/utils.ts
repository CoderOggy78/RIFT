import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

export function formatDuration(durationMs?: number | null): string {
  if (durationMs === null || durationMs === undefined) return '—';
  if (durationMs < 1) return '<1 ms';
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(2)} s`;
  const mins = Math.floor(durationMs / 60000);
  const secs = ((durationMs % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

export function truncate(text: string, maxLen = 80): string {
  if (!text || text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}
