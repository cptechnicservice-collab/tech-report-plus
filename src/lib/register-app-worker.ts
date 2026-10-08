/** The single app-shell worker registrar; messaging workers are never touched. */
export async function registerAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const host = window.location.hostname;
  const blocked = !import.meta.env.PROD || window.self !== window.top ||
    host.startsWith("id-preview--") || host.startsWith("preview--") ||
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
  await registration.update();
}