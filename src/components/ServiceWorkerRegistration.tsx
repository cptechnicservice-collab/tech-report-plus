import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (import.meta.env.PROD) {
      if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
      return;
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
    }
    if ("caches" in window) {
      void caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("cp-technic")).map((key) => caches.delete(key))),
      );
    }
  }, []);
  return null;
}