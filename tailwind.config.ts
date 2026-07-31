import type { Config } from "tailwindcss";

/**
 * Les couleurs pointent vers des variables CSS injectées au runtime depuis
 * config/brand.config.ts (voir app/layout.tsx). Pour rebrander la boutique,
 * ne touchez PAS ce fichier : modifiez brand.config.ts.
 */
const config: Config = {
  // N'applique les effets `hover:` que sur les appareils qui supportent
  // réellement le survol → évite le "double-tap" sur mobile/tactile.
  future: { hoverOnlyWhenSupported: true },
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./config/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--c-bg)",
        surface: "var(--c-surface)",
        ink: "var(--c-ink)",
        muted: "var(--c-muted)",
        primary: "var(--c-primary)",
        "primary-dark": "var(--c-primary-dark)",
        secondary: "var(--c-secondary)",
        organic: "var(--c-organic)",
        halo: "var(--c-halo)",
        line: "var(--c-border)",
      },
      fontFamily: {
        heading: "var(--font-heading)",
        body: "var(--font-body)",
      },
      boxShadow: {
        glow: "0 18px 60px -22px var(--c-glow-shadow)",
        soft: "0 10px 40px -24px rgba(42,36,32,0.45)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glow: {
          "0%,100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.16,1,0.3,1) both",
        glow: "glow 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
