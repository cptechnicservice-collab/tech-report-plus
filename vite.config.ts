// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Evaluated at build time, never in the Worker. Each build retires its old runtime buckets.
const cacheVersion = process.env["GITHUB_SHA"] || Date.now().toString(36);

export default defineConfig({
  plugins: [VitePWA({
    strategies: "generateSW",
    filename: "sw.js",
    manifest: false,
    injectRegister: null,
    registerType: "autoUpdate",
    devOptions: { enabled: false },
    workbox: {
      cacheId: `cp-technic-${cacheVersion}`,
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
      globPatterns: ["**/*.{js,css,png,jpg,jpeg,svg,woff,woff2,webmanifest}"],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      navigateFallback: null,
      runtimeCaching: [
        { urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth") && url.pathname !== "/auth" && url.pathname !== "/reset-password", handler: "NetworkFirst", options: { cacheName: `cp-technic-pages-${cacheVersion}`, networkTimeoutSeconds: 10, cacheableResponse: { statuses: [200] } } },
        { urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.*-[\w-]+\.(js|css|woff2?)$/.test(url.pathname), handler: "CacheFirst", options: { cacheName: `cp-technic-hashed-${cacheVersion}`, cacheableResponse: { statuses: [200] } } },
        { urlPattern: ({ request, url }) => url.origin === self.location.origin && ["script", "style", "image", "font"].includes(request.destination), handler: "StaleWhileRevalidate", options: { cacheName: `cp-technic-static-${cacheVersion}`, cacheableResponse: { statuses: [200] } } },
      ],
    },
  })],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
