import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";

let db: PGlite;
const superOne = "00000000-0000-4000-a000-000000000201";
const superTwo = "00000000-0000-4000-a000-000000000202";
const admin = "00000000-0000-4000-a000-000000000203";
const member = "00000000-0000-4000-a000-000000000204";

async function run<T extends Record<string, unknown>>(
  actor: string | null,
  sql: string,
  params: unknown[] = [],
  role = "authenticated",
) {
  await db.exec(`set role ${role}`);
  if (actor) await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
  try { return await db.query<T>(sql, params); }
  finally { await db.exec("reset role; reset request.jwt.claim.sub"); }
}

beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
}, 30000);

beforeEach(async () => {
  await db.exec("delete from public.audit_logs; delete from public.user_roles; delete from auth.users");
  for (const [id, email, name] of [
    [superOne, "owner@example.org", "Owner"], [superTwo, "backup@example.org", "Backup"],
    [admin, "admin@example.org", "Admin"], [member, "member@example.org", "Member"],
  ]) await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,jsonb_build_object('display_name',$3::text))", [id, email, name]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='super_admin'", [superOne]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='super_admin'", [superTwo]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='admin'", [admin]);
});

afterAll(async () => { await db?.close(); });

it("makes assignment tables RPC-only for API roles", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await expect(run(superOne, "delete from public.user_roles where user_id=$1", [member], role)).rejects.toThrow("permission denied");
    await expect(run(superOne, "delete from public.role_permissions", [], role)).rejects.toThrow("permission denied");
  }
  await expect(run(superOne, "select public.set_user_roles($1,$2)", [member, ["user"]], "service_role")).rejects.toThrow("permission denied");
});

it("gives administrators a private paged directory but reserves mutations for super admins", async () => {
  const result = (await run<{ data: { total: number; users: Array<{ email: string }>; roles: unknown[]; permissions: unknown[] } }>(
    admin, "select public.list_access_management(1,'member') data",
  )).rows[0].data;
  expect(result.total).toBe(1);
  expect(result.users).toEqual([expect.objectContaining({ email: "member@example.org" })]);
  expect(result.roles.length).toBeGreaterThan(5);
  expect(result.permissions.length).toBeGreaterThan(20);
  await expect(run(admin, "select public.set_user_roles($1,$2)", [member, ["user", "author"]])).rejects.toThrow("forbidden");
  await expect(run(member, "select public.list_access_management(1,'') data")).rejects.toThrow("forbidden");
});

it("assigns validated roles atomically and records only role codes in audit", async () => {
  expect((await run<{ changed: boolean }>(superOne, "select public.set_user_roles($1,$2) changed", [member, ["user", "editor"]])).rows[0]).toEqual({ changed: true });
  expect((await run<{ changed: boolean }>(superOne, "select public.set_user_roles($1,$2) changed", [member, ["editor", "user"]])).rows[0]).toEqual({ changed: false });
  const assignments = await db.query<{ code: string; assigned_by: string | null }>("select r.code,ur.assigned_by from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=$1 order by r.code", [member]);
  expect(assignments.rows).toEqual([{ code: "editor", assigned_by: superOne }, { code: "user", assigned_by: null }]);
  const audit = (await db.query<{ action: string; old_data: Record<string, unknown>; new_data: Record<string, unknown> }>("select action,old_data,new_data from public.audit_logs")).rows;
  expect(audit).toEqual([{ action: "roles_updated", old_data: { roles: ["user"] }, new_data: { roles: ["editor", "user"] } }]);
  expect(JSON.stringify(audit)).not.toContain("member@example.org");
  for (const roles of [["editor"], ["user", "unknown"], ["user", "user"]]) {
    await expect(run(superOne, "select public.set_user_roles($1,$2)", [member, roles])).rejects.toThrow("invalid_roles");
  }
});

it("serializes super-admin removal and never permits removing the final one", async () => {
  await run(superOne, "select public.set_user_roles($1,$2)", [superTwo, ["user"]]);
  await expect(run(superOne, "select public.set_user_roles($1,$2)", [superOne, ["user"]])).rejects.toThrow("last_super_admin");
  const remaining = await db.query<{ id: string }>("select ur.user_id id from public.user_roles ur join public.roles r on r.id=ur.role_id where r.code='super_admin'");
  expect(remaining.rows).toEqual([{ id: superOne }]);
});

it("edits non-system permission sets with audit while preserving the admin boundary", async () => {
  expect((await run<{ changed: boolean }>(superOne, "select public.set_role_permissions('editor',$1) changed", [["admin.access", "articles.create"]])).rows[0]).toEqual({ changed: true });
  const granted = await db.query<{ code: string }>("select p.code from public.role_permissions rp join public.roles r on r.id=rp.role_id join public.permissions p on p.id=rp.permission_id where r.code='editor' order by p.code");
  expect(granted.rows.map(row => row.code)).toEqual(["admin.access", "articles.create"]);
  expect((await db.query<{ action: string }>("select action from public.audit_logs")).rows).toEqual([{ action: "role_permissions_updated" }]);
  for (const [role, permissions, error] of [
    ["admin", ["admin.access"], "protected_role"],
    ["super_admin", ["admin.access"], "protected_role"],
    ["editor", ["admin.access", "roles.manage"], "invalid_permissions"],
  ] as const) await expect(run(superOne, "select public.set_role_permissions($1,$2)", [role, permissions])).rejects.toThrow(error);
});

it("automatically gives newly created accounts only the inert user role", async () => {
  const id = "00000000-0000-4000-a000-000000000205";
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'new@example.org','{}')", [id]);
  const roles = await db.query<{ code: string }>("select r.code from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=$1", [id]);
  expect(roles.rows).toEqual([{ code: "user" }]);
});
