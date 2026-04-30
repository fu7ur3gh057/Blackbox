import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#ECE0CB",
          deep:    "#E2D6BD",
          card:    "#F0E5CC",
        },
        canvas: {
          DEFAULT: "#0F1119",
          elev:    "#181B26",
          elev2:   "#212431",
          line:    "#272A37",
        },
        ink: {
          strong: "#F0E5CC",
          DEFAULT: "#E5E1D6",
          dim:    "#A09A8C",
          mute:   "#6E6E7A",
        },
        accent: {
          lavender:        "#C4B5FD",
          lavender_strong: "#A78BFA",
          pink:            "#F0ABFC",
          peach:           "#F4B788",
          mint:            "#A7F3D0",
        },
        level: {
          ok:   "#86EFAC",
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
        canvas: "0 24px 60px -24px rgba(15, 17, 25, 0.45)",
        chip:   "0 8px 24px -10px rgba(167, 139, 250, 0.5)",
        soft:   "0 2px 12px rgba(0,0,0,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
