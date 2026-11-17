import aurelia from '@aurelia/tokens'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [aurelia],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [],
}
