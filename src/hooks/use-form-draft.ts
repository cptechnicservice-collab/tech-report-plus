import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const PREFIX = "cp-technic-draft:";

export function useFormDraft<T>({ key, value, restore, enabled = true }: {
  key: string;
  value: T;
  restore: (value: T) => void;
  enabled?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const initial = useRef("");
  const storageKey = `${PREFIX}${key}`;
  const serialized = JSON.stringify(value);

  useEffect(() => {
    initial.current = JSON.stringify(value);
    if (!enabled) { setReady(true); return; }
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && saved !== initial.current) {
        restore(JSON.parse(saved) as T);
        toast.info("Rascunho recuperado", {
          action: { label: "Descartar", onClick: () => { window.localStorage.removeItem(storageKey); restore(JSON.parse(initial.current) as T); } },
        });
      }
    } catch { window.localStorage.removeItem(storageKey); }
    setReady(true);
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled || !ready || serialized === initial.current) return;
    const timer = window.setTimeout(() => window.localStorage.setItem(storageKey, serialized), 400);
    return () => window.clearTimeout(timer);
  }, [enabled, ready, serialized, storageKey]);

  const clearDraft = useCallback(() => {
    window.localStorage.removeItem(storageKey);
    initial.current = serialized;
  }, [serialized, storageKey]);

  return { clearDraft, isDirty: ready && serialized !== initial.current };
}