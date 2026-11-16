/** The single app-shell worker registrar; messaging workers are never touched. */
export async function registerAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const host = window.location.hostname.toLowerCase();
  const previewHost = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host) ||
    /^project--.+-dev\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  const blocked = !import.meta.env.PROD || window.self !== window.top ||
    previewHost ||
    ["lovableproject.com", "lovableproject-dev.com", "beta.lovable.dev"].some(domain => host === domain || host.endsWith(`.${domain}`)) ||
    new URLSearchParams(window.location.search).get("sw") === "off";
  if (blocked) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(registration => {
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      return worker && new URL(worker.scriptURL).origin === window.location.origin && new URL(worker.scriptURL).pathname === "/sw.js";
    }).map(registration => registration.unregister()));
    if ("caches" in window) {
      await Promise.all((await caches.keys()).filter(key => key.startsWith("cp-technic")).map(key => caches.delete(key)));
    }
    return;
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  // An offline update failure must not discard an already installed worker.
  if (navigator.onLine) await registration.update().catch(() => undefined);
}