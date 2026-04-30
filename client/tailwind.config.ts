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
        // Accents — chartreuse / lime, matched to logo edges
        accent: {
          pale:   "#B5D17A",   // washed-out lime — most widget details
          green:  "#D6F26B",   // signal — only on true emphasis
          bright: "#E8FF8F",   // hover / secondary
          dim:    "#2A2D14",
          glow:   "rgba(214, 242, 107, 0.40)",
        },
        // Text
        ink: {
          strong: "#FFFFFF",
          DEFAULT: "#D4D4D8",
          dim:    "#7C7F84",
          mute:   "#4D5057",
        },
        level: {
          ok:   "#D6F26B",
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
        chip:   "0 8px 24px -10px rgba(214, 242, 107, 0.55)",
        soft:   "0 2px 12px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
