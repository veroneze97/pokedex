/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pokered: { DEFAULT: '#CC0000', dark: '#990000', light: '#FF3333' },
        pokegray: { DEFAULT: '#2a2a2a', light: '#3d3d3d', lighter: '#555' },
      },
      fontFamily: { sans: ['"Inter"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
