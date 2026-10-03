import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const actor = "00000000-0000-4000-a000-000000000001";
const field = "00000000-0000-4000-a000-000000000002";
const scientist = "00000000-0000-4000-a000-000000000003";
const cover = "00000000-0000-4000-a000-000000000004";
const translation = { title: "Regional scientific research", slug: "research-ru", summary: "Research into the region's scientific potential.", description: "Scientific research into regional technologies and the development of new materials.", results: "" };
const input = { stage: "active", organizationId: null, fieldId: field, coverMediaId: cover, startDate: "2026-01-01", endDate: "2026-12-31", externalUrl: null, doi: "10.1234/example", leadScientistId: scientist, memberIds: [], ru: translation, kk: { ...translation, slug: "research-kk" } };
async function save(value = input, id: string | null = null, kind = "research") {
  const result = await db.query<{ id: string }>("select public.save_science_work($1, $2, $3, $4::jsonb) as id", [id, kind, actor, JSON.stringify(value)]);
  return result.rows[0].id;
}
async function state(id: string, status: string | null, remove = false, kind = "research") {
  await db.query("select public.change_science_work_state($1, $2, $3, $4, $5)", [id, kind, actor, status, remove]);
}
async function asRole(role: "anon" | "authenticated", sql: string) {
  await db.exec("set role " + role);
  try { return await db.query(sql); } finally { await db.exec("reset role"); }
}
beforeAll(async () => {
  // Supabase's platform schemas and grants; all application migrations are real.
  await db.exec(String.raw`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    alter default privileges in schema public grant select on tables to anon, authenticated;
    alter default privileges in schema public grant all on tables to service_role;
  `);
  for (const file of ["001_profiles_rbac.sql", "002_media_assets.sql", "003_articles.sql", "004_scientists.sql", "005_science_works.sql", "006_mentorship.sql"]) {
    let sql = await readFile(new URL("./migrations/" + file, import.meta.url), "utf8");
    // gen_random_uuid is built into PostgreSQL; PGlite does not bundle pgcrypto.
    sql = sql.replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
  }
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users(id, email) values ($1, 'manager@example.kz')", [actor]);
  await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = 'project_manager'", [actor]);
  await db.query("insert into public.scientific_fields(id, slug, name_ru, name_kk) values ($1, 'materials', 'Материалы', 'Материалдар')", [field]);
  await db.query("insert into public.scientist_profiles(id, status, verified_at, created_by) values ($1, 'verified', now(), $2)", [scientist, actor]);
  await db.query("insert into public.scientist_profile_translations(scientist_profile_id, locale, full_name, slug, position, short_bio, biography) values ($1, 'ru', 'Учёный', 'scientist', 'Исследователь', 'Биография учёного', 'Подробная биография')", [scientist]);
  await db.query("insert into public.media_assets(id, storage_bucket, storage_path, file_name, mime_type, file_size, uploaded_by, status) values ($1, 'article-media', 'cover.jpg', 'cover.jpg', 'image/jpeg', 100, $2, 'ready')", [cover, actor]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]);
}, 30000);
afterAll(async () => { await db.close(); });

