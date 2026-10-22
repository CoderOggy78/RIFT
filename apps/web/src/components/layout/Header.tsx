import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
  Upload,
  Menu,
  X,
  Rocket,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import { IntegrationsMenu } from './IntegrationsMenu';

interface HeaderProps {
  onOpenImport: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenImport, onToggleMobileMenu }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAnnouncement, setShowAnnouncement] = useState(true);

  const loadDemoMutation = useMutation({
    mutationFn: api.loadSyntheticDemo,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
      queryClient.invalidateQueries({ queryKey: ['traces'] });
      queryClient.invalidateQueries({ queryKey: ['traces-overview'] });
      queryClient.invalidateQueries({ queryKey: ['demo-status'] });
      if (res.incident_id) {
        navigate(`/incidents/${res.incident_id}`);
      } else {
        navigate(`/investigations/${res.trace_id}`);
      }
    },
  });

  const navLinks = [
    { name: 'Overview', to: '/' },
    { name: 'Traces', to: '/traces' },
    { name: 'Incidents', to: '/incidents' },
    { name: 'Investigations', to: '/investigations' },
    { name: 'Replay Lab', to: '/replay' },
    { name: 'Settings', to: '/settings' },
  ];

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-rift-border">
      {/* Top Announcement Banner (Matching Google Antigravity reference Image 1) */}
      {showAnnouncement && (
        <div className="bg-[#f8f9fa] border-b border-gray-200 px-4 py-2 text-xs flex items-center justify-between text-gray-700 transition">
          <div className="flex-1 flex items-center justify-center gap-2 text-center flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#202124] text-white text-[10px] font-semibold tracking-wider uppercase">
              ✦ NEW
            </span>
            <span className="font-medium text-gray-800">
              Gemini 4 Argon & Isolated Sandbox Replay verification now available in RIFT
            </span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <button
              onClick={() => navigate('/replay')}
              className="font-medium text-rift-accent hover:text-rift-accent-hover inline-flex items-center gap-1 transition"
            >
              <span>Explore Replay Lab</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={() => setShowAnnouncement(false)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 transition"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Top Horizontal Navbar */}
      <header className="h-16 px-4 sm:px-8 flex items-center justify-between gap-4">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-6">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="p-2 -ml-2 rounded-lg text-rift-muted hover:text-rift-text hover:bg-rift-elevated md:hidden transition"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <NavLink to="/" className="flex items-center gap-3 group">
            {/* Custom Precision RIFT Monogram */}
            <div className="relative w-8 h-8 rounded-lg bg-[#0F172A] shadow-sm flex items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-105 border border-slate-800">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/30 via-transparent to-cyan-400/20 pointer-events-none" />
              <svg
                viewBox="0 0 32 32"
                className="w-5 h-5"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 6H13V26H7V6Z"
                  fill="url(#rift-pillar-grad)"
                />
                <path
                  d="M13 6H21C23.7614 6 26 8.23858 26 11C26 13.7614 23.7614 16 21 16H13V6Z"
                  fill="url(#rift-loop-grad)"
                />
                <path
                  d="M13 10H20C20.5523 10 21 10.4477 21 11C21 11.5523 20.5523 12 20 12H13V10Z"
                  fill="#0F172A"
                />
                <path
                  d="M14 16L24.5 26H18.5L11 18.5L14 16Z"
                  fill="url(#rift-beam-grad)"
                />
                <circle cx="21" cy="22.5" r="1.5" fill="#00F5D4" />
                <defs>
                  <linearGradient id="rift-pillar-grad" x1="7" y1="6" x2="13" y2="26" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3B82F6" />
                    <stop offset="1" stopColor="#1D4ED8" />
                  </linearGradient>
                  <linearGradient id="rift-loop-grad" x1="13" y1="6" x2="26" y2="16" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#60A5FA" />
                    <stop offset="1" stopColor="#2563EB" />
                  </linearGradient>
                  <linearGradient id="rift-beam-grad" x1="11" y1="16" x2="24.5" y2="26" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38BDF8" />
                    <stop offset="1" stopColor="#00F5D4" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-display font-extrabold text-xl tracking-tight text-[#0F172A]">
                RIFT
              </span>
              <span className="hidden sm:inline-flex items-center text-[11px] font-mono font-medium text-slate-500 tracking-wider uppercase pl-2 border-l border-slate-200">
                AI Agent Observability
              </span>
            </div>
          </NavLink>
        </div>

        {/* Center: Desktop Horizontal Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {navLinks.slice(0, 5).map((link) => (
            <NavLink
              key={link.name}
              to={link.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full text-xs lg:text-sm font-medium transition-all ${
                  isActive
                    ? 'text-rift-accent bg-blue-50/80 font-semibold shadow-xs'
                    : 'text-[#5f6368] hover:text-[#202124] hover:bg-gray-100/70'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
          {/* Graphify Dedicated Hub Link with AST Badge */}
          <NavLink
            to="/graphify"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs lg:text-sm font-medium transition-all ${
                isActive
                  ? 'text-emerald-700 bg-emerald-50/90 font-semibold shadow-xs ring-1 ring-emerald-500/20'
                  : 'text-[#5f6368] hover:text-[#202124] hover:bg-gray-100/70'
              }`
            }
          >
            <span>Graphify</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-mono font-semibold">
              AST
            </span>
          </NavLink>
          <IntegrationsMenu />
          {navLinks.slice(5).map((link) => (
            <NavLink
              key={link.name}
              to={link.to}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-full text-xs lg:text-sm font-medium transition-all ${
                  isActive
                    ? 'text-rift-accent bg-blue-50/80 font-semibold shadow-xs'
                    : 'text-[#5f6368] hover:text-[#202124] hover:bg-gray-100/70'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
        </nav>

        {/* Right: Clean Actions (Demo & Import Trace) */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Synthetic Demo Quick Launch */}
          <button
            onClick={() => loadDemoMutation.mutate()}
            disabled={loadDemoMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#202124] hover:bg-black text-white rounded-full text-xs font-medium transition shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-50"
            title="Launch synthetic incident demo"
          >
            <Rocket className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">
              {loadDemoMutation.isPending ? 'Launching…' : 'Demo'}
            </span>
          </button>

          {/* Import Trace Primary CTA Button */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-4 py-2 bg-rift-accent hover:bg-rift-accent-hover text-white rounded-full text-xs font-medium transition shadow-sm hover:shadow active:scale-[0.98]"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import Trace</span>
            <span className="sm:hidden">Import</span>
          </button>
        </div>
      </header>
    </div>
  );
};
