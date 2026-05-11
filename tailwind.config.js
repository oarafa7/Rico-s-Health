/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: '#007AFF',
        surface: '#F2F2F7',
      },
    },
  },
  plugins: []
}
