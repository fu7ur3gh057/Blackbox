import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Page + surfaces
        canvas: {
          DEFAULT: "#050507",   // body
          elev:    "#0A0E0B",   // panels
          elev2:   "#0F1410",   // popovers / nested cards
          line:    "rgba(34,255,102,0.06)",
        },
        // Accents — pale green dominant, bright reserved for live signal
        accent: {
          pale:   "#8FBF98",   // default green tone — most widget details
          green:  "#22FF66",   // signal — only on true emphasis
          bright: "#7CFFA0",   // hover / secondary
          dim:    "#1A2820",
          glow:   "rgba(143, 191, 152, 0.40)",
        },
        // Text
        ink: {
          strong: "#FFFFFF",
          DEFAULT: "#D4D4D8",
          dim:    "#7C7F84",
          mute:   "#4D5057",
        },
        level: {
          ok:   "#22FF66",
          warn: "#FDE68A",
          crit: "#FCA5A5",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        canvas: "2.25rem",
        card:   "1.25rem",
      },
      boxShadow: {
        canvas: "0 24px 60px -24px rgba(0, 0, 0, 0.85)",
        chip:   "0 8px 24px -10px rgba(34, 255, 102, 0.5)",
        soft:   "0 2px 12px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
