import { useBlocker } from "@tanstack/react-router";

export function useUnsavedChanges(isDirty: boolean) {
  useBlocker({
    shouldBlockFn: () => isDirty && !window.confirm("Há alterações não salvas. Deseja sair mesmo assim?"),
    enableBeforeUnload: () => isDirty,
  });
}