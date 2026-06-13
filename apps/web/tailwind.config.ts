import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ring: "rgb(113 113 122)"
      }
    }
  },
  plugins: []
} satisfies Config;
