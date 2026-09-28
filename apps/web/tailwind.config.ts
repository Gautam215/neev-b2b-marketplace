import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        graphite: '#0b0d0d',
        panel: '#151919',
        'panel-raised': '#1d2322',
        lime: '#c6ec62',
        clay: '#bd7654',
        mist: '#a7aea9',
      },
      boxShadow: {
        glass: '0 24px 70px rgba(0, 0, 0, .28), inset 0 1px 0 rgba(255, 255, 255, .06)',
      },
      borderRadius: {
        apple: '1.5rem',
      },
      fontFamily: {
        sans: ['Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
