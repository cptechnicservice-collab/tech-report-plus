import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), refreshSession: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

import { activeAppUserId, getConfirmedUserId, recoverAppIdentity, rememberConfirmedUser, renewAppSession } from "@/lib/auth-session";

describe("authentication during stalled navigation", () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    values.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal("navigator", { onLine: true });
    auth.getSession.mockResolvedValue({ data: { session: { user: { id: "confirmed-user" } } }, error: null });
    rememberConfirmedUser("confirmed-user");
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("releases navigation when server validation never responds", async () => {
    auth.getUser.mockImplementation(() => new Promise(() => {}));
    const recovery = recoverAppIdentity();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await recovery).toMatchObject({ status: "transient", identity: { userId: "confirmed-user", offline: true } });
    expect(getConfirmedUserId()).toBe("confirmed-user");
  });

  it("does not keep access after an explicit online rejection", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Invalid JWT") });
    expect(await recoverAppIdentity()).toEqual({ status: "unauthenticated", identity: null });
    expect(getConfirmedUserId()).toBeNull();
  });

  it("opens offline without contacting authentication", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(await recoverAppIdentity()).toMatchObject({ status: "transient", identity: { userId: "confirmed-user" } });
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("does not invent an offline identity", async () => {
    values.clear();
    vi.stubGlobal("navigator", { onLine: false });
    expect(await recoverAppIdentity()).toEqual({ status: "unauthenticated", identity: null });
  });

  it("keeps offline writes scoped when session reads stall", async () => {
    auth.getSession.mockImplementation(() => new Promise(() => {}));
    const userId = activeAppUserId();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await userId).toBe("confirmed-user");
  });

  it("releases stalled renewal without signing out", async () => {
    auth.refreshSession.mockImplementation(() => new Promise(() => {}));
    const recovery = renewAppSession();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await recovery).toMatchObject({ status: "transient", identity: { userId: "confirmed-user" } });
  });
});