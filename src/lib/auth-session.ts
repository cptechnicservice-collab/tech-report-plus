import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

const CONFIRMED_USER_ID_KEY = "cp-technic-confirmed-user-id";

export type AppIdentity = {
  user: User | { id: string };
  userId: string;
  offline: boolean;
};

export type SessionRecovery =
  | { status: "authenticated"; identity: AppIdentity }
  | { status: "transient"; identity: AppIdentity | null }
  | { status: "unauthenticated"; identity: null };

export function getConfirmedUserId() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(CONFIRMED_USER_ID_KEY);
}

export function rememberConfirmedUser(userId: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(CONFIRMED_USER_ID_KEY, userId);
}

export function clearConfirmedUser() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(CONFIRMED_USER_ID_KEY);
}

export function isTransientAuthError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (isAuthRetryableFetchError(error)) return true;
  if (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  )
    return true;
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError"))
    return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|load failed|networkerror|network request failed|timed? ?out/i.test(
    message,
  );
}

function localIdentity(): AppIdentity | null {
  const userId = getConfirmedUserId();
  return userId ? { user: { id: userId }, userId, offline: true } : null;
}

/**
 * Resolves the current identity without treating a temporary network outage as logout.
 * Server authorization remains authoritative whenever the network can be reached.
 */
export async function recoverAppIdentity(): Promise<SessionRecovery> {
  const fallback = localIdentity();

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      if (sessionError && isTransientAuthError(sessionError)) {
        return { status: "transient", identity: fallback };
      }
      clearConfirmedUser();
      return { status: "unauthenticated", identity: null };
    }

    rememberConfirmedUser(session.user.id);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return {
        status: "authenticated",
        identity: { user: session.user, userId: session.user.id, offline: true },
      };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userData.user) {
      rememberConfirmedUser(userData.user.id);
      return {
        status: "authenticated",
        identity: { user: userData.user, userId: userData.user.id, offline: false },
      };
    }
    if (userError && isTransientAuthError(userError)) {
      return {
        status: "transient",
        identity: { user: session.user, userId: session.user.id, offline: true },
      };
    }

    clearConfirmedUser();
    return { status: "unauthenticated", identity: null };
  } catch (error) {
    if (isTransientAuthError(error)) return { status: "transient", identity: fallback };
    clearConfirmedUser();
    return { status: "unauthenticated", identity: null };
  }
}

export async function activeAppUserId() {
  const fallbackUserId = getConfirmedUserId();
  try {
    const { data, error } = await supabase.auth.getSession();
    if (data.session?.user.id) {
      rememberConfirmedUser(data.session.user.id);
      return data.session.user.id;
    }
    if (error && isTransientAuthError(error)) return fallbackUserId;
    clearConfirmedUser();
    return null;
  } catch (error) {
    if (isTransientAuthError(error)) return fallbackUserId;
    clearConfirmedUser();
    return null;
  }
}
