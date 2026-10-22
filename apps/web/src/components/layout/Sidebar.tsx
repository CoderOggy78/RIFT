import React from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  LayoutDashboard,
  GitFork,
  AlertOctagon,
  SearchCode,
  RotateCcw,
  Settings,
  Cpu,
  Layers,
  Compass,
  X,
} from 'lucide-react';

interface SidebarProps {
  onOpenImport: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenImport, isOpen = false, onClose }) => {
  const { data: modelStatus } = useQuery({
    queryKey: ['model-status'],
    queryFn: api.getModelStatus,
    refetchInterval: 15000,
  });

  interface NavItem {
    name: string;
    to: string;
    icon: React.ComponentType<{ className?: string }>;
  }

  // Exactly the navigation required by RIFT PRODUCT IDENTITY:
  // Overview | Traces | Incidents | Investigations | Replay Lab | Settings
  const navItems: NavItem[] = [
    { name: 'Overview', to: '/', icon: LayoutDashboard },
    { name: 'Traces', to: '/traces', icon: GitFork },
    { name: 'Incidents', to: '/incidents', icon: AlertOctagon },
    { name: 'Investigations', to: '/investigations', icon: SearchCode },
    { name: 'Replay Lab', to: '/replay', icon: RotateCcw },
    { name: 'Graphify', to: '/graphify', icon: Compass },
    { name: 'Integrations', to: '/integrations', icon: Layers },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  const content = (
    <div className="flex flex-col justify-between h-full w-64 bg-white select-none border-r border-rift-border">
      {/* Brand Header */}
      <div>
        <div className="p-4 border-b border-rift-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Custom Precision RIFT Monogram */}
            <div className="relative w-8 h-8 rounded-lg bg-[#0F172A] shadow-sm flex items-center justify-center overflow-hidden border border-slate-800 shrink-0">
              <svg
                viewBox="0 0 32 32"
                className="w-4 h-4"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M7 6H13V26H7V6Z" fill="#3B82F6" />
                <path d="M13 6H21C23.7614 6 26 8.23858 26 11C26 13.7614 23.7614 16 21 16H13V6Z" fill="#2563EB" />
                <path d="M13 10H20C20.5523 10 21 10.4477 21 11C21 11.5523 20.5523 12 20 12H13V10Z" fill="#0F172A" />
                <path d="M14 16L24.5 26H18.5L11 18.5L14 16Z" fill="#00F5D4" />
                <circle cx="21" cy="22.5" r="1.5" fill="#00F5D4" />
              </svg>
            </div>
            <div>
              <span className="font-display font-extrabold tracking-tight text-base text-[#0F172A] leading-tight block">
                RIFT
              </span>
              <span className="block text-[9px] font-mono text-slate-500 font-medium tracking-wider leading-none mt-0.5 uppercase">
                AI Observability
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rift-elevated text-rift-muted border border-rift-border">
              v0.1.0
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-rift-muted hover:text-rift-text md:hidden rounded-lg hover:bg-rift-elevated transition"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tagline */}
        <div className="px-4 py-2.5 bg-rift-base/60 border-b border-rift-border/70">
          <p className="text-[11px] text-rift-muted font-sans italic leading-snug">
            Between what agents intend and what they do.
          </p>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-rift-accent font-semibold border border-blue-100 shadow-sm'
                    : 'text-rift-muted hover:text-rift-text hover:bg-rift-elevated border border-transparent'
                }`
              }
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.name}</span>
              </div>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer System Status */}
      <div className="p-4 border-t border-rift-border bg-rift-base/40">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-rift-muted flex items-center gap-1.5 font-medium">
            <Cpu className="w-3.5 h-3.5 text-rift-accent" />
            <span>AI Engine</span>
          </span>
          <span className="font-mono text-[11px] text-rift-text font-medium">
            {modelStatus?.configured_model || 'Gemma'}
          </span>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              modelStatus?.status === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : modelStatus?.status === 'model_missing'
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px] text-rift-muted capitalize">
            {modelStatus?.status ? modelStatus.status.replace('_', ' ') : 'Checking...'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Overlay (Desktop uses the Top Menu Bar) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="relative z-10 shadow-xl h-full">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

