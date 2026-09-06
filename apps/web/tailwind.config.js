/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas:  { DEFAULT: '#0d1117', 50: '#161b22', 100: '#1c2230', 200: '#242d3d' },
        surface: { DEFAULT: '#1a2236', hover: '#1f2940', border: '#2a3650' },
        accent:  { DEFAULT: '#00c8a0', dim: '#009e80', muted: 'rgba(0,200,160,0.12)', glow: 'rgba(0,200,160,0.25)' },
        risk: {
          theft:   { DEFAULT: '#ef4444', muted: 'rgba(239,68,68,0.15)'  },
          fault:   { DEFAULT: '#f59e0b', muted: 'rgba(245,158,11,0.15)' },
          comm:    { DEFAULT: '#6366f1', muted: 'rgba(99,102,241,0.15)' },
          normal:  { DEFAULT: '#22c55e', muted: 'rgba(34,197,94,0.15)'  },
        },
        ink: {
          primary:   '#e6edf3',
          secondary: '#8b949e',
          muted:     '#484f58',
          inverse:   '#0d1117',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 16px rgba(0,200,160,0.3)',
        'card':        '0 1px 3px rgba(0,0,0,0.4)',
        'card-hover':  '0 4px 16px rgba(0,0,0,0.5)',
      },
      borderRadius: { card: '0.625rem' },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
};
