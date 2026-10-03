import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const db = new PGlite();
const actor = "00000000-0000-4000-a000-000000000001";
const outsider = "00000000-0000-4000-a000-000000000002";
const cover = "00000000-0000-4000-a000-000000000003";
let upgradedRoles: string[] = [];
const translation = { title: "Regional science conference", slug: "conference-ru", summary: "A conference for the region's scientific community.", description: "Presentations and discussion of research, followed by practical workshops for scientists.", organizer: "Science council", location: "Aktobe, University hall" };
const input = { kind: "conference", format: "offline", startsAt: "2026-12-10T05:00:00Z", endsAt: "2026-12-10T13:00:00Z", registrationDeadline: "2026-12-09T05:00:00Z", registrationUrl: "https://example.kz/register", externalUrl: null, coverMediaId: cover, ru: translation, kk: { ...translation, slug: "conference-kk" } };
async function save(value: unknown = input, id: string | null = null) {
  const result = await db.query<{ id: string }>("select public.save_event($1, $2, $3::jsonb) as id", [id, actor, JSON.stringify(value)]);
  return result.rows[0].id;
}
async function state(id: string, status: string | null, remove = false) {
  await db.query("select public.change_event_state($1, $2, $3, $4)", [id, actor, status, remove]);
}
async function asRole<T>(role: "anon" | "authenticated" | "service_role", action: () => Promise<T>) {
  await db.exec("set role " + role);
  try { return await action(); } finally { await db.exec("reset role"); }
}
const visible = (role: "anon" | "authenticated", table: "events" | "event_translations") => asRole(role, () => db.query("select * from public." + table));
beforeAll(async () => {
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
  // Seed the existing roles before 008 to verify an upgrade grants events.manage too.
  const migrations = (await readdir(new URL("./migrations/", import.meta.url))).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  for (const file of migrations) {
    if (file === "008_events.sql") {
      const previousSeed = (await readFile(new URL("./seed.sql", import.meta.url), "utf8"))
        .replace(/^.*'events\.manage'.*\r?\n/gm, "");
      await db.exec(previousSeed);
    }
    const sql = (await readFile(new URL("./migrations/" + file, import.meta.url), "utf8")).replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
    if (file === "008_events.sql") {
      upgradedRoles = (await db.query<{ code: string }>("select r.code from public.roles r join public.role_permissions rp on rp.role_id = r.id join public.permissions p on p.id = rp.permission_id where p.code = 'events.manage' order by r.code")).rows.map(row => row.code);
    }
  }
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users(id, email) values ($1, 'admin@example.kz'), ($2, 'author@example.kz')", [actor, outsider]);
  await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = 'admin'", [actor]);
  await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = 'author'", [outsider]);
  await db.query("insert into public.media_assets(id, storage_bucket, storage_path, file_name, mime_type, file_size, uploaded_by, status) values ($1, 'event-media', 'cover.jpg', 'cover.jpg', 'image/jpeg', 100, $2, 'ready')", [cover, actor]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]);
}, 30000);
afterAll(async () => { await db.close(); });

