import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0a0d12',
        surface: '#10141c',
        'surface-2': '#171d29',
        'surface-3': '#1e2433',
        cobalt: '#4d6bff',
        'cobalt-light': '#6b85ff',
        mint: '#54d3b3',
        amber: '#f2ecdc',
        ink: '#f5f7fb',
        'ink-2': '#9ea8bd',
        'border': '#28324a',
      },
      boxShadow: {
        cinematic: '0 28px 90px rgba(0, 0, 0, .32), inset 0 1px 0 rgba(255, 255, 255, .06)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
