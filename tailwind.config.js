/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        // OSRS-inspired palette
        osrs: {
          gold: '#FFD700',
          'gold-dim': '#B8860B',
          dark: '#0E0E0E',
          panel: '#1A1A2E',
          'panel-light': '#16213E',
          'panel-hover': '#1F2B47',
          border: '#2A2A4A',
          green: '#00FF00',
          red: '#FF0000',
          cyan: '#00FFFF',
          orange: '#FF8C00',
          text: '#E8E8E8',
          'text-dim': '#9A9ABF',
        }
      },
      fontFamily: {
        display: ['JetBrains Mono', 'Fira Code', 'monospace'],
        body: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'xp-flash': 'xpFlash 0.6s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        xpFlash: {
          '0%': { backgroundColor: 'rgba(0, 255, 0, 0.15)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
    },
  },
  plugins: [],
}
