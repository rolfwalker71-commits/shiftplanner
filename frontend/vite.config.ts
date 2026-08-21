import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: [
        "logo.png",
        "logo-192.png",
        "logo-512.png",
        "logo-maskable-192.png",
        "logo-maskable-512.png",
        "apple-touch-icon.png",
        "favicon-32.png",
        "favicon-16.png",
      ],
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ico}"],
      },
      manifest: {
        name: "Arbeitsplan",
        short_name: "Arbeitsplan",
        description: "Persönliche Schichtplanung mit Google Kalender",
        theme_color: "#F6F7F9",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: "/",
        lang: "de-CH",
        icons: [
          { src: "logo-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "logo-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "logo-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "logo-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
