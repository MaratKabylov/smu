import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
let db: PGlite;
const owner = "00000000-0000-4000-a000-000000000041";
const other = "00000000-0000-4000-a000-000000000042";
const manager = "00000000-0000-4000-a000-000000000043";
const user = "00000000-0000-4000-a000-000000000044";
let research: string, project: string, upload: string;
async function asRole<T>(actor: string | null, action: () => Promise<T>, role = actor ? "authenticated" : "anon") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return await action(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
const translation = { title: "Structured regional results", description: "A durable description of the regional research results." };
const input = (patch: Record<string, unknown> = {}) => ({ kind: "dataset", status: "published", versionLabel: "1.0", license: "CC BY 4.0",
  externalUrl: "https://example.kz/data", changeNote: "Initial release", workIds: [research, project], files: [{ id: upload, isPublic: false }], ru: translation, kk: translation, ...patch });
async function save(patch: Record<string, unknown> = {}, id: string | null = null, actor = owner) {
  return asRole(actor, async () => (await db.query<{ id: string }>("select public.save_research_output($1,$2) id", [id, JSON.stringify(input(patch))])).rows[0].id);
}
async function publicList(actor: string | null = null, work = research, locale = "ru") {
  return (await asRole(actor, () => db.query<{ value: { id: string; files: { id: string; name: string }[]; title: string; version: number }[] }>(
    "select public.list_public_research_outputs($1,$2) value", [locale, work]))).rows[0].value;
}
async function resolve(id: string, actor: string | null = null, version = 1, file = upload) {
  return (await asRole(actor, () => db.query<{ value: { path: string; name: string } | null }>("select public.resolve_research_output_file($1,$2,$3) value", [id, version, file]))).rows[0].value;
}
beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [id, role] of [[owner, "author"], [other, "author"], [manager, "scientist_manager"], [user, "user"]]) {
    await db.query("insert into auth.users values($1,$2,'{}')", [id, id + "@example.kz"]);
    await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2", [id, role]);
  }
}, 30000);
beforeEach(async () => {
  await db.exec("truncate public.research_outputs,public.research_output_uploads,public.science_works,public.scientific_fields,public.audit_logs cascade");
  const field = (await db.query<{ id: string }>("insert into public.scientific_fields(slug,name_ru,name_kk) values('science','Наука','Ғылым') returning id")).rows[0].id;
  const works: string[] = [];
  for (const kind of ["research", "project"]) {
    const id = (await db.query<{ id: string }>("insert into public.science_works(kind,status,published_at,field_id,created_by) values($1,'published',now(),$2,$3) returning id", [kind, field, owner])).rows[0].id;
    works.push(id);
    for (const locale of ["ru", "kk"]) await db.query("insert into public.science_work_translations(work_id,locale,title,slug,summary,description,results) values($1,$2,$3,$3,'Regional scientific work summary.','Detailed description of regional science and experimental results.','Legacy free-text result')", [id, locale, kind + "-work"]);
  }
  [research, project] = works;
  upload = (await db.query<{ id: string }>("insert into public.research_output_uploads(uploaded_by,storage_path,file_name,mime_type,file_size,ready) values($1,'owner/data.csv','data.csv','text/csv',42,true) returning id", [owner])).rows[0].id;
});
afterAll(async () => { await db?.close(); });
describe("structured research outputs", () => {
  it("creates independent results with RU/KK, owner, work links and audit without touching legacy results", async () => {
    const id = await save();
    expect((await publicList())[0]).toMatchObject({ id, title: translation.title, version: 1, files: [] });
    expect((await publicList(null, project))[0].id).toBe(id);
    expect((await db.query("select owner_id,version from public.research_outputs")).rows).toEqual([{ owner_id: owner, version: 1 }]);
    expect((await db.query<{ results: string }>("select results from public.science_work_translations")).rows.every(r => r.results === "Legacy free-text result")).toBe(true);
    expect((await db.query<{ new_data: unknown }>("select new_data from public.audit_logs where entity_id=$1", [id])).rows[0].new_data).toEqual({ version: 1, status: "published" });
  });
  it("denies ordinary users, forged owners, other authors and service-role RPCs", async () => {
    await expect(save({}, null, user)).rejects.toThrow("forbidden");
    const id = await save({ ownerId: other });
    await expect(save({ expectedVersion: 1 }, id, other)).rejects.toThrow("forbidden");
    expect((await db.query<{ owner_id: string }>("select owner_id from public.research_outputs")).rows[0].owner_id).toBe(owner);
    await expect(asRole(null, () => db.query("select public.save_research_output(null,$1)", [JSON.stringify(input())]), "service_role")).rejects.toThrow("permission denied");
    await expect(asRole(owner, () => db.query("update public.research_outputs set status='draft'"))).rejects.toThrow("permission denied");
    await expect(asRole(owner, () => db.query("update public.research_output_versions set snapshot='{}'"))).rejects.toThrow("permission denied");
    await expect(asRole(owner, () => db.query("update public.research_output_uploads set ready=true"))).rejects.toThrow("permission denied");
  });
  it("allows owners and managers to read history, hides it from others and anon", async () => {
    await save();
    for (const actor of [owner, manager]) expect((await asRole(actor, () => db.query("select * from public.research_output_versions"))).rows).toHaveLength(1);
    expect((await asRole(other, () => db.query("select * from public.research_output_versions"))).rows).toEqual([]);
    await expect(asRole(null, () => db.query("select * from public.research_outputs"))).rejects.toThrow("permission denied");
  });
  it("requires exact version, preserves immutable snapshots and original publication date", async () => {
    const id = await save();
    const date = (await db.query("select published_at from public.research_outputs")).rows;
    await save({ expectedVersion: 1, versionLabel: "2.0", ru: { ...translation, title: "A second output version" } }, id);
    expect((await publicList())[0]).toMatchObject({ version: 2, title: "A second output version" });
    expect((await db.query("select snapshot->>'versionLabel' label from public.research_output_versions order by version")).rows).toEqual([{ label: "1.0" }, { label: "2.0" }]);
    expect((await db.query("select published_at from public.research_outputs")).rows).toEqual(date);
    await expect(save({ expectedVersion: 1 }, id)).rejects.toThrow("stale_version");
    await expect(save({}, id)).rejects.toThrow("stale_version");
  });
  it("lets managers preserve owner attachments and prevents attaching someone else's unrelated upload", async () => {
    const id = await save();
    expect((await asRole(manager, () => db.query("select file_name from public.research_output_uploads"))).rows).toEqual([{ file_name: "data.csv" }]);
    await save({ expectedVersion: 1 }, id, manager);
    expect(await resolve(id, manager, 2)).toMatchObject({ path: "owner/data.csv" });
    await expect(save({}, null, other)).rejects.toThrow("invalid_reference");
    await expect(save({}, null, manager)).rejects.toThrow("invalid_reference");
  });
  it("limits owners to their works or the works of their linked scientific profile", async () => {
    await db.query("update public.science_works set created_by=$1", [other]);
    await expect(save()).rejects.toThrow("invalid_reference");
    await save({ files: [] }, null, manager);
    const scientist = (await db.query<{ id: string }>("insert into public.scientist_profiles(created_by,user_id) values($1,$1) returning id", [owner])).rows[0].id;
    for (const work of [research, project]) await db.query("insert into public.science_work_members values($1,$2,'member')", [work, scientist]);
    await save();
  });
  it("hides private files in public metadata even for managers and checks fresh download access", async () => {
    const id = await save();
    for (const actor of [null, manager]) {
      const value = await publicList(actor);
      expect(value[0].files).toEqual([]);
      expect(JSON.stringify(value)).not.toContain(owner);
      expect(JSON.stringify(value)).not.toContain("owner/data.csv");
    }
    expect(await resolve(id)).toBeNull();
    expect(await resolve(id, other)).toBeNull();
    expect(await resolve(id, owner)).toMatchObject({ name: "data.csv" });
    await save({ expectedVersion: 1, files: [{ id: upload, isPublic: true }] }, id);
    expect((await publicList())[0].files).toEqual([expect.objectContaining({ id: upload, name: "data.csv" })]);
    expect(await resolve(id, null, 2)).toMatchObject({ path: "owner/data.csv" });
    expect(await resolve(id, null, 1)).toBeNull();
    await db.query("update public.research_outputs set status='archived' where id=$1", [id]);
    expect(await resolve(id, null, 2)).toBeNull();
    expect(await publicList()).toEqual([]);
  });
  it("withdraws metadata and public files when parent is draft, future or deleted, including manager sessions", async () => {
    const id = await save({ workIds: [research], files: [{ id: upload, isPublic: true }] });
    for (const mutation of ["status='draft'", "status='published',published_at=now()+interval '1 day'", "published_at=now(),deleted_at=now()"]) {
      await db.query(`update public.science_works set ${mutation} where id=$1`, [research]);
      for (const actor of [null, manager]) expect(await publicList(actor)).toEqual([]);
      expect(await resolve(id)).toBeNull();
    }
  });
  it("supports optional English only when both output and work translation exist", async () => {
    const id = await save({ en: translation });
    expect(await publicList(null, research, "en")).toEqual([]);
    await db.query("insert into public.science_work_translations(work_id,locale,title,slug,summary,description) select work_id,'en',title,slug,summary,description from public.science_work_translations where work_id=$1 and locale='ru'", [research]);
    expect((await publicList(null, research, "en"))[0].id).toBe(id);
    expect(await publicList(null, research, "xx")).toEqual([]);
    await save({ expectedVersion: 1 }, id);
    expect(await publicList(null, research, "en")).toEqual([]);
  });
  it("validates SQL fields, counts, references, ready uploads and publishing prerequisites", async () => {
    for (const patch of [{ kind: "unknown" }, { status: "unknown" }, { versionLabel: "" }, { license: "" }, { ru: null }, { kk: { title: "Bad", description: "short" } },
      { workIds: [] }, { workIds: [research, research] }, { workIds: Array(21).fill(research) }, { files: [{ id: upload }] },
      { files: [{ id: upload, isPublic: false }, { id: upload, isPublic: true }] }, { externalUrl: "javascript:alert(1)" }]) await expect(save(patch)).rejects.toThrow("invalid_input");
    await db.query("update public.research_output_uploads set ready=false");
    await expect(save()).rejects.toThrow("invalid_reference");
    await db.query("update public.research_output_uploads set ready=true");
    await db.query("update public.science_works set status='draft'");
    await expect(save()).rejects.toThrow("invalid_reference");
    await save({ status: "draft" });
    expect(await publicList()).toEqual([]);
  });
  it("rolls back results, revision, files, links and audit on final audit failure", async () => {
    const id = await save();
    const before = await publicList();
    await db.exec("create function public.fail_output_audit() returns trigger language plpgsql as $$ begin if new.entity_type='research_output' then raise exception 'audit_failed'; end if; return new; end $$; create trigger fail_output_audit before insert on public.audit_logs for each row execute function public.fail_output_audit()");
    try {
      await expect(save({ expectedVersion: 1, workIds: [project], files: [] }, id)).rejects.toThrow("audit_failed");
      await expect(save()).rejects.toThrow("audit_failed");
      expect(await publicList()).toEqual(before);
      for (const table of ["research_outputs", "research_output_versions", "research_output_files"]) expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(1);
      expect((await db.query("select * from public.research_output_works")).rows).toHaveLength(2);
      expect((await db.query("select * from public.audit_logs where entity_type='research_output'")).rows).toHaveLength(1);
    } finally { await db.exec("drop trigger fail_output_audit on public.audit_logs; drop function public.fail_output_audit()"); }
  });
  it("returns only permitted work options, supports selected IDs and refuses ordinary users", async () => {
    const options = async (actor: string, q = "", ids: string[] | null = null) => (await asRole(actor, () => db.query<{ value: unknown[] }>("select public.research_output_work_options($1,$2) value", [q, ids]))).rows[0].value;
    expect(await options(owner)).toHaveLength(2);
    expect(await options(other)).toEqual([]);
    expect(await options(manager, "project", [project])).toEqual([expect.objectContaining({ id: project })]);
    await expect(options(user)).rejects.toThrow("forbidden");
  });
  it("keeps the new Storage bucket private and outside broad media.view policies", async () => {
    expect((await db.query("select public,file_size_limit from storage.buckets where id='result-files'")).rows).toEqual([{ public: false, file_size_limit: 4194304 }]);
    await db.query("insert into storage.objects(id,bucket_id) values($1,'result-files')", [upload]);
    await db.exec("grant select on storage.objects to anon,authenticated");
    for (const actor of [null, manager, owner]) expect((await asRole(actor, () => db.query("select * from storage.objects where bucket_id='result-files'"))).rows).toEqual([]);
  });
});