describe("science work PostgreSQL migration", () => {
  let id: string;
  it("saves bilingual content, team, media usage and audit together", async () => {
    id = await save();
    expect((await db.query("select * from public.science_work_translations")).rows).toHaveLength(2);
    expect((await db.query("select * from public.science_work_members")).rows).toHaveLength(1);
    expect((await db.query("select * from public.media_usages where entity_type = 'science_work'")).rows).toHaveLength(1);
    expect((await db.query("select * from public.audit_logs where action = 'research.create'")).rows).toHaveLength(1);
    expect((await asRole("anon", "select * from public.science_works")).rows).toHaveLength(0);
    expect((await asRole("anon", "select * from public.science_work_translations")).rows).toHaveLength(0);
    expect((await asRole("authenticated", "select * from public.science_works")).rows).toHaveLength(1);
  });
  it("denies anonymous and authenticated RPC writes", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await db.exec("set role " + role);
      try { await expect(state(id, "published")).rejects.toThrow(/permission denied/); }
      finally { await db.exec("reset role"); }
    }
  });
  it("rolls back all changes when a translated slug conflicts", async () => {
    const conflicting = { ...input, ru: { ...translation, slug: "other-ru" } };
    await expect(save(conflicting)).rejects.toThrow(/unique constraint/);
    expect((await db.query("select * from public.science_works")).rows).toHaveLength(1);
    expect((await db.query("select * from public.science_work_translations")).rows).toHaveLength(2);
    expect((await db.query("select * from public.audit_logs where action = 'research.create'")).rows).toHaveLength(1);
  });
  it("exposes only published content and verified team members", async () => {
    await state(id, "published");
    expect((await asRole("anon", "select * from public.science_works")).rows).toHaveLength(1);
    expect((await asRole("anon", "select * from public.science_work_translations")).rows).toHaveLength(2);
    expect((await asRole("anon", "select * from public.science_work_members")).rows).toHaveLength(1);
    await db.query("update public.scientist_profiles set status = 'draft' where id = $1", [scientist]);
    expect((await asRole("anon", "select * from public.science_work_members")).rows).toHaveLength(0);
    expect((await asRole("authenticated", "select * from public.science_work_members")).rows).toHaveLength(1);
    await db.query("update public.scientist_profiles set status = 'verified' where id = $1", [scientist]);
  });
  it("does not mutate a research work through the project RPC", async () => {
    await expect(state(id, "draft", false, "project")).rejects.toThrow("not_found");
    await expect(save(input, id, "project")).rejects.toThrow("not_found");
  });
  it("keeps a published work unchanged after a failed edit", async () => {
    await expect(save({ ...input, endDate: "2025-01-01" }, id)).rejects.toThrow(/check constraint/);
    expect((await db.query("select status from public.science_works where id = $1", [id])).rows[0]).toEqual({ status: "published" });
  });
  it("rolls back a published edit if the second language slug conflicts", async () => {
    const other = await save({ ...input, ru: { ...translation, slug: "other-work-ru" }, kk: { ...translation, slug: "other-work-kk" } }, null, "project");
    await expect(save({ ...input, ru: { ...translation, title: "Should not survive" }, kk: { ...input.kk, slug: "other-work-kk" } }, id)).rejects.toThrow(/unique constraint/);
    expect((await db.query("select status from public.science_works where id = $1", [id])).rows[0]).toEqual({ status: "published" });
    expect((await db.query("select title from public.science_work_translations where work_id = $1 and locale = 'ru'", [id])).rows[0]).toEqual({ title: translation.title });
    expect((await db.query("select * from public.audit_logs where entity_id = $1 and action = 'research.update'", [id])).rows).toHaveLength(0);
    await db.query("delete from public.science_works where id = $1", [other]);
  });
  it("atomically returns edited content to draft", async () => {
    await save({ ...input, ru: { ...translation, title: "Updated regional research" } }, id);
    expect((await asRole("anon", "select * from public.science_works")).rows).toHaveLength(0);
    expect((await db.query("select status from public.science_works where id = $1", [id])).rows[0]).toEqual({ status: "draft" });
  });
  it("limits manager draft access to their kind-specific permission", async () => {
    const limitedActor = "00000000-0000-4000-a000-000000000005";
    const project = await save({ ...input, ru: { ...translation, slug: "limited-project-ru" }, kk: { ...translation, slug: "limited-project-kk" } }, null, "project");
    await db.query("insert into auth.users(id) values ($1)", [limitedActor]);
    await db.exec("insert into public.roles(code, name) values ('research_only', 'Research only')");
    await db.exec("insert into public.role_permissions(role_id, permission_id) select r.id, p.id from public.roles r cross join public.permissions p where r.code = 'research_only' and p.code = 'research.manage'");
    await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = 'research_only'", [limitedActor]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [limitedActor]);
    try {
      const rows = (await asRole("authenticated", "select kind from public.science_works")).rows;
      expect(rows).toEqual([{ kind: "research" }]);
      await expect(asRole("authenticated", "insert into public.science_works(kind, field_id, created_by) values ('research', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000005')")).rejects.toThrow(/row-level security|permission denied/);
    } finally {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]);
      await db.query("delete from public.science_works where id = $1", [project]);
    }
  });
  it("requires restoring an archive before publication", async () => {
    await state(id, "archived");
    await expect(state(id, "published")).rejects.toThrow("invalid_transition");
    await state(id, "draft");
    await state(id, "published");
  });
  it("removes soft-deleted works, related public content and media usage", async () => {
    await state(id, null, true);
    expect((await asRole("anon", "select * from public.science_works")).rows).toHaveLength(0);
    expect((await asRole("anon", "select * from public.science_work_translations")).rows).toHaveLength(0);
    expect((await asRole("authenticated", "select * from public.science_works")).rows).toHaveLength(0);
    expect((await db.query("select * from public.media_usages where entity_type = 'science_work'")).rows).toHaveLength(0);
  });
});
