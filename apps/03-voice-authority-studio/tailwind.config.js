/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        voice: {
          dark: '#1e1b4b',
          primary: '#5b21b6',
          accent: '#8b5cf6',
          surface: '#faf5ff',
        },
      },
    },
  },
  plugins: [],
}
