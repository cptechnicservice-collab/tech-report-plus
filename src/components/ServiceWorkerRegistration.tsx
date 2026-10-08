import { useEffect } from "react";
import { registerAppWorker } from "@/lib/register-app-worker";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    void registerAppWorker().catch(() => undefined);
  }, []);
  return null;
}