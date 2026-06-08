/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary accent — indigo to violet, used for active states, CTAs,
        // gradient sweeps. Tuned to read crisp on both white and slate-950.
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Surface ramp used by the dark sidebar. Standard zinc would feel
        // flat next to indigo accents, so we tint very subtly toward blue.
        ink: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        'glow-brand':       '0 0 0 1px rgba(99,102,241,0.18), 0 8px 24px -8px rgba(99,102,241,0.45)',
        'card':             '0 1px 0 rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        'card-hover':       '0 4px 12px -2px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06)',
        'card-deep':        '0 24px 48px -16px rgba(15,23,42,0.16), 0 4px 10px -2px rgba(15,23,42,0.06)',
        'inner-soft':       'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'mesh-light':
          'radial-gradient(at 15% 20%, rgba(99,102,241,0.12) 0%, transparent 50%),' +
          'radial-gradient(at 85% 30%, rgba(139,92,246,0.10) 0%, transparent 50%),' +
          'radial-gradient(at 50% 100%, rgba(56,189,248,0.08) 0%, transparent 50%)',
        'mesh-dark':
          'radial-gradient(at 0% 0%, rgba(99,102,241,0.25) 0%, transparent 50%),' +
          'radial-gradient(at 100% 0%, rgba(139,92,246,0.22) 0%, transparent 50%),' +
          'radial-gradient(at 50% 100%, rgba(14,165,233,0.18) 0%, transparent 50%)',
        'sidebar-noise':
          'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)',
      },
      animation: {
        'fade-in':       'fade-in 0.35s ease-out both',
        'fade-in-up':    'fade-in-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-down':  'fade-in-down 0.3s ease-out both',
        'scale-in':      'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        'shimmer':       'shimmer 1.6s linear infinite',
        'pulse-glow':    'pulse-glow 2.4s ease-in-out infinite',
        'count-up':      'fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
      keyframes: {
        'fade-in': {
          '0%':   { opacity: 0 },
          '100%': { opacity: 1 },
        },
        'fade-in-up': {
          '0%':   { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%':   { opacity: 0, transform: 'translateY(-6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%':   { opacity: 0, transform: 'scale(0.96)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
        'slide-in-left': {
          '0%':   { opacity: 0, transform: 'translateX(-12px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.45)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(99,102,241,0)' },
        },
      },
    },
  },
  plugins: [
    // Adds the `prose` utility class used by the public legal pages
    // (/privacy, /terms) so server-rendered markdown reads cleanly
    // without per-page styling.
    require('@tailwindcss/typography'),
  ],
};
