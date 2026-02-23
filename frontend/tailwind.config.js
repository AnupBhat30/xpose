/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#111111',
        panel: '#1c1c1e',
        accent: '#0A84FF',
        textPrimary: '#F5F5F7',
        textSecondary: '#6E6E73',
        destructive: '#FF453A',
        borderSoft: 'rgba(255,255,255,0.08)'
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Text', 'SF Pro Display', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SFMono-Regular', 'ui-monospace', 'Menlo', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace']
      },
      boxShadow: {
        soft: '0 1px 3px rgba(0,0,0,0.4)'
      }
    }
  },
  plugins: []
}
