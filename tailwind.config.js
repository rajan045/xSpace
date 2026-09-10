/** @type {import('tailwindcss').Config} */

/* Two-color system. Everything below resolves to one of two CSS variables:
   --fg  (white in dark mode, near-black blue in light mode)
   --bg / --surface / --raised / --panel (blends of the dark blue base)
   Legacy accent + red/amber names are kept so existing classes keep working. */
const fg = (a) => `rgb(var(--fg) / ${a})`
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Text + everything that used plain white */
        white: v('--fg'),

        /* Surfaces — blends of the dark blue base */
        dark: {
          950: v('--bg'),
          900: v('--surface'),
          800: v('--surface'),
          700: v('--raised'),
          600: v('--panel'),
          500: v('--panel'),
        },
        /* Single accent — same ink/paper pair, kept under the old names */
        accent: {
          blue: v('--accent'),
          purple: v('--accent'),
          green: v('--accent'),
          orange: v('--accent'),
          red: v('--accent'),
          cyan: v('--accent'),
        },
        /* Status families collapse to the accent; emphasis comes from fill weight */
        red: {
          100: fg(0.95), 200: fg(0.9), 300: fg(0.8), 400: fg(0.92),
          500: v('--accent'), 600: v('--accent'), 700: v('--accent'), 900: fg(0.14),
        },
        amber: {
          100: fg(0.9), 200: fg(0.8), 300: fg(0.7), 400: fg(0.7),
          500: fg(0.55), 600: fg(0.55), 700: fg(0.5), 900: fg(0.1),
        },
        mac: {
          window: v('--bg'),
          sidebar: v('--surface'),
          raised: v('--raised'),
          panel: v('--panel'),
          separator: fg(0.1),
          label: fg(0.92),
          secondary: fg(0.6),
          tertiary: fg(0.3),
          fill: fg(0.09),
          fillHover: fg(0.14),
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
        'mac-sm': '0 1px 0 rgb(var(--fg) / 0.06) inset, 0 0 0 0.5px rgb(var(--fg) / 0.08)',
        'mac-lg': '0 0 1px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
