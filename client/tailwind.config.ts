import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base:    "#0E0F12",   // page
          surface: "#16181D",   // card
          elev:    "#1E2128",   // popovers, modals
          input:   "#1A1C22",
        },
        border: {
          DEFAULT: "#262A33",
          soft:    "#1F232B",
        },
        accent: {
          DEFAULT: "#F97316",   // orange-500
          soft:    "#FDBA74",   // orange-300 (for glow)
          glow:    "rgba(249, 115, 22, 0.18)",
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
      },
      borderRadius: {
        card: "1.25rem",
      },
      boxShadow: {
        glow: "0 0 60px -20px rgba(249, 115, 22, 0.45)",
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 4px 24px rgba(0,0,0,0.35)",
      },
      backgroundImage: {
        "card-gradient":
          "radial-gradient(120% 120% at 0% 0%, rgba(249,115,22,0.06) 0%, transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
