/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ctl: {
          dark: '#0b1f3a',
          emerald: '#10b981',
          surface: '#f8fafc',
        },
      },
    },
  },
  plugins: [],
}