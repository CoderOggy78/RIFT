import React from 'react';
import { cn } from '../../lib/utils';
import {
  MessageSquare,
  Compass,
  Cpu,
  Wrench,
  CheckSquare,
  ShieldAlert,
  Terminal,
} from 'lucide-react';

interface EventTypeBadgeProps {
  eventType: string;
  size?: 'sm' | 'md';
}

export const EventTypeBadge: React.FC<EventTypeBadgeProps> = ({ eventType, size = 'md' }) => {
  const type = (eventType || '').toLowerCase();

  let colorClasses = 'bg-gray-50 text-gray-700 border-gray-200';
  let icon = <Terminal className="w-3 h-3 text-gray-500" />;
  let label = eventType;

  switch (type) {
    case 'user_prompt':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      icon = <MessageSquare className="w-3 h-3 text-blue-600" />;
      label = 'User Prompt';
      break;
    case 'agent_plan':
      colorClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      icon = <Compass className="w-3 h-3 text-purple-600" />;
      label = 'Agent Plan';
      break;
    case 'model_call':
      colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      icon = <Cpu className="w-3 h-3 text-indigo-600" />;
      label = 'Model Call';
      break;
    case 'tool_call':
      colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
      icon = <Wrench className="w-3 h-3 text-amber-700" />;
      label = 'Tool Call';
      break;
    case 'tool_result':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      icon = <CheckSquare className="w-3 h-3 text-emerald-600" />;
      label = 'Tool Result';
      break;
    case 'validation':
      colorClasses = 'bg-teal-50 text-teal-700 border-teal-200';
      icon = <CheckSquare className="w-3 h-3 text-teal-600" />;
      label = 'Validation';
      break;
    case 'error':
      colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      icon = <ShieldAlert className="w-3 h-3 text-rose-600" />;
      label = 'Error';
      break;
    default:
      label = eventType;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border font-mono tracking-normal shadow-subtle',
        colorClasses,
        sizeClasses
      )}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
};
