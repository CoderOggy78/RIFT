import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Disc } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
}) => {
  const normalized = (status || '').toLowerCase();

  let colorClasses = 'bg-gray-100 text-gray-700 border-gray-200';
  let icon = <Disc className="w-3.5 h-3.5 text-gray-500" />;
  let label = status;

  if (normalized === 'success' || normalized === 'completed' || normalized === 'healthy') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    label = normalized === 'healthy' ? 'Healthy' : 'Success';
  } else if (normalized === 'error' || normalized === 'failed' || normalized === 'failure') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
    icon = <XCircle className="w-3.5 h-3.5 text-rose-600" />;
    label = 'Failed';
  } else if (normalized === 'running' || normalized === 'pending') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
    icon = <Clock className="w-3.5 h-3.5 text-blue-600 animate-spin" />;
    label = normalized === 'running' ? 'Running' : 'Pending';
  } else if (normalized === 'warning') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
    label = 'Warning';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border font-mono select-none shadow-subtle',
        colorClasses,
        sizeClasses
      )}
    >
      {showIcon && icon}
      <span>{label}</span>
    </span>
  );
};
