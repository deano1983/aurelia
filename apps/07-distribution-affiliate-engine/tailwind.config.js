/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // ShareSheet (@aurelia/core/share) ships Tailwind classes
    "../../packages/core/src/share/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        affiliate: {
          dark: '#0b1f3a',
          emerald: '#10b981',
          surface: '#f8fafc',
          gold: '#f59e0b',
        },
      },
    },
  },
  plugins: [],
}
