import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? 5173);

// Convex local backend (written to .env.local by `convex dev`). The browser
// talks to same-origin /api + /version, which the dev server proxies here,
// so the app works both in the sandbox and through Freebuff's preview tunnel.
function convexProxyTarget(): string {
  try {
    return new URL(process.env.VITE_CONVEX_URL ?? "http://127.0.0.1:3210")
      .origin;
  } catch {
    return "http://127.0.0.1:3210";
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: true,
    port,
    strictPort: true,
    // Freebuff requires HMR to remain disabled.
    hmr: false,
    proxy: {
      "/api": {
        target: convexProxyTarget(),
        changeOrigin: true,
        ws: true,
      },
      "/version": {
        target: convexProxyTarget(),
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port,
    strictPort: true,
  },
});
