import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0b",
          subtle: "#111114",
          elevated: "#16161a",
          hover: "#1c1c22",
        },
        border: {
          DEFAULT: "#23232b",
          strong: "#2e2e38",
        },
        fg: {
          DEFAULT: "#f4f4f5",
          muted: "#a1a1aa",
          subtle: "#71717a",
        },
        accent: {
          DEFAULT: "#6ee7b7",
          strong: "#34d399",
          dim: "#064e3b",
        },
        warn: {
          DEFAULT: "#fbbf24",
          dim: "#78350f",
        },
        bad: {
          DEFAULT: "#f87171",
          dim: "#7f1d1d",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        xxs: "0.6875rem",
      },
    },
  },
  plugins: [],
};

export default config;
