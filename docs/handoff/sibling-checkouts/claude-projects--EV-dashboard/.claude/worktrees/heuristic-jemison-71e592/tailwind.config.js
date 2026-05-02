/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"SF Pro Display"', "system-ui", "sans-serif"],
        body: ['"SF Pro Text"', "system-ui", "sans-serif"],
        mono: ['"SF Mono"', "ui-monospace", "monospace"],
      },
      transitionDuration: {
        DEFAULT: "150ms",
        fast: "100ms",
        base: "150ms",
        slow: "250ms",
      },
      fontSize: {
        "display-lg": ["2rem", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        "display":    ["1.5rem", { lineHeight: "1.25", letterSpacing: "-0.015em" }],
        "title":      ["1.125rem", { lineHeight: "1.4" }],
        "body":       ["0.9375rem", { lineHeight: "1.5" }],
        "caption":    ["0.8125rem", { lineHeight: "1.5" }],
        "label":      ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.05em" }],
      },
      colors: {
        ink: {
          900: "#0a0a0b",
          800: "#111114",
          700: "#1a1a1f",
          600: "#26262d",
          500: "#3a3a44",
          400: "#6b6b78",
          300: "#a0a0ac",
          200: "#d0d0d6",
          100: "#f2f2f5",
        },
        accent: {
          blue: "#2a7cff",
          green: "#1fb76b",
          amber: "#f6a72a",
          red: "#e8453c",
        },
      },
    },
  },
  plugins: [],
};
