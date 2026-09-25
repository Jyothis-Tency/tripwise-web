import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const BACKEND = process.env.VITE_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  base: process.env.VITE_BASE_URL ?? "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    // Cloudflare quick tunnels use random *.trycloudflare.com hosts
    allowedHosts: true,
    // Same-origin API via tunnel: phone → cloudflare → vite → backend
    proxy: {
      "/auth": { target: BACKEND, changeOrigin: true },
      "/owners": { target: BACKEND, changeOrigin: true },
      // Use trailing slash so SPA route /guest-bulk/:token is NOT proxied.
      // API paths are /guest/bulk/:token.
      "/guest/": { target: BACKEND, changeOrigin: true },
      "/drivers": { target: BACKEND, changeOrigin: true },
      "/admin": { target: BACKEND, changeOrigin: true },
      "/health": { target: BACKEND, changeOrigin: true },
    },
  },
});
