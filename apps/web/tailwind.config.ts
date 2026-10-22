import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        rift: {
          base: '#F8F9FA',
          surface: '#FFFFFF',
          elevated: '#F1F3F4',
          highlight: '#E8EAED',
          border: '#E5E7EB',
          'border-light': '#F3F4F6',
          'border-strong': '#D1D5DB',
          text: '#1F2937',
          muted: '#5F6368',
          subtle: '#80868B',
          accent: '#1A73E8',
          'accent-hover': '#1557B0',
          'accent-subtle': '#EFF6FF',
          'accent-border': '#BFDBFE',
          // Semantic statuses
          critical: '#DC2626',
          'critical-subtle': '#FEF2F2',
          'critical-border': '#FECACA',
          warning: '#D97706',
          'warning-subtle': '#FFFBEB',
          'warning-border': '#FDE68A',
          hypothesis: '#6366F1',
          'hypothesis-subtle': '#EEF2FF',
          'hypothesis-border': '#C7D2FE',
          success: '#137333',
          'success-subtle': '#ECFDF5',
          'success-border': '#A7F3D0',
          dusk: '#4B5563',
        },
      },
      fontFamily: {
        display: ['"Google Sans Flex"', '"Google Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        sans: ['"Google Sans Flex"', '"Google Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Google Sans Code"', '"JetBrains Mono"', '"Roboto Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'modal': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        'pill': '9999px',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
