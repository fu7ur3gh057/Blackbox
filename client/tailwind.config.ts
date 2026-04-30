import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Page + surfaces
        canvas: {
          DEFAULT: "#050507",   // body
          elev:    "#0A0B0F",   // panels (slightly cooler than lime-tinted)
          elev2:   "#0F1014",   // popovers / nested cards
          line:    "rgba(255,255,255,0.06)",
        },
        // Brand accent — was chartreuse, now monochrome white with a
        // bit of warmth at the dim end. The neon palette below provides
        // splashes of colour where differentiation matters.
        accent: {
          pale:   "#E0E0E5",   // primary widget details
          green:  "#F4F4F5",   // signal / emphasis  (name kept for compat)
          bright: "#FFFFFF",   // hover / max emphasis
          dim:    "#2A2A2D",
          glow:   "rgba(255, 255, 255, 0.35)",
        },
        // Neon palette — used for source-hues in logs, port pills,
        // splash corner glows. Saturated but not too loud on the dark
        // canvas. Pick from these when something needs to be visually
        // distinct from another item of the same type.
        neon: {
          violet:    "#C084FC",
          pink:      "#F472B6",
          burgundy:  "#9F1239",
          brown:     "#B48A60",
          turquoise: "#2DD4BF",
          carrot:    "#F97316",
        },
        // Text
        ink: {
          strong: "#FFFFFF",
          DEFAULT: "#D4D4D8",
          dim:    "#7C7F84",
          mute:   "#4D5057",
        },
        // Level colours stay semantically green/yellow/red but bumped
        // toward the more saturated / "neon" end so they sit alongside
        // the new palette without looking pastel-soft.
        level: {
          ok:   "#84F4A3",
          warn: "#FBBF24",
          crit: "#EF4444",
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
        chip:   "0 8px 24px -10px rgba(255, 255, 255, 0.40)",
        soft:   "0 2px 12px rgba(0,0,0,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
