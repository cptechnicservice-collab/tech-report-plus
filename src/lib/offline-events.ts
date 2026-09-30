export const OPEN_SYNC_PANEL_EVENT = "cp-open-sync-panel";

export function openSyncPanel() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_SYNC_PANEL_EVENT));
}