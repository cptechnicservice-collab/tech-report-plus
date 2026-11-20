import { supabase } from "@/integrations/supabase/client";
import { getConfirmedUserId, isTransientAuthError, recoverAppIdentity, type AppIdentity } from "@/lib/auth-session";
import { hasSavedApproval, resolveAppAccess, type AppAccess } from "@/lib/app-access";

export const ACCESS_TTL_MS = 10 * 60 * 1000;
export const ACCESS_REJECTED_EVENT = "cp-technic-access-rejected";
export const ACCESS_UPDATED_EVENT = "cp-technic-access-updated";
type Verification = { identity: AppIdentity; access: AppAccess; checkedAt: number };
type Result = { identity: AppIdentity | null; access: AppAccess | null };
let verified: Verification | null = null;
let generation = 0;
let inFlight: Promise<Result> | null = null;

export function invalidateNavigationAccess() {
  generation += 1;
  verified = null;
  inFlight = null;
}

function notifyRejected(path: "/auth" | "/acesso-pendente") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ACCESS_REJECTED_EVENT, { detail: path }));
}

async function validateInBackground(): Promise<Result> {
  if (inFlight) return inFlight;
  const currentGeneration = generation;
  const task = (async () => {
    const recovery = await recoverAppIdentity();
    const identity = recovery.identity;
    const access = identity ? await resolveAppAccess(identity.userId, identity.offline) : null;
    if (generation !== currentGeneration) return { identity: null, access: null };
    if (!identity || access?.status !== "approved") {
      verified = null;
      notifyRejected(identity ? "/acesso-pendente" : "/auth");
    } else {
      const previousAccess = verified?.access;
      verified = { identity, access, checkedAt: identity.offline ? 0 : Date.now() };
      if (typeof window !== "undefined" && !identity.offline &&
        (previousAccess?.admin !== access.admin || previousAccess?.role !== access.role)) {
        window.dispatchEvent(new Event(ACCESS_UPDATED_EVENT));
      }
    }
    return { identity, access };
  })();
  inFlight = task;
  try { return await task; }
  finally { if (inFlight === task) inFlight = null; }
}

/** Focus/reconnection only renew an expired verification; never invalidate visible queries. */
export function revalidateNavigationAccess() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (!getConfirmedUserId()) return;
  if (verified && Date.now() - verified.checkedAt < ACCESS_TTL_MS) return;
  void validateInBackground();
}

/** This is only navigation continuity; server RLS remains the authorization boundary. */
export async function resolveNavigationAccess(): Promise<Result> {
  const start = performance.now();
  let mode = "network";
  try {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      mode = "offline";
      const userId = getConfirmedUserId();
      if (userId && hasSavedApproval(userId)) {
        return { identity: { user: { id: userId }, userId, offline: true }, access: { status: "approved", admin: false, role: "technician" } };
      }
      return { identity: null, access: null };
    }
    // getSession normally reads the local session. A stalled refresh retains the existing recovery path.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const { data, error } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("Session timeout"), { name: "TimeoutError" })), 5000); }),
      ]);
      if (error && !isTransientAuthError(error)) return await validateInBackground();
      const session = data.session;
      if (session) {
        const identity: AppIdentity = { user: session.user, userId: session.user.id, offline: false };
        if (verified?.identity.userId === identity.userId && Date.now() - verified.checkedAt < ACCESS_TTL_MS) {
          mode = "memory";
          return { identity, access: verified.access };
        }
        if (hasSavedApproval(identity.userId)) {
          mode = "local-background";
          const access: AppAccess = verified?.identity.userId === identity.userId ? verified.access : { status: "approved", admin: false, role: "technician" };
          void validateInBackground();
          return { identity, access };
        }
      }
    } catch (error) {
      if (!isTransientAuthError(error)) throw error;
    } finally { if (timer !== undefined) clearTimeout(timer); }
    return await validateInBackground();
  } finally {
    console.debug("[performance] beforeLoad", { mode, ms: Math.round((performance.now() - start) * 100) / 100 });
  }
}