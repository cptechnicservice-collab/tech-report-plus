import { supabase } from "@/integrations/supabase/client";

export type AppAccess = { status: "pending" | "approved" | "blocked"; admin: boolean };
export type AccessUser = { id: string; email: string | null; created_at: string; status: "pending" | "approved" | "blocked" | "owner" };
const key = (userId: string) => `cp-technic-access:${userId}`;

export function clearSavedAccess(userId: string) {
  if (typeof localStorage !== "undefined") localStorage.removeItem(key(userId));
}

/** Offline continuity only. Administrative actions always validate the caller in PostgreSQL. */
export async function resolveAppAccess(userId: string, offline: boolean): Promise<AppAccess> {
  const fallback: AppAccess = { status: "pending", admin: false };
  const saved = typeof localStorage !== "undefined" && localStorage.getItem(key(userId)) === "approved";
  if (offline) return { status: saved ? "approved" : "pending", admin: false };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      supabase.rpc("get_app_access"),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Access check timed out")), 5000); }),
    ]);
    if (result.error) {
      // Authentication/permission rejection never grants offline access.
      if (["42501", "PGRST301", "PGRST302"].includes(result.error.code)) {
        clearSavedAccess(userId);
        return fallback;
      }
      throw result.error;
    }
    const data = result.data;
    if (!data || typeof data !== "object" || Array.isArray(data) ||
      !("status" in data) || !["pending", "approved", "blocked"].includes(String(data["status"]))) {
      clearSavedAccess(userId);
      return fallback;
    }
    const status = data["status"] as AppAccess["status"];
    if (status === "approved" && typeof localStorage !== "undefined") localStorage.setItem(key(userId), "approved");
    else clearSavedAccess(userId);
    return { status, admin: data["admin"] === true };
  } catch {
    return { status: saved ? "approved" : "pending", admin: false };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function listAccessUsers(): Promise<AccessUser[]> {
  const { data, error } = await supabase.rpc("list_app_users");
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Não foi possível carregar os usuários.");
  return data as unknown as AccessUser[];
}

export async function changeAppAccess(userId: string, status: "approved" | "blocked") {
  const { error } = await supabase.rpc("set_app_access", { target_user_id: userId, new_status: status });
  if (error) throw error;
}