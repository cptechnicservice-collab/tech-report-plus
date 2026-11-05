import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { changeAppAccess, resolveAppAccess, clearSavedAccess } from "@/lib/app-access";

describe("manual access approval", () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    vi.resetAllMocks(); storage.clear();
    vi.stubGlobal("localStorage", { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("a new account never gets free access", async () => {
    rpc.mockResolvedValue({ data: { status: "pending", admin: false }, error: null });
    expect(await resolveAppAccess("new-user", false)).toEqual({ status: "pending", admin: false });
    expect(await resolveAppAccess("new-user", true)).toEqual({ status: "pending", admin: false });
  });
  it("keeps server-approved access offline without granting admin powers", async () => {
    rpc.mockResolvedValue({ data: { status: "approved", admin: true }, error: null });
    expect(await resolveAppAccess("owner", false)).toEqual({ status: "approved", admin: true });
    expect(await resolveAppAccess("owner", true)).toEqual({ status: "approved", admin: false });
  });
  it("approval does not transfer to a different account", async () => {
    rpc.mockResolvedValue({ data: { status: "approved", admin: false }, error: null });
    await resolveAppAccess("paid-user", false);
    expect((await resolveAppAccess("other-user", true)).status).toBe("pending");
  });
  it("explicit blocking removes offline approval", async () => {
    rpc.mockResolvedValueOnce({ data: { status: "approved", admin: false }, error: null });
    await resolveAppAccess("paid-user", false);
    rpc.mockResolvedValueOnce({ data: { status: "blocked", admin: false }, error: null });
    expect((await resolveAppAccess("paid-user", false)).status).toBe("blocked");
    expect((await resolveAppAccess("paid-user", true)).status).toBe("pending");
  });
  it("network failure never approves a new user", async () => {
    rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    expect((await resolveAppAccess("new-user", false)).status).toBe("pending");
  });
  it("logout removes saved approval", async () => {
    rpc.mockResolvedValue({ data: { status: "approved", admin: false }, error: null });
    await resolveAppAccess("paid-user", false); clearSavedAccess("paid-user");
    expect((await resolveAppAccess("paid-user", true)).status).toBe("pending");
  });
  it("server rejection cannot become successful approval", async () => {
    rpc.mockResolvedValue({ error: { code: "42501", message: "Denied" } });
    await expect(changeAppAccess("someone", "approved")).rejects.toMatchObject({ code: "42501" });
    expect(rpc).toHaveBeenCalledWith("set_app_access", { target_user_id: "someone", new_status: "approved" });
  });
});