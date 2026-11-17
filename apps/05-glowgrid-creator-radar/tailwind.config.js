/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glowgrid: {
          dark: '#0b1226',
          primary: '#8b5cf6',
          primaryHover: '#7c3aed',
          accent: '#22d3ee',
          surface: '#f8fafc',
          ink: '#0f172a',
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(139, 92, 246, 0)' },
        },
      },
    },
  },
  plugins: [],
}