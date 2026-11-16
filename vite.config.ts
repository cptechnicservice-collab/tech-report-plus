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
    // TanStack's deployable public files live in the client environment output.
    outDir: "dist/client",
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
      // A visitor-independent root document is always available, even for an
      // address never previously opened under service-worker control.
      additionalManifestEntries: [{ url: "/", revision: cacheVersion }],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      navigateFallback: null,
      runtimeCaching: [
        { urlPattern: ({ request, url }) => request.mode === "navigate" && url.origin === self.location.origin && !url.pathname.startsWith("/~oauth") && !url.pathname.startsWith("/api/"), handler: "NetworkFirst", options: { cacheName: `cp-technic-pages-${cacheVersion}`, networkTimeoutSeconds: 5, cacheableResponse: { statuses: [200] }, precacheFallback: { fallbackURL: "/" } } },
        { urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.*-[\w-]+\.(js|css|woff2?)$/.test(url.pathname), handler: "CacheFirst", options: { cacheName: `cp-technic-hashed-${cacheVersion}`, cacheableResponse: { statuses: [200] } } },
        { urlPattern: ({ request, url }) => url.origin === self.location.origin && ["script", "style", "image", "font"].includes(request.destination), handler: "StaleWhileRevalidate", options: { cacheName: `cp-technic-static-${cacheVersion}`, cacheableResponse: { statuses: [200] } } },
      ],
    },
  })],
  tanstackStart: {
    // Only the ssr:false root shell is static; no private route is prerendered.
    pages: [{ path: "/" }],
    prerender: { enabled: true, autoStaticPathsDiscovery: false },
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
