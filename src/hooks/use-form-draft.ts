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
  const [baseline, setBaseline] = useState("");
  const restoreRef = useRef(restore);
  const storageKey = `${PREFIX}${key}`;
  const serialized = JSON.stringify(value);
  restoreRef.current = restore;

  useEffect(() => {
    const startingValue = JSON.stringify(value);
    setBaseline(startingValue);
    if (!enabled) { setReady(true); return; }
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved && saved !== startingValue) {
        restoreRef.current(JSON.parse(saved) as T);
        toast.info("Rascunho recuperado", {
          action: { label: "Descartar", onClick: () => { window.localStorage.removeItem(storageKey); restoreRef.current(JSON.parse(startingValue) as T); } },
        });
      }
    } catch { window.localStorage.removeItem(storageKey); }
    setReady(true);
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled || !ready || serialized === baseline) return;
    const timer = window.setTimeout(() => window.localStorage.setItem(storageKey, serialized), 400);
    return () => window.clearTimeout(timer);
  }, [enabled, ready, serialized, storageKey]);

  const clearDraft = useCallback(() => {
    window.localStorage.removeItem(storageKey);
    setBaseline(serialized);
  }, [serialized, storageKey]);

  return { clearDraft, isDirty: ready && serialized !== baseline };
}