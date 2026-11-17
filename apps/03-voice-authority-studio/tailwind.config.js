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
        // Legacy alias: voice-* keeps the studio's violet scale; voice-accent
        // follows --aurelia-accent (violet for this app, see src/index.css).
        voice: appColors({
          dark: '#1e1b4b',
          primary: '#5b21b6',
          surface: '#faf5ff',
        }),
      },
    },
  },
  plugins: [],
}
