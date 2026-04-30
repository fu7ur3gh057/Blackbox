import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    "#07080B",
          surface: "#13151B",
          elev:    "#1A1D25",
          input:   "#15171E",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.08)",
          soft:    "rgba(255,255,255,0.05)",
        },
        accent: {
          DEFAULT: "#F97316",
          soft:    "#FDBA74",
          glow:    "rgba(249, 115, 22, 0.20)",
        },
        violet: {
          accent: "#A78BFA",
          glow:   "rgba(167,139,250,0.20)",
        },
        cyan: {
          accent: "#22D3EE",
          glow:   "rgba(34,211,238,0.20)",
        },
        text: {
          strong: "#F4F4F5",
          DEFAULT: "#D4D4D8",
          dim:    "#9CA3AF",
          mute:   "#6B7280",
        },
        level: {
          ok:   "#34D399",
          warn: "#FBBF24",
          crit: "#F87171",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "1.5rem",
      },
      boxShadow: {
        glow:        "0 0 80px -24px rgba(249, 115, 22, 0.55)",
        "glow-vio":  "0 0 80px -24px rgba(167, 139, 250, 0.55)",
        "glow-cyan": "0 0 80px -24px rgba(34, 211, 238, 0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
