import aurelia from '@aurelia/tokens'
import { appColors, accents } from '@aurelia/tokens/palette'

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
        // Legacy alias: affiliate-* === aurelia-* plus emerald and gold
        affiliate: appColors({
          emerald: accents.emerald.hex,
          gold: accents.gold.hex,
        }),
      },
    },
  },
  plugins: [],
}