describe("event PostgreSQL migration", () => {
  let id: string;
  beforeEach(async () => {
    await db.exec("delete from public.events; delete from public.audit_logs where entity_type = 'event';");
    id = await asRole("service_role", () => save());
  });
  it("grants the new permission to existing administrators without reseeding", () => {
    expect(upgradedRoles).toEqual(["admin", "super_admin"]);
  });
  it("saves both translations, cover usage and audit through the service role", async () => {
    expect((await db.query("select * from public.event_translations")).rows).toHaveLength(2);
    expect((await db.query("select * from public.media_usages where entity_type = 'event'")).rows).toHaveLength(1);
    expect((await db.query("select * from public.audit_logs where action = 'event.create'")).rows).toHaveLength(1);
    expect((await visible("anon", "events")).rows).toHaveLength(0);
    expect((await visible("anon", "event_translations")).rows).toHaveLength(0);
    expect((await visible("authenticated", "events")).rows).toHaveLength(1);
  });
  it("denies RPC and direct writes for anonymous and authenticated clients", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(asRole(role, () => state(id, "published"))).rejects.toThrow(/permission denied/);
      await expect(asRole(role, () => save())).rejects.toThrow(/permission denied/);
      await expect(asRole(role, () => db.query("update public.events set status = 'published' where id = $1", [id]))).rejects.toThrow(/permission denied/);
      await expect(asRole(role, () => db.query("delete from public.event_translations where event_id = $1", [id]))).rejects.toThrow(/permission denied/);
    }
  });
  it("hides drafts from unrelated authenticated roles", async () => {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [outsider]);
    try {
      expect((await visible("authenticated", "events")).rows).toHaveLength(0);
      expect((await visible("authenticated", "event_translations")).rows).toHaveLength(0);
    } finally { await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]); }
  });
  it("rejects invalid dates, unsafe URLs and missing translations without partial records", async () => {
    for (const value of [
      { ...input, endsAt: input.startsAt },
      { ...input, endsAt: "2026-12-09T00:00:00Z" },
      { ...input, registrationDeadline: "2026-12-11T00:00:00Z" },
      { ...input, registrationUrl: null },
      { ...input, externalUrl: "javascript:alert(1)" },
      { ...input, kk: undefined },
      { ...input, format: "online", externalUrl: null },
    ]) await expect(save(value, id)).rejects.toThrow(/check constraint|not-null constraint|invalid_location/);
    await expect(save({ ...input, kk: { ...input.kk, location: "" } }, id)).rejects.toThrow("invalid_location");
    expect((await db.query("select * from public.events")).rows).toHaveLength(1);
    expect((await db.query("select * from public.audit_logs where action = 'event.create'")).rows).toHaveLength(1);
  });
  it("rejects private or non-image covers and rechecks references at publication", async () => {
    await db.query("update public.media_assets set storage_bucket = 'private-documents' where id = $1", [cover]);
    await expect(state(id, "published")).rejects.toThrow("invalid_reference");
    await expect(save(input, id)).rejects.toThrow("invalid_reference");
    await db.query("update public.media_assets set storage_bucket = 'event-media', mime_type = 'video/mp4' where id = $1", [cover]);
    await expect(save(input, id)).rejects.toThrow("invalid_reference");
    await db.query("update public.media_assets set mime_type = 'image/jpeg' where id = $1", [cover]);
    await db.query("delete from public.event_translations where event_id = $1 and locale = 'kk'", [id]);
    await expect(state(id, "published")).rejects.toThrow("invalid_reference");
    await save(input, id);
  });
  it("publishes and cancels while retaining a public cancellation page", async () => {
    await expect(state(id, "cancelled")).rejects.toThrow("invalid_transition");
    await asRole("service_role", () => state(id, "published"));
    expect((await visible("anon", "events")).rows).toHaveLength(1);
    expect((await visible("anon", "event_translations")).rows).toHaveLength(2);
    await state(id, "cancelled");
    expect((await visible("anon", "events")).rows[0]).toMatchObject({ status: "cancelled" });
    await state(id, "published");
  });
  it("rolls back a conflicting bilingual edit including draft reset, cover and audit", async () => {
    await state(id, "published");
    const other = await save({ ...input, coverMediaId: null, ru: { ...translation, slug: "other-ru" }, kk: { ...translation, slug: "other-kk" } });
    await expect(save({ ...input, coverMediaId: null, ru: { ...translation, title: "Must not survive" }, kk: { ...input.kk, slug: "other-kk" } }, id)).rejects.toThrow(/unique constraint/);
    expect((await db.query("select status, cover_media_id from public.events where id = $1", [id])).rows[0]).toEqual({ status: "published", cover_media_id: cover });
    expect((await db.query("select title from public.event_translations where event_id = $1 and locale = 'ru'", [id])).rows[0]).toEqual({ title: translation.title });
    expect((await db.query("select * from public.audit_logs where entity_id = $1 and action = 'event.update'", [id])).rows).toHaveLength(0);
    expect((await db.query("select * from public.media_usages where entity_type = 'event' and entity_id = $1", [id])).rows).toHaveLength(1);
    await db.query("delete from public.events where id = $1", [other]);
  });
  it("returns successful edits to draft and updates cover usage", async () => {
    await state(id, "published");
    await save({ ...input, coverMediaId: null }, id);
    expect((await visible("anon", "events")).rows).toHaveLength(0);
    expect((await visible("anon", "event_translations")).rows).toHaveLength(0);
    expect((await db.query("select * from public.media_usages where entity_type = 'event'")).rows).toHaveLength(0);
    await save(input, id);
    expect((await db.query("select * from public.media_usages where entity_type = 'event'")).rows).toHaveLength(1);
  });
  it("requires restoring archives before publication and hides soft-deleted content", async () => {
    await state(id, "archived");
    await expect(state(id, "published")).rejects.toThrow("invalid_transition");
    await state(id, "draft");
    await state(id, "published");
    await state(id, null, true);
    expect((await visible("anon", "events")).rows).toHaveLength(0);
    expect((await visible("anon", "event_translations")).rows).toHaveLength(0);
    expect((await visible("authenticated", "events")).rows).toHaveLength(0);
    expect((await db.query("select * from public.media_usages where entity_type = 'event'")).rows).toHaveLength(0);
    await expect(save(input, id)).rejects.toThrow("not_found");
    await expect(state(id, "draft")).rejects.toThrow("not_found");
  });
});
