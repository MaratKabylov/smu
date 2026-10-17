import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import { supportRecoveryArtifacts } from "../scripts/generate-support-recovery.mjs";
let db: PGlite;
let verify: string, reapply: string;
beforeAll(async () => {
  db = await createMigrationDatabase({ through: 34 });
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  verify = await readFile(new URL("./maintenance/verify_035_support_requests.sql", import.meta.url), "utf8");
  reapply = await readFile(new URL("./maintenance/reapply_035_support_requests.sql", import.meta.url), "utf8");
}, 30000);
afterAll(async () => { await db?.close(); });
const failedChecks = async () => (await db.query<{ check_name: string; ok: boolean }>(verify)).rows.filter(row => !row.ok).map(row => row.check_name);
it("keeps the published verification and recovery SQL in sync with the original migration", async () => {
  const expected = await supportRecoveryArtifacts(); expect(verify).toBe(expected.verify); expect(reapply).toBe(expected.reapply);
});
it("identifies missing seed roles before recovery and resolves the reported six missing assignments with seed", async () => {
  const unseeded = await createMigrationDatabase({ through: 35 });
  try {
    const missing = (await unseeded.query<{ check_name: string; ok: boolean }>(verify)).rows.filter(r => !r.ok).map(r => r.check_name);
    expect(missing).toContain("role:admin"); expect(missing).toContain("role:super_admin");
    expect(missing.filter(name => name.startsWith("role_permission:"))).toHaveLength(6);
    expect(missing.every(name => name.startsWith("role:") || name.startsWith("role_permission:"))).toBe(true);
    await expect(unseeded.exec(reapply)).rejects.toThrow("035 missing prerequisite roles: admin, super_admin. Apply supabase/seed.sql");
    await unseeded.exec("rollback");
    await unseeded.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
    expect((await unseeded.query<{ ok: boolean }>(verify)).rows.every(r => r.ok)).toBe(true);
    await unseeded.exec(reapply);
    expect((await unseeded.query<{ ok: boolean }>(verify)).rows.every(r => r.ok)).toBe(true);
    expect((await unseeded.query("select * from public.user_roles")).rows).toEqual([]);
  } finally { await unseeded.close(); }
}, 30000);
it("detects an absent 035 and installs it transactionally without altering history", async () => {
  expect(await failedChecks()).toContain("columns:support_requests");
  await db.exec(reapply); expect(await failedChecks()).toEqual([]);
  expect((await db.query("select to_regclass('supabase_migrations.schema_migrations') as history")).rows[0]).toEqual({ history: null });
});
it("recovers a run interrupted immediately after creating support_requests", async () => {
  const partial = await createMigrationDatabase({ through: 34 });
  try {
    await partial.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
    const original = await readFile(new URL("./migrations/035_support_requests.sql", import.meta.url), "utf8");
    await partial.exec(original.slice(0, original.indexOf("create index support_requests_queue_idx")));
    const before = (await partial.query<{ check_name: string; ok: boolean }>(verify)).rows;
    expect(before.find(r => r.check_name === "columns:support_requests")?.ok).toBe(true);
    expect(before.find(r => r.check_name === "columns:support_request_files")?.ok).toBe(false);
    await partial.exec(reapply);
    expect((await partial.query<{ ok: boolean }>(verify)).rows.every(r => r.ok)).toBe(true);
  } finally { await partial.close(); }
});
it("can repeat an already-complete migration while preserving requests and attachments", async () => {
  await db.exec(`insert into public.support_requests(id,kind,locale,title,description,contact_name,email,details)
    values('00000000-0000-4000-a000-000000000001','it_request','ru','Keep request','Keep description','Contact','own@example.org','{}');
    insert into public.support_request_files(id,request_id,storage_path,name,size,mime_type)
    values('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000001','saved/path','file.pdf',128,'application/pdf')`);
  const requests = (await db.query("select * from public.support_requests")).rows;
  const files = (await db.query("select * from public.support_request_files")).rows;
  await db.exec(reapply); await db.exec(reapply);
  expect((await db.query("select * from public.support_requests")).rows).toEqual(requests);
  expect((await db.query("select * from public.support_request_files")).rows).toEqual(files);
  expect(await failedChecks()).toEqual([]);
});
it("detects and restores a partial run including missing RPCs/indexes/grants and unsafe bucket settings", async () => {
  await db.exec(`drop function public.update_support_request(uuid,integer,text,text,uuid,text);
    drop index public.support_requests_rate_idx;
    alter table public.support_requests disable row level security;
    grant select on public.support_requests to anon;
    update storage.buckets set public=true where id='support-request-files';
    delete from public.role_permissions where permission_id=(select id from public.permissions where code='it_requests.manage')`);
  const failed = await failedChecks(); expect(failed).toContain("storage_bucket"); expect(failed).toContain("table_privileges:support_requests");
  expect(failed.some(name => name.startsWith("function:public.update_support_request"))).toBe(true);
  await db.exec(reapply); expect(await failedChecks()).toEqual([]);
  expect((await db.query("select title from public.support_requests")).rows).toEqual([{ title: "Keep request" }]);
});
it("detects a mismatched RPC body even when the function name and grants exist", async () => {
  await db.exec("create or replace function public.smu_support_permission(p_kind text) returns text language sql immutable set search_path='' as $$ select 'wrong'::text $$");
  expect(await failedChecks()).toContain("function:public.smu_support_permission(text)");
  await db.exec(reapply); expect(await failedChecks()).toEqual([]);
});
it("refuses incompatible columns and rolls back without destroying data", async () => {
  await db.exec("alter table public.support_requests alter column title drop not null");
  await expect(db.exec(reapply)).rejects.toThrow("035 incompatible existing schema");
  await db.exec("rollback");
  expect((await db.query("select title from public.support_requests")).rows).toEqual([{ title: "Keep request" }]);
  expect(await failedChecks()).toContain("columns:support_requests");
  await db.exec("alter table public.support_requests alter column title set not null");
});
it("rolls back the full recovery when an existing index is incompatible", async () => {
  await db.exec("drop index public.support_requests_rate_idx; create index support_requests_rate_idx on public.support_requests(title); update storage.buckets set public=true where id='support-request-files'");
  await expect(db.exec(reapply)).rejects.toThrow("035 verification failed"); await db.exec("rollback");
  expect((await db.query("select public from storage.buckets where id='support-request-files'")).rows[0]).toEqual({ public: true });
  await db.exec("drop index public.support_requests_rate_idx"); await db.exec(reapply); expect(await failedChecks()).toEqual([]);
});
