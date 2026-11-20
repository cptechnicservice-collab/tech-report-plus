import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Real PostgreSQL functions/RLS in an isolated in-memory database. No hosted credentials or records.
const migration = readFileSync(new URL("../drizzle/migrations/0030_account_owner_and_delegated_admin.sql", import.meta.url), "utf8");
const owner = "10000000-0000-0000-0000-000000000001";
const admin = "10000000-0000-0000-0000-000000000002";
const technician = "10000000-0000-0000-0000-000000000003";
const blocked = "10000000-0000-0000-0000-000000000004";
const pending = "10000000-0000-0000-0000-000000000005";
type Access = { role: string; status: string; admin: boolean };
let db: PGlite;

async function asUser(userId: string) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("SET ROLE authenticated");
}
async function access() {
  const result = await db.query<{ access: Access }>("SELECT public.get_app_access() AS access");
  const row = result.rows[0];
  if (!row) throw new Error("Missing access response");
  return row.access;
}
async function grantAdmin() {
  await asUser(owner);
  await db.query("SELECT public.set_account_role($1, 'admin')", [admin]);
}

describe("account roles enforced in PostgreSQL", () => {
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated, anon;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, created_at timestamptz DEFAULT now());
      CREATE TYPE public.app_role AS ENUM ('admin', 'user');
      CREATE TABLE public.user_roles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES auth.users(id), role public.app_role, UNIQUE(user_id, role));
      GRANT SELECT ON public.user_roles TO authenticated;
      ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
      CREATE POLICY roles_read_self ON public.user_roles FOR SELECT TO authenticated USING(user_id = auth.uid());
      CREATE TABLE public.app_access(user_id uuid PRIMARY KEY, status text DEFAULT 'pending', updated_at timestamptz DEFAULT now(), updated_by uuid);
      GRANT SELECT ON public.app_access TO authenticated;
      ALTER TABLE public.app_access ENABLE ROW LEVEL SECURITY;
      CREATE POLICY access_read_self ON public.app_access FOR SELECT TO authenticated USING(user_id = auth.uid());
      INSERT INTO auth.users(id,email) VALUES
        ('${owner}', 'owner@example.test'), ('${admin}', 'admin@example.test'),
        ('${technician}', 'technician@example.test'), ('${blocked}', 'blocked@example.test'), ('${pending}', 'pending@example.test');
      INSERT INTO public.user_roles(user_id,role) VALUES ('${owner}', 'admin');
      INSERT INTO public.app_access(user_id,status) VALUES
        ('${owner}','pending'), ('${admin}','approved'), ('${technician}','approved'), ('${blocked}','blocked'), ('${pending}','pending');
    `);
    await db.exec(migration);
    await db.exec(`
      CREATE TABLE public.private_records(user_id uuid, value text);
      GRANT SELECT ON public.private_records TO authenticated;
      ALTER TABLE public.private_records ENABLE ROW LEVEL SECURITY;
      CREATE POLICY own_records ON public.private_records FOR SELECT TO authenticated USING(user_id=auth.uid());
      CREATE POLICY require_approved_access ON public.private_records AS RESTRICTIVE FOR ALL TO authenticated USING(public.has_app_access());
      INSERT INTO public.private_records VALUES ('${owner}', 'owner-data'), ('${technician}', 'technician-data');
    `);
  }, 20_000);
  afterEach(async () => { await db.close(); });

  it("preserves the existing administrator as owner without modifying access statuses", async () => {
    const statuses = await db.query<{ status: string }>("SELECT status FROM public.app_access ORDER BY user_id");
    expect(statuses.rows.map(row => row.status)).toEqual(["pending", "approved", "approved", "blocked", "pending"]);
    await asUser(owner);
    expect(await access()).toEqual({ role: "owner", admin: true, status: "approved" });
  });
  it("automatically grants the first authenticated account sole ownership in a fresh copy", async () => {
    // Reset only isolated fixtures to emulate a copy with no previous administrator/owner.
    await db.exec("TRUNCATE public.app_owner, public.user_roles");
    await asUser(technician);
    expect(await access()).toEqual({ role: "owner", admin: true, status: "approved" });
    await asUser(pending);
    expect(await access()).toEqual({ role: "technician", admin: false, status: "pending" });
    await db.exec("RESET ROLE");
    const rows = await db.query<{ user_id: string }>("SELECT user_id FROM public.app_owner");
    expect(rows.rows).toEqual([{ user_id: technician }]);
    await expect(db.query("INSERT INTO public.app_owner(user_id) VALUES ($1)", [pending])).rejects.toMatchObject({ code: "23505" });
  });
  it("does not assign an owner to unauthenticated requests", async () => {
    await db.exec("TRUNCATE public.app_owner, public.user_roles");
    await asUser("");
    await expect(access()).rejects.toMatchObject({ code: "42501" });
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT * FROM public.app_owner")).rows).toEqual([]);
  });
  it("an admin cannot block the owner", async () => {
    await grantAdmin(); await asUser(admin);
    await expect(db.query("SELECT public.set_app_access($1, 'blocked')", [owner])).rejects.toMatchObject({ code: "42501" });
  });
  it("an admin cannot block another admin or their own account", async () => {
    await grantAdmin();
    await db.query("SELECT public.set_account_role($1, 'admin')", [technician]);
    await asUser(admin);
    await expect(db.query("SELECT public.set_app_access($1, 'blocked')", [technician])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("SELECT public.set_app_access($1, 'blocked')", [admin])).rejects.toMatchObject({ code: "42501" });
  });
  it("an admin approves and blocks technicians", async () => {
    await grantAdmin(); await asUser(admin);
    await db.query("SELECT public.set_app_access($1, 'approved')", [pending]);
    await asUser(pending); expect((await access()).status).toBe("approved");
    await asUser(admin); await db.query("SELECT public.set_app_access($1, 'blocked')", [pending]);
    await asUser(pending); expect((await access()).status).toBe("blocked");
  });
  it("technicians cannot list accounts or manage access", async () => {
    await asUser(technician);
    await expect(db.query("SELECT public.list_app_users()")).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("SELECT public.set_app_access($1, 'approved')", [pending])).rejects.toMatchObject({ code: "42501" });
  });
  it("the owner cannot block or demote themselves", async () => {
    await asUser(owner);
    await expect(db.query("SELECT public.set_app_access($1, 'blocked')", [owner])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("SELECT public.set_account_role($1, 'technician')", [owner])).rejects.toMatchObject({ code: "42501" });
    expect((await access()).role).toBe("owner");
  });
  it("only the owner can promote and demote admins without changing payment approval", async () => {
    await asUser(owner); await db.query("SELECT public.set_account_role($1, 'admin')", [technician]);
    await asUser(technician); expect(await access()).toEqual({ role: "admin", admin: true, status: "approved" });
    await expect(db.query("SELECT public.set_account_role($1, 'admin')", [pending])).rejects.toMatchObject({ code: "42501" });
    await asUser(owner); await db.query("SELECT public.set_account_role($1, 'technician')", [technician]);
    await asUser(technician); expect(await access()).toEqual({ role: "technician", admin: false, status: "approved" });
  });
  it("a blocked admin has no management permission or app access", async () => {
    await grantAdmin(); await db.query("SELECT public.set_app_access($1, 'blocked')", [admin]);
    await asUser(admin); expect(await access()).toEqual({ role: "admin", admin: false, status: "blocked" });
    await expect(db.query("SELECT public.list_app_users()")).rejects.toMatchObject({ code: "42501" });
  });
  it("ownership and admin status do not grant access to other users' private records", async () => {
    await grantAdmin();
    expect((await db.query("SELECT value FROM public.private_records")).rows).toEqual([{ value: "owner-data" }]);
    await asUser(admin);
    expect((await db.query("SELECT value FROM public.private_records")).rows).toEqual([]);
  });
  it("authenticated users cannot bypass RPCs by changing ownership or roles directly", async () => {
    await asUser(owner);
    await expect(db.query("UPDATE public.app_owner SET user_id=$1", [technician])).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("INSERT INTO public.user_roles(user_id,role) VALUES ($1,'admin')", [technician])).rejects.toMatchObject({ code: "42501" });
  });
});