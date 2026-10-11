/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'rgb(var(--color-canvas-rgb) / <alpha-value>)',
          50:      'rgb(var(--color-canvas-50-rgb) / <alpha-value>)',
          100:     'rgb(var(--color-canvas-100-rgb) / <alpha-value>)',
          200:     'rgb(var(--color-canvas-200-rgb) / <alpha-value>)',
        },
        surface: {
          DEFAULT:     'rgb(var(--color-surface-rgb) / <alpha-value>)',
          card:        'rgb(var(--color-card-bg-rgb) / <alpha-value>)',
          hover:       'var(--color-surface-hover)',
          border:      'var(--color-surface-border)',
          borderLight: 'var(--color-surface-border-light)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover:   'var(--color-accent-hover)',
          dim:     'var(--color-accent-dim)',
          muted:   'var(--color-accent-muted)',
          glow:    'var(--color-accent-glow)',
        },
        risk: {
          theft: {
            DEFAULT: 'var(--color-risk-theft)',
            hover:   'var(--color-risk-theft-hover)',
            muted:   'var(--color-risk-theft-muted)',
            glow:    'var(--color-risk-theft-glow)',
          },
          fault: {
            DEFAULT: 'var(--color-risk-fault)',
            hover:   'var(--color-risk-fault-hover)',
            muted:   'var(--color-risk-fault-muted)',
            glow:    'var(--color-risk-fault-glow)',
          },
          comm: {
            DEFAULT: 'var(--color-risk-comm)',
            hover:   'var(--color-risk-comm-hover)',
            muted:   'var(--color-risk-comm-muted)',
            glow:    'var(--color-risk-comm-glow)',
          },
          normal: {
            DEFAULT: 'var(--color-risk-normal)',
            hover:   'var(--color-risk-normal-hover)',
            muted:   'var(--color-risk-normal-muted)',
            glow:    'var(--color-risk-normal-glow)',
          },
        },
        ink: {
          primary:   'var(--color-ink-primary)',
          secondary: 'var(--color-ink-secondary)',
          muted:     'var(--color-ink-muted)',
          faint:     'var(--color-ink-faint)',
          inverse:   'var(--color-ink-inverse)',
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
