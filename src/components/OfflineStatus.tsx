import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { pendingCount, subscribeOfflineStatus, syncOfflineQueue } from "@/lib/offline";

export function OfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine);
      void pendingCount().then(setPending);
    };
    const sync = () => void syncOfflineQueue().then(() => {
      void queryClient.invalidateQueries({ queryKey: ["clientes"] });
      void queryClient.invalidateQueries({ queryKey: ["apontamentos"] });
    }).finally(refresh);
    refresh();
    void syncOfflineQueue().finally(refresh);
    window.addEventListener("online", sync);
    const unsubscribe = subscribeOfflineStatus(refresh);
    return () => {
      window.removeEventListener("online", sync);
      unsubscribe();
    };
  }, [queryClient]);

  if (online && pending === 0) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center pt-[env(safe-area-inset-top)] pointer-events-none">
      <p className="rounded-b-xl border border-t-0 border-border bg-card px-3 py-1 text-xs font-medium shadow-sm">
        {!online ? "Offline" : null}
        {!online && pending > 0 ? " · " : null}
        {pending > 0 ? `${pending} pendente${pending === 1 ? "" : "s"} de envio` : null}
      </p>
    </div>
  );
}