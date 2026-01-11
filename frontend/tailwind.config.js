export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [require("daisyui")],
  daisyui: { themes: true }
};
