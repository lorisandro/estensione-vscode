/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.html",
  ],
  theme: {
    extend: {
      colors: {
        linkedin: {
          DEFAULT: '#0A66C2',
          dark: '#004182',
          light: '#378FE9',
        }
      }
    },
  },
  plugins: [],
}
