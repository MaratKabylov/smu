import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
let db: PGlite, id: string;
const owner = "00000000-0000-4000-a000-000000000081", other = "00000000-0000-4000-a000-000000000082", user = "00000000-0000-4000-a000-000000000083";
async function asRole<T>(role: string, actor: string | null, action: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]); await db.exec("set role " + role);
  try { return await action(); } finally { await db.exec("reset role"); }
}
async function finish(actor = owner, mime = "application/pdf", size = 42, width: number | null = null, height: number | null = null) {
  return asRole("service_role", null, () => db.query("select public.finalize_media_upload($1,$2,$3,$4,$5,$6)", [id, actor, mime, size, width, height]));
}
beforeAll(async () => {
  db = await createMigrationDatabase(); await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [actor, role] of [[owner, "author"], [other, "author"], [user, "user"]]) {
    await db.query("insert into auth.users values($1,$2,'{}')", [actor, actor + "@example.kz"]);
    await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2 on conflict do nothing", [actor, role]);
  }
  await db.exec("grant select on storage.objects to anon,authenticated");
}, 30000);
beforeEach(async () => {
  await db.exec("truncate public.media_assets,public.audit_logs,storage.objects cascade");
  id = (await db.query<{ id: string }>("insert into public.media_assets(storage_bucket,storage_path,file_name,mime_type,file_size,uploaded_by) values('documents','2026/doc.pdf','doc.pdf','application/pdf',42,$1) returning id", [owner])).rows[0].id;
});
afterAll(async () => { await db?.close(); });
it("commits readiness and upload audit atomically with confirmed metadata", async () => {
  await finish();
  expect((await db.query("select status,width,height from public.media_assets")).rows).toEqual([{ status: "ready", width: null, height: null }]);
  expect((await db.query("select action,user_id,new_data from public.audit_logs")).rows).toEqual([expect.objectContaining({ action: "media.upload", user_id: owner, new_data: expect.objectContaining({ fileSize: 42 }) })]);
  await expect(finish()).rejects.toThrow("not_found");
  expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(1);
});
it("denies anon/authenticated RPC and direct client writes", async () => {
  for (const [role, actor] of [["anon", null], ["authenticated", owner]]) {
    await expect(asRole(role!, actor, () => db.query("select public.finalize_media_upload($1,$2,'application/pdf',42,null,null)", [id, owner]))).rejects.toThrow("permission denied");
  }
  await expect(asRole("authenticated", owner, () => db.query("update public.media_assets set status='ready'"))).rejects.toThrow("permission denied");
});
it("rechecks actor permissions, ownership, deleted state and expected MIME/size", async () => {
  await expect(finish(other)).rejects.toThrow("forbidden"); await expect(finish(user)).rejects.toThrow("forbidden");
  await expect(finish(owner, "application/pdf", 41)).rejects.toThrow("invalid_input");
  await expect(finish(owner, "text/csv", 42)).rejects.toThrow("invalid_input");
  await expect(finish(owner, "application/pdf", 42, 1, 1)).rejects.toThrow("invalid_input");
  await db.query("update public.media_assets set deleted_at=now() where id=$1", [id]); await expect(finish()).rejects.toThrow("not_found");
});
it("enforces bucket limits and server-derived image dimensions", async () => {
  await db.query("update public.media_assets set storage_bucket='avatars',mime_type='image/png',file_size=5242881 where id=$1", [id]);
  await expect(finish(owner, "image/png", 5242881, 1, 1)).rejects.toThrow("invalid_input");
  await db.query("update public.media_assets set file_size=42 where id=$1", [id]);
  for (const [w, h] of [[null, null], [1, null], [0, 1], [10000, 10000]]) await expect(finish(owner, "image/png", 42, w, h)).rejects.toThrow("invalid_input");
  await finish(owner, "image/png", 42, 3, 2);
});
it("rolls readiness back on final audit failure", async () => {
  await db.exec("create function public.fail_media_audit() returns trigger language plpgsql as $$ begin raise exception 'audit_failed'; end $$; create trigger fail_media_audit before insert on public.audit_logs for each row execute function public.fail_media_audit()");
  try { await expect(finish()).rejects.toThrow("audit_failed"); expect((await db.query("select status from public.media_assets")).rows).toEqual([{ status: "uploading" }]); }
  finally { await db.exec("drop trigger fail_media_audit on public.audit_logs; drop function public.fail_media_audit()"); }
});
it("keeps private metadata and translations hidden from anon and staging objects hidden from viewers", async () => {
  await finish(); await db.query("insert into public.media_asset_translations values($1,'ru','Private alt','Private caption')", [id]);
  expect((await asRole("anon", null, () => db.query("select * from public.media_assets"))).rows).toEqual([]);
  expect((await asRole("anon", null, () => db.query("select * from public.media_asset_translations"))).rows).toEqual([]);
  expect((await asRole("authenticated", owner, () => db.query("select * from public.media_assets"))).rows).toHaveLength(1);
  for (const bucket of ["media-staging", "documents", "result-files"]) await db.query("insert into storage.objects values(gen_random_uuid(),$1)", [bucket]);
  for (const [role, actor] of [["anon", null], ["authenticated", owner]]) expect((await asRole(role!, actor, () => db.query("select * from storage.objects"))).rows).toEqual([]);
  expect((await db.query("select public,file_size_limit from storage.buckets where id='media-staging'")).rows).toEqual([{ public: false, file_size_limit: 52428800 }]);
});
it("upgrades previous ready files and pending uploads without rewriting metadata or usages", async () => {
  await finish();
  await db.query("insert into public.media_usages(media_asset_id,entity_type,entity_id,field_name) values($1,'document',gen_random_uuid(),'attachment')", [id]);
  const before = (await db.query("select * from public.media_assets order by id")).rows;
  const usages = (await db.query("select * from public.media_usages")).rows;
  await db.exec("drop function public.finalize_media_upload(uuid,uuid,text,bigint,integer,integer); delete from storage.buckets where id='media-staging'; update storage.buckets set allowed_mime_types=null where id='it-request-files'; create policy media_objects_read_authorized on storage.objects for select to authenticated using(public.has_permission('media.view'))");
  await db.exec(await readFile(new URL("./migrations/030_media_bucket_uploads.sql", import.meta.url), "utf8"));
  expect((await db.query("select * from public.media_assets order by id")).rows).toEqual(before);
  expect((await db.query("select * from public.media_usages")).rows).toEqual(usages);
  expect((await db.query("select * from pg_policies where schemaname='storage' and policyname='media_objects_read_authorized'")).rows).toEqual([]);
});
