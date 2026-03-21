/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Stitch surface palette
        surface: {
          DEFAULT: '#070d1f',
          dim: '#070d1f',
          container: '#11192e',
          'container-low': '#0c1326',
          'container-high': '#171f36',
          'container-highest': '#1c253e',
          bright: '#222b47',
          variant: '#1c253e',
        },
        // Primary cyan
        primary: {
          DEFAULT: '#66d3ff',
          dim: '#00b9eb',
          fixed: '#00c8fd',
          'fixed-dim': '#00b9eb',
          container: '#00c8fd',
        },
        // Secondary purple
        secondary: {
          DEFAULT: '#b685ff',
          dim: '#924bf3',
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
          DEFAULT: '#ff716c',
          dim: '#d7383b',
          container: '#9f0519',
        },
        // Outline
        outline: {
          DEFAULT: '#6f758b',
          variant: '#41475b',
        },
        // On-surface text
        'on-surface': {
          DEFAULT: '#dfe4fe',
          variant: '#a5aac2',
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
