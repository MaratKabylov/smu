import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import type { SupportInput, SupportKind, SupportRecord } from "../src/lib/validation/support-request";
let db: PGlite;
const own = "00000000-0000-4000-a000-000000000091", other = "00000000-0000-4000-a000-000000000092", admin = "00000000-0000-4000-a000-000000000093", unconfirmed = "00000000-0000-4000-a000-000000000094", anonymous = "00000000-0000-4000-a000-000000000095", specialist = "00000000-0000-4000-a000-000000000096";
const input = (kind: SupportKind = "research_proposal", extra: Record<string, unknown> = {}): SupportInput => ({ kind, locale: "ru", title: "Scientific research request", description: "SECRET description of a scientific research request.", contactName: "Secret Contact", email: `${own}@example.org`, organization: "SECRET ORG", consent: true,
  details: kind === "research_proposal" ? { importance: "Regional significance", region: "Aktobe", availableData: "SECRET data" } : kind === "it_request" ? { currentProcess: "Manual data collection", desiredSolution: "A research application", dataDescription: "SECRET data" } : { journal: "Scientific journal", manuscriptStage: "Draft manuscript", supportNeeded: "Editing and submission" }, ...extra } as SupportInput);
async function run<T = Record<string, unknown>>(actor: string | null, sql: string, args: unknown[] = [], role = actor ? "authenticated" : "anon") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return (await db.query<T>(sql, args)).rows; }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function submit(data: unknown = input(), owner: string | null = own, files: unknown[] = [], id = crypto.randomUUID()) {
  return (await run<{ id: string }>(null, "select public.submit_support_request($1,$2,$3,$4) id", [id, JSON.stringify(data), JSON.stringify(files), owner], "service_role"))[0].id;
}
async function list(actor = own, kind: SupportKind = "research_proposal", id: string | null = null, manage = false, page = 1, status = "all") {
  return (await run<{ data: { total: number; items: SupportRecord[] } }>(actor, "select public.list_support_requests($1,$2,$3,$4,$5) data", [kind, status, page, id, manage]))[0].data;
}
const update = (id: string, version = 1, status = "in_review", assigned: string | null = null, actor = admin, priority = "normal", note = "SECRET staff note") => run(actor, "select public.update_support_request($1,$2,$3,$4,$5,$6)", [id, version, status, priority, assigned, note]);
beforeAll(async () => {
  db = await createMigrationDatabase({ through: 34 });
  await db.exec("alter table auth.users add column email_confirmed_at timestamptz; alter table auth.users add column is_anonymous boolean default false");
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const id of [own, other, admin, unconfirmed, anonymous, specialist]) await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values($1,$2,$3,$4,'{\"role\":\"super_admin\"}')", [id, `${id}@example.org`, id === unconfirmed ? null : "2026-10-17", id === anonymous]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='super_admin'", [admin]);
  await db.exec("insert into public.roles(code,name) values('support_specialist','Support specialist')");
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='support_specialist'", [specialist]);
  await db.exec(await readFile(new URL("./migrations/035_support_requests.sql", import.meta.url), "utf8"));
  await db.exec("insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='support_specialist' and p.code in ('admin.access','it_requests.manage') on conflict do nothing");
}, 30000);
beforeEach(async () => { await db.exec("truncate public.support_request_files,public.support_requests,public.audit_logs"); });
afterAll(async () => { await db?.close(); });

