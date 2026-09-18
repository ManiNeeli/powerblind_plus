/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas:  { DEFAULT: '#090d16', 50: '#0f172a', 100: '#141e33', 200: '#1c2942' },
        surface: { DEFAULT: '#111827', card: '#131b2e', hover: '#19233c', border: '#1e2b44', borderLight: '#2a3b5c' },
        accent:  { DEFAULT: '#00f2b2', hover: '#00d69d', dim: '#00b383', muted: 'rgba(0,242,178,0.12)', glow: 'rgba(0,242,178,0.30)' },
        risk: {
          theft:   { DEFAULT: '#ff3b5c', hover: '#e62e4e', muted: 'rgba(255,59,92,0.15)',  glow: 'rgba(255,59,92,0.35)' },
          fault:   { DEFAULT: '#f59e0b', hover: '#d97706', muted: 'rgba(245,158,11,0.15)', glow: 'rgba(245,158,11,0.35)' },
          comm:    { DEFAULT: '#6366f1', hover: '#4f46e5', muted: 'rgba(99,102,241,0.15)', glow: 'rgba(99,102,241,0.35)' },
          normal:  { DEFAULT: '#10b981', hover: '#059669', muted: 'rgba(16,185,129,0.15)', glow: 'rgba(16,185,129,0.35)' },
        },
        ink: {
          primary:   '#f8fafc',
          secondary: '#94a3b8',
          muted:     '#64748b',
          faint:     '#334155',
          inverse:   '#090d16',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 20px -3px rgba(0,242,178,0.35)',
        'glow-theft':  '0 0 20px -3px rgba(255,59,92,0.35)',
        'glow-fault':  '0 0 20px -3px rgba(245,158,11,0.35)',
        'glow-comm':   '0 0 20px -3px rgba(99,102,241,0.35)',
        'glow-normal': '0 0 20px -3px rgba(16,185,129,0.35)',
        'card':        '0 2px 10px -2px rgba(0,0,0,0.5), 0 1px 3px -1px rgba(0,0,0,0.3)',
        'card-hover':  '0 12px 28px -6px rgba(0,0,0,0.6), 0 0 1px 1px rgba(0,242,178,0.25)',
        'glass':       '0 8px 32px 0 rgba(0,0,0,0.4), inset 0 1px 0 0 rgba(255,255,255,0.08)',
        'specular':    'inset 0 1px 0 0 rgba(255,255,255,0.1)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      borderRadius: {
        card: '0.75rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':    'shimmer 2s infinite linear',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite alternate',
        'radar':      'radarRipple 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        glowPulse: {
          '0%':   { opacity: '0.4', transform: 'scale(0.98)' },
          '100%': { opacity: '0.85', transform: 'scale(1.02)' },
        },
        radarRipple: {
          '0%':   { transform: 'scale(0.95)', opacity: '0.85' },
          '70%':  { transform: 'scale(2.2)',  opacity: '0' },
          '100%': { transform: 'scale(0.95)', opacity: '0' },
        },
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
};
