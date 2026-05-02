/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#EEF3FF",
          100: "#DCE6FF",
          500: "#3B6CFF",
          600: "#2C57E6",
          700: "#1F44C2",
        },
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(59,108,255,0.25)",
      },
    },
  },
  plugins: [],
};