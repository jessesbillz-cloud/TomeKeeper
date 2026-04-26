import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // Prefer the TypeScript source over any stale .js compiled output that may
  // still be sitting in src/. Without this, Vite's default extension order
  // (.js before .tsx) silently shadows the real source files.
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".mjs", ".js", ".mts", ".json"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "TomeKeeper",
        short_name: "TomeKeeper",
        description: "Special edition book tracker",
        theme_color: "#18181b",
        background_color: "#fafafa",
        display: "standalone",
        start_url: "/",
        icons: [],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
