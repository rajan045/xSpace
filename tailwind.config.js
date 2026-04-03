/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Apple HIG–style dark surfaces */
        dark: {
          950: '#0d0d0d',
          900: '#1c1c1e',
          800: '#2c2c2e',
          700: '#3a3a3c',
          600: '#48484a',
          500: '#636366',
        },
        /* System accent colors (dark mode) */
        accent: {
          blue: '#0A84FF',
          purple: '#BF5AF2',
          green: '#30D158',
          orange: '#FF9F0A',
          red: '#FF453A',
          cyan: '#64D2FF',
        },
        mac: {
          window: '#1e1e1e',
          sidebar: '#252526',
          separator: 'rgba(84, 84, 88, 0.48)',
          label: 'rgba(255, 255, 255, 0.92)',
          secondary: 'rgba(235, 235, 245, 0.6)',
          tertiary: 'rgba(235, 235, 245, 0.3)',
          fill: 'rgba(120, 120, 128, 0.2)',
          fillHover: 'rgba(120, 120, 128, 0.28)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        mac: '10px',
        'mac-sm': '6px',
        'mac-xs': '5px',
      },
      boxShadow: {
        mac: '0 0 1px rgba(0,0,0,0.5), 0 12px 40px rgba(0,0,0,0.45)',
        'mac-sm': '0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 0.5px rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [],
}
