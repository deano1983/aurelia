/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        timeline: {
          dark: '#0b1f3a',
          primary: '#1d4ed8',
          accent: '#22d3ee',
          surface: '#f8fafc',
        },
      },
    },
  },
  plugins: [],
}
