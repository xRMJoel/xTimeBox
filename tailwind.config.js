/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware surface palette (reads CSS variables)
        surface: {
          DEFAULT: 'var(--color-surface)',
          dim: 'var(--color-surface)',
          container: 'var(--color-surface-container)',
          'container-low': 'var(--color-surface-container-low)',
          'container-high': 'var(--color-surface-container-high)',
          'container-highest': 'var(--color-surface-container-highest)',
          bright: 'var(--color-surface-bright)',
          variant: 'var(--color-surface-variant)',
        },
        // Primary cyan
        primary: {
          DEFAULT: 'var(--color-primary)',
          dim: 'var(--color-primary-dim)',
          fixed: '#00c8fd',
          'fixed-dim': '#00b9eb',
          container: '#00c8fd',
          light: 'var(--color-primary)',
        },
        // Secondary purple
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          dim: 'var(--color-secondary-dim)',
          container: '#6606c7',
          fixed: '#e0c7ff',
          'fixed-dim': '#d5b6ff',
        },
        // Tertiary indigo
        tertiary: {
          DEFAULT: '#8b9cff',
          dim: '#8396ff',
          container: '#7b8ef7',
        },
        // Semantic
        error: {
          DEFAULT: 'var(--color-error)',
          dim: 'var(--color-error-dim)',
          container: '#9f0519',
        },
        // Outline
        outline: {
          DEFAULT: 'var(--color-outline)',
          variant: 'var(--color-outline-variant)',
        },
        // On-surface text
        'on-surface': {
          DEFAULT: 'var(--color-on-surface)',
          variant: 'var(--color-on-surface-variant)',
        },
        // Legacy compat aliases
        cyan: {
          50: 'rgba(0,201,255,0.05)',
          100: 'rgba(0,201,255,0.08)',
          200: 'rgba(0,201,255,0.15)',
          300: '#60E0FF',
          400: '#00C9FF',
          500: '#00b4e6',
        },
        purple: {
          400: '#a855f7',
          500: '#7B2FDB',
          600: '#6d28d9',
        },
        slate: {
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
        },
      },
      fontFamily: {
        sans: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
        body: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
        heading: ['"Montserrat"', 'system-ui', 'sans-serif'],
        headline: ['"Montserrat"', 'system-ui', 'sans-serif'],
        label: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #00C9FF, #7B2FDB)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0,201,255,0.15)',
        'glow-lg': '0 0 40px rgba(0,201,255,0.3)',
        'card': '0 8px 32px rgba(0,0,0,0.3)',
        'nav': '0 8px 32px rgba(0,201,255,0.1)',
      },
    },
  },
  plugins: [],
}
