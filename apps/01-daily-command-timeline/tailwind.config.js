import aurelia from '@aurelia/tokens'
import { appColors } from '@aurelia/tokens/palette'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [aurelia],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Legacy alias: timeline-* === aurelia-*
        timeline: appColors(),
      },
    },
  },
  plugins: [],
}
