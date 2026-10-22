import React from 'react';
import { cn } from '../../lib/utils';
import { AlertOctagon, AlertTriangle, AlertCircle, Info, ShieldAlert } from 'lucide-react';

interface SeverityBadgeProps {
  severity: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  size = 'md',
  showIcon = true,
}) => {
  const norm = (severity || '').toLowerCase();

  let colorClasses = 'bg-gray-100 text-gray-700 border-gray-200';
  let icon = <Info className="w-3.5 h-3.5 text-gray-500" />;
  let label = severity || 'Unknown';

  if (norm === 'critical') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200 font-semibold';
    icon = <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />;
    label = 'Critical';
  } else if (norm === 'high') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
    label = 'High';
  } else if (norm === 'medium') {
    colorClasses = 'bg-yellow-50 text-yellow-800 border-yellow-200';
    icon = <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />;
    label = 'Medium';
  } else if (norm === 'low') {
    colorClasses = 'bg-sky-50 text-sky-700 border-sky-200';
    icon = <ShieldAlert className="w-3.5 h-3.5 text-sky-600" />;
    label = 'Low';
  } else if (norm === 'informational' || norm === 'info') {
    colorClasses = 'bg-gray-50 text-gray-700 border-gray-200';
    icon = <Info className="w-3.5 h-3.5 text-gray-500" />;
    label = 'Informational';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-mono select-none transition-colors shadow-subtle',
        colorClasses,
        sizeClasses
      )}
    >
      {showIcon && icon}
      <span>{label}</span>
    </span>
  );
};