it.each(["research_proposal", "it_request", "publication_support"] as const)("accepts %s and exposes distinct private owner and manager projections", async kind => {
  const id = await submit(input(kind));
  expect((await list(own, kind, id)).items[0]).toMatchObject({ id, kind, status: "new", description: expect.stringContaining("SECRET"), files: [] });
  expect(JSON.stringify(await list(own, kind, id))).not.toMatch(/email|contactName|managerNote|assignedTo|version/);
  expect(JSON.stringify(await list(own, kind))).not.toMatch(/SECRET|description|details|files/);
  expect((await list(admin, kind, id, true)).items[0]).toMatchObject({ email: input().email, version: 1, priority: "normal", assignedTo: null });
});
it("supports guests without claiming someone else's account by email", async () => {
  const id = await submit(input(), null);
  expect((await list(own, "research_proposal", id)).items).toEqual([]);
  expect((await list(admin, "research_proposal", id, true)).items).toHaveLength(1);
  expect((await db.query("select owner_id from public.support_requests where id=$1", [id])).rows[0]).toEqual({ owner_id: null });
});
it("limits ingress to trusted service role; denies direct reads, writes and internal helpers", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const table of ["support_requests", "support_request_files"]) {
      await expect(run(own, `select * from public.${table}`, [], role)).rejects.toThrow("permission denied");
      await expect(run(own, `delete from public.${table}`, [], role)).rejects.toThrow("permission denied");
    }
    await expect(run(own, "select public.smu_can_manage_support($1,'it_request')", [own], role)).rejects.toThrow("permission denied");
  }
  for (const role of ["anon", "authenticated"]) await expect(run(own, "select public.submit_support_request($1,$2,'[]',null)", [crypto.randomUUID(), JSON.stringify(input())], role)).rejects.toThrow("permission denied");
  await expect(run(null, "select public.list_support_requests('it_request')")).rejects.toThrow("permission denied");
});
it("requires live confirmed nonanonymous accounts and per-kind permissions regardless of metadata", async () => {
  const id = await submit();
  for (const actor of [own, other, specialist, unconfirmed, anonymous]) {
    await expect(update(id, 1, "in_review", null, actor)).rejects.toThrow("forbidden");
    await expect(list(actor, "research_proposal", id, true)).rejects.toThrow("forbidden");
  }
  for (const actor of [unconfirmed, anonymous]) await expect(list(actor)).rejects.toThrow("forbidden");
  expect((await list(other, "research_proposal", id)).items).toEqual([]);
  // Even an admin's account view contains only their own requests.
  expect((await list(admin, "research_proposal", id)).items).toEqual([]);
  await submit(input("it_request")); expect((await list(specialist, "it_request", null, true)).total).toBe(1);
});
it("checks owner against live Auth email and never links unverified or anonymous accounts", async () => {
  for (const owner of [other, unconfirmed, anonymous]) await expect(submit(input(), owner)).rejects.toThrow("forbidden");
  await expect(submit(input("it_request", { email: "forged@example.org" }))).rejects.toThrow("forbidden");
});
it("validates consent, mandatory fields and detail shapes independently of the application", async () => {
  for (const extra of [{ consent: false }, { consent: "true" }, { title: "x" }, { description: 12 }, { locale: "de" }, { email: "bad" }, { details: {} }, { details: { ...input().details, importance: "x" } }, { details: { ...input().details, region: "x".repeat(5001) } }]) await expect(submit(input("research_proposal", extra))).rejects.toThrow("invalid_input");
  const id = await submit({ ...input(), details: { ...input().details, secret: "EXTRA" }, owner_id: other, status: "completed" });
  expect((await list(own, "research_proposal", id)).items[0].status).toBe("new");
  expect(JSON.stringify(await list(own, "research_proposal", id))).not.toContain("EXTRA");
});
it("serializes a shared per-email hourly limit across request kinds", async () => {
  for (const kind of ["research_proposal", "it_request", "publication_support"] as const) await submit(input(kind));
  await expect(submit()).rejects.toThrow("rate_limited");
  expect((await db.query("select * from public.support_requests")).rows).toHaveLength(3);
  await db.exec("update public.support_requests set created_at=now()-interval '61 minutes'");
  await submit();
});
it("enforces workflow, assignment permissions, current versions and no-op idempotency", async () => {
  const id = await submit();
  await expect(update(id, 1, "completed")).rejects.toThrow("invalid_transition");
  for (const assignee of [own, specialist, unconfirmed, anonymous]) await expect(update(id, 1, "in_review", assignee)).rejects.toThrow("invalid_assignee");
  await update(id, 1, "in_review", admin);
  await expect(update(id, 1, "in_progress", admin)).rejects.toThrow("stale_version");
  await update(id, 2, "in_review", admin); // no change, no new audit/version
  expect((await list(admin, "research_proposal", id, true)).items[0].version).toBe(2);
  await update(id, 2, "in_progress", admin); await update(id, 3, "completed", admin); await update(id, 4, "in_review", null);
  const row = (await list(admin, "research_proposal", id, true)).items[0]; expect(row).toMatchObject({ status: "in_review", version: 5, assignedTo: null });
  expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(5);
});
it("offers only eligible assignees per queue and rechecks permission revocation", async () => {
  const options = async (kind: string) => (await run<{ data: { id: string }[] }>(admin, "select public.support_request_assignees($1) data", [kind]))[0].data;
  expect((await options("research_proposal")).map(p => p.id)).toEqual([admin]);
  expect((await options("it_request")).map(p => p.id).sort()).toEqual([admin, specialist].sort());
  const id = await submit(input("it_request")); await update(id, 1, "in_review", specialist, specialist);
  await db.exec("delete from public.role_permissions where role_id=(select id from public.roles where code='support_specialist') and permission_id=(select id from public.permissions where code='it_requests.manage')");
  try {
    await expect(list(specialist, "it_request", id, true)).rejects.toThrow("forbidden");
    await expect(update(id, 2, "in_progress", specialist)).rejects.toThrow("invalid_assignee");
  } finally { await db.exec("insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='support_specialist' and p.code='it_requests.manage'"); }
});
it("protects attachments by request, ownership and queue permissions; never lists paths", async () => {
  const id = crypto.randomUUID(), fileId = crypto.randomUUID();
  const file = { id: fileId, path: `${id}/${fileId}`, name: "private.pdf", size: 128, mimeType: "application/pdf" };
  await submit(input(), own, [file], id);
  const resolve = async (actor: string, requestId = id) => (await run<{ data: unknown }>(actor, "select public.resolve_support_request_file($1,$2) data", [requestId, fileId]))[0].data;
  expect(await resolve(own)).toEqual({ path: file.path, name: file.name }); expect(await resolve(admin)).toEqual({ path: file.path, name: file.name });
  expect(await resolve(other)).toBeNull(); expect(await resolve(specialist)).toBeNull(); expect(await resolve(own, crypto.randomUUID())).toBeNull();
  expect(JSON.stringify(await list(own, "research_proposal", id))).not.toMatch(/storage_path|path/);
  const guestId = crypto.randomUUID(), guestFileId = crypto.randomUUID();
  await submit(input(), null, [{ ...file, id: guestFileId, path: `${guestId}/${guestFileId}` }], guestId);
  expect((await run<{ data: unknown }>(own, "select public.resolve_support_request_file($1,$2) data", [guestId, guestFileId]))[0].data).toBeNull();
});
it("rejects invalid file metadata and rolls back the entire submission", async () => {
  for (const bad of [{ name: "../bad.pdf" }, { size: 1048577 }, { size: 0 }, { mimeType: "text/html" }, { path: "different/path" }]) {
    const id = crypto.randomUUID(), file = crypto.randomUUID();
    await expect(submit(input(), own, [{ id: file, path: `${id}/${file}`, name: "file.pdf", size: 30, mimeType: "application/pdf", ...bad }], id)).rejects.toThrow();
  }
  expect((await db.query("select * from public.support_requests")).rows).toEqual([]);
  expect((await db.query("select * from public.audit_logs")).rows).toEqual([]);
});
it("filters and paginates queues stably without contacts or body in list DTOs", async () => {
  for (let n = 0; n < 21; n++) await submit(input("it_request", { email: `guest${n}@example.org` }), null);
  const first = await list(admin, "it_request", null, true); const second = await list(admin, "it_request", null, true, 2);
  expect(first.total).toBe(21); expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(1);
  expect(new Set([...first.items, ...second.items].map(r => r.id)).size).toBe(21);
  expect(JSON.stringify(first)).not.toMatch(/SECRET|email|managerNote|contactName/);
  await update(first.items[0].id); expect((await list(admin, "it_request", null, true, 1, "in_review")).total).toBe(1);
  await expect(list(admin, "it_request", null, true, 0)).rejects.toThrow("invalid_input");
});
it("keeps audit free of contacts, content, notes, filenames and storage paths", async () => {
  const id = await submit(); await update(id);
  const audits = (await db.query<{ old_data: unknown; new_data: Record<string, unknown> }>("select old_data,new_data from public.audit_logs")).rows;
  expect(JSON.stringify(audits)).not.toMatch(/SECRET|@|Contact|description|storage|manager_note/);
  expect(audits[0].new_data).toMatchObject({ kind: "research_proposal", policy: "support-v1", fileCount: 0 });
});
it("rolls back requests, files, decisions and assignments when audit fails", async () => {
  const id = await submit();
  await db.exec("create function public.test_support_fail() returns trigger language plpgsql as $$ begin raise exception 'audit_failed'; end $$; create trigger fail_support_audit before insert on public.audit_logs for each row execute function public.test_support_fail()");
  try {
    await expect(update(id)).rejects.toThrow("audit_failed");
    expect((await list(admin, "research_proposal", id, true)).items[0]).toMatchObject({ version: 1, status: "new", assignedTo: null, managerNote: "" });
    const request = crypto.randomUUID(), file = crypto.randomUUID();
    await expect(submit(input(), own, [{ id: file, path: `${request}/${file}`, name: "file.pdf", size: 50, mimeType: "application/pdf" }], request)).rejects.toThrow("audit_failed");
    expect((await db.query("select * from public.support_requests")).rows).toHaveLength(1);
    expect((await db.query("select * from public.support_request_files")).rows).toHaveLength(0);
  } finally { await db.exec("drop trigger fail_support_audit on public.audit_logs; drop function public.test_support_fail()"); }
});
