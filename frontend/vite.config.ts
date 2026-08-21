import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg"],
      manifest: {
        name: "Schichtklar",
        short_name: "Schichtklar",
        description: "Persönliche Schichtplanung mit Google Kalender",
        theme_color: "#F6F7F9",
        background_color: "#F6F7F9",
        display: "standalone",
        start_url: "/",
        lang: "de-CH",
        icons: [
          { src: "logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
    },
  },
});
