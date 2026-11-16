import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ pwa: vi.fn((options) => options) }));
vi.mock("@lovable.dev/vite-tanstack-config", () => ({ defineConfig: (config: unknown) => config }));
vi.mock("vite-plugin-pwa", () => ({ VitePWA: mocks.pwa }));

describe("offline startup policy", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("prepares the public root without discovering private pages", async () => {
    const { default: config } = await import("../vite.config");
    expect(config.tanstackStart?.pages).toEqual([{ path: "/" }]);
    expect(config.tanstackStart?.prerender).toEqual({ enabled: true, autoStaticPathsDiscovery: false });
    const options = mocks.pwa.mock.calls[0]?.[0];
    expect(options.workbox.additionalManifestEntries[0].url).toBe("/?offline-shell=1");
  });

  it("uses a network-first root fallback for unopened pages, never OAuth or API", async () => {
    await import("../vite.config");
    vi.stubGlobal("self", { location: { origin: "https://tech-report-plus.lovable.app" } });
    const options = mocks.pwa.mock.calls[0]?.[0];
    const navigation = options.workbox.runtimeCaching[0];
    const matches = (path: string) => navigation.urlPattern({ request: { mode: "navigate" }, url: new URL(path, self.location.origin) });
    expect(navigation.handler).toBe("NetworkFirst");
    expect(navigation.options.precacheFallback.fallbackURL).toBe("/?offline-shell=1");
    expect(matches("/relatorios-salvos")).toBe(true);
    expect(matches("/auth")).toBe(true);
    expect(matches("/~oauth/callback")).toBe(false);
    expect(matches("/api/public/webhook")).toBe(false);
    expect(matches("https://example.com/painel")).toBe(false);
  });
});