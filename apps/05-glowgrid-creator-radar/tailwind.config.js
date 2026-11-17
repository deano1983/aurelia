import aurelia from '@aurelia/tokens'
import { appColors } from '@aurelia/tokens/palette'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [aurelia],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // ShareSheet (@aurelia/core/share) ships Tailwind classes
    "../../packages/core/src/share/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy alias: glowgrid-* keeps its violet primary and deeper dark;
        // glowgrid-accent follows --aurelia-accent (pink, see src/index.css).
        glowgrid: appColors({
          dark: '#0b1226',
          primary: '#8b5cf6',
          primaryHover: '#7c3aed',
        }),
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
