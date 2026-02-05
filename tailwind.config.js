/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 定義主題色
        paper: '#f5f5dc', // 羊皮紙
        dark: '#1a1a1a',  // 深色
      },
    },
  },
  plugins: [],
}