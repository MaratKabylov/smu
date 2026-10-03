import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const db = new PGlite();
const actor = "00000000-0000-4000-a000-000000000011";
const field = "00000000-0000-4000-a000-000000000012";
const scientist = "00000000-0000-4000-a000-000000000013";
const outsider = "00000000-0000-4000-a000-000000000014";
const translation = { title: "Scientific mentorship", slug: "mentor-ru", summary: "Individual support for young researchers in the region.", description: "Develop research skills with an experienced scientist through regular individual meetings." };
const input = { scientistId: scientist, fieldId: field, format: "online", capacity: 1, ru: translation, kk: { ...translation, slug: "mentor-kk" } };
let offer: string;
async function save(value = input, id: string | null = null) {
  return (await db.query<{ id: string }>("select public.save_mentorship_offer($1, $2, $3::jsonb) as id", [id, actor, JSON.stringify(value)])).rows[0].id;
}
async function state(id: string, status: string | null, remove = false) {
  return db.query("select public.change_mentorship_offer_state($1, $2, $3, $4)", [id, actor, status, remove]);
}
async function submit(id: string, email: string, overrides = {}) {
  return db.query("select public.submit_mentorship_application($1, $2::jsonb)", [id, JSON.stringify({ fullName: "Young Scientist", email, locale: "ru", motivation: "I would like to develop a research project and learn to publish scientific results.", consent: true, ...overrides })]);
}
async function update(id: string, status: string, note = "Internal coordinator note") {
  return db.query("select public.update_mentorship_application($1, $2, $3, $4)", [id, actor, status, note]);
}
async function asRole(role: "anon" | "authenticated" | "service_role", sql: string, values: unknown[] = []) {
  await db.exec("set role " + role);
  try { return await db.query(sql, values); } finally { await db.exec("reset role"); }
}
beforeAll(async () => {
  await db.exec(String.raw`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text); alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    alter default privileges in schema public grant select on tables to anon, authenticated;
    alter default privileges in schema public grant all on tables to service_role;
  `);
  const directory = new URL("./migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
    await db.exec((await readFile(new URL(file, directory), "utf8")).replace("create extension if not exists pgcrypto;", ""));
  }
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users(id) values ($1), ($2)", [actor, outsider]);
  await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = 'admin'", [actor]);
  await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = 'project_manager'", [outsider]);
  await db.query("insert into public.scientific_fields(id, slug, name_ru, name_kk) values ($1, 'research', 'Исследования', 'Зерттеулер')", [field]);
  await db.query("insert into public.scientist_profiles(id, status, verified_at, created_by) values ($1, 'verified', now(), $2)", [scientist, actor]);
  for (const locale of ["ru", "kk"]) await db.query("insert into public.scientist_profile_translations(scientist_profile_id, locale, full_name, slug, position, short_bio, biography) values ($1, $2, 'Mentor Scientist', $2 || '-mentor', 'Researcher', 'Biography', 'Detailed biography')", [scientist, locale]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]);
}, 30000);
afterAll(async () => { await db.close(); });
describe("mentorship PostgreSQL permissions and workflow", () => {
  it("saves both translations and audit atomically, keeping drafts private", async () => {
    offer = await save();
    expect((await db.query("select * from public.mentorship_offer_translations")).rows).toHaveLength(2);
    expect((await asRole("anon", "select * from public.mentorship_offers")).rows).toHaveLength(0);
    expect((await asRole("authenticated", "select * from public.mentorship_offers")).rows).toHaveLength(1);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [outsider]);
    try { expect((await asRole("authenticated", "select * from public.mentorship_offers")).rows).toHaveLength(0); }
    finally { await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]); }
    await expect(save({ ...input, ru: { ...translation, slug: "other-ru" } })).rejects.toThrow(/unique constraint/);
    expect((await db.query("select * from public.mentorship_offers")).rows).toHaveLength(1);
    expect((await db.query("select * from public.audit_logs where action = 'mentorship.create'")).rows).toHaveLength(1);
  });
  it("denies direct writes and every RPC to anon and authenticated clients", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(asRole(role, "select public.save_mentorship_offer(null, $1, $2::jsonb)", [actor, JSON.stringify(input)])).rejects.toThrow(/permission denied/);
      await expect(asRole(role, "select public.submit_mentorship_application($1, '{}'::jsonb)", [offer])).rejects.toThrow(/permission denied/);
      await expect(asRole(role, "select public.change_mentorship_offer_state($1, $2, 'published')", [offer, actor])).rejects.toThrow(/permission denied/);
      await expect(asRole(role, "select public.update_mentorship_application($1, $2, 'accepted', '')", [offer, actor])).rejects.toThrow(/permission denied/);
      await expect(asRole(role, "update public.mentorship_offers set capacity = 50 where id = $1", [offer])).rejects.toThrow(/permission denied/);
    }
  });
  it("rejects unavailable offers and missing consent", async () => {
    await expect(submit(offer, "applicant@example.kz")).rejects.toThrow("not_available");
    await state(offer, "published");
    await expect(submit(offer, "applicant@example.kz", { consent: false })).rejects.toThrow("consent_required");
    await expect(submit(offer, "applicant@example.kz", { consent: undefined })).rejects.toThrow("consent_required");
    expect((await db.query("select * from public.mentorship_applications")).rows).toHaveLength(0);
  });
  it("hides published offers immediately when a mentor is unverified or a field is inactive", async () => {
    expect((await asRole("anon", "select * from public.mentorship_offers")).rows).toHaveLength(1);
    await db.query("update public.scientist_profiles set status = 'draft' where id = $1", [scientist]);
    expect((await asRole("anon", "select * from public.mentorship_offer_translations")).rows).toHaveLength(0);
    await expect(submit(offer, "applicant@example.kz")).rejects.toThrow("not_available");
    await db.query("update public.scientist_profiles set status = 'verified' where id = $1", [scientist]);
    await db.query("update public.scientific_fields set is_active = false where id = $1", [field]);
    expect((await asRole("anon", "select * from public.mentorship_offers")).rows).toHaveLength(0);
    await expect(submit(offer, "applicant@example.kz")).rejects.toThrow("not_available");
    await db.query("update public.scientific_fields set is_active = true where id = $1", [field]);
  });
  it("stores consent and normalized email without copying personal data into audit", async () => {
    await asRole("service_role", "select public.submit_mentorship_application($1, $2::jsonb)", [offer, JSON.stringify({ fullName: "Young Scientist", email: " APPLICANT@example.kz ", locale: "ru", motivation: "I would like to develop a research project and learn to publish scientific results.", consent: true })]);
    const rows = await db.query<{ email: string; consent_at: string }>("select email, consent_at from public.mentorship_applications");
    expect(rows.rows[0].email).toBe("applicant@example.kz"); expect(rows.rows[0].consent_at).toBeTruthy();
    const audit = await db.query("select new_data from public.audit_logs where action = 'mentorship.application.create'");
    expect(JSON.stringify(audit.rows)).not.toMatch(/applicant@example|Young Scientist|publish scientific/);
    await expect(submit(offer, "APPLICANT@example.kz")).rejects.toThrow("duplicate_application");
  });
  it("keeps applications private to mentorship managers", async () => {
    await expect(asRole("anon", "select * from public.mentorship_applications")).rejects.toThrow(/permission denied/);
    expect((await asRole("authenticated", "select * from public.mentorship_applications")).rows).toHaveLength(1);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [outsider]);
    try { expect((await asRole("authenticated", "select * from public.mentorship_applications")).rows).toHaveLength(0); }
    finally { await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]); }
  });
  it("requires review, bounds accepted participants, and blocks deletion with active applications", async () => {
    const first = (await db.query<{ id: string }>("select id from public.mentorship_applications where email = 'applicant@example.kz'")).rows[0].id;
    await expect(update(first, "accepted")).rejects.toThrow("invalid_transition");
    await submit(offer, "second@example.kz");
    const second = (await db.query<{ id: string }>("select id from public.mentorship_applications where email = 'second@example.kz'")).rows[0].id;
    await update(first, "in_review"); await update(first, "accepted");
    await update(second, "in_review"); await expect(update(second, "accepted")).rejects.toThrow("capacity_exceeded");
    await expect(submit(offer, "third@example.kz")).rejects.toThrow("capacity_exceeded");
    await expect(state(offer, null, true)).rejects.toThrow("mentor_has_applications");
    await update(first, "completed");
    await expect(update(second, "accepted", "x".repeat(5001))).rejects.toThrow(/check constraint/);
    expect((await db.query("select status from public.mentorship_applications where id = $1", [second])).rows[0]).toEqual({ status: "in_review" });
    await update(second, "accepted");
    await expect(update(first, "accepted")).rejects.toThrow("invalid_transition");
    await update(second, "completed");
  });
  it("rejects capacity reductions and mentor replacements with active applications", async () => {
    await submit(offer, "active@example.kz");
    const id = (await db.query<{ id: string }>("select id from public.mentorship_applications where email = 'active@example.kz'")).rows[0].id;
    await update(id, "in_review"); await update(id, "accepted");
    const larger = { ...input, capacity: 2 };
    await save(larger, offer); await state(offer, "published");
    await submit(offer, "another@example.kz");
    const another = (await db.query<{ id: string }>("select id from public.mentorship_applications where email = 'another@example.kz'")).rows[0].id;
    await update(another, "in_review"); await update(another, "accepted");
    await expect(save(input, offer)).rejects.toThrow("capacity_exceeded");
    const replacement = "00000000-0000-4000-a000-000000000015";
    await db.query("insert into public.scientist_profiles(id, status, verified_at, created_by) values ($1, 'verified', now(), $2)", [replacement, actor]);
    await expect(save({ ...larger, scientistId: replacement }, offer)).rejects.toThrow("mentor_has_applications");
    await expect(db.query("update public.mentorship_applications set manager_note = $1 where id = $2", ["x".repeat(5001), id])).rejects.toThrow(/check constraint/);
    await update(id, "completed"); await update(another, "completed");
  });
  it("rolls back published edits on translation conflicts and resets successful edits to draft", async () => {
    const other = await save({ ...input, ru: { ...translation, slug: "other-ru" }, kk: { ...translation, slug: "other-kk" } });
    await expect(save({ ...input, ru: { ...translation, title: "Changed title" }, kk: { ...input.kk, slug: "other-kk" } }, offer)).rejects.toThrow(/unique constraint/);
    expect((await db.query("select status from public.mentorship_offers where id = $1", [offer])).rows[0]).toEqual({ status: "published" });
    await save(input, offer);
    expect((await asRole("anon", "select * from public.mentorship_offers")).rows).toHaveLength(0);
    await db.query("delete from public.mentorship_offers where id = $1", [other]);
    await state(offer, "published");
  });
  it("limits daily submissions across offers and refuses acceptance while archived", async () => {
    const ids: string[] = [];
    for (let n = 0; n < 4; n++) {
      const id = await save({ ...input, ru: { ...translation, slug: `daily-${n}-ru` }, kk: { ...translation, slug: `daily-${n}-kk` } });
      ids.push(id); await state(id, "published");
      if (n < 3) await submit(id, "daily@example.kz");
      else await expect(submit(id, "daily@example.kz")).rejects.toThrow("rate_limited");
    }
    const application = (await db.query<{ id: string }>("select id from public.mentorship_applications where offer_id = $1", [ids[0]])).rows[0].id;
    await update(application, "in_review"); await state(ids[0], "archived");
    await expect(update(application, "accepted")).rejects.toThrow("not_available");
    await expect(state(ids[0], "published")).rejects.toThrow("invalid_transition");
    await update(application, "rejected");
  });
  it("soft-deletes completed offers and hides all related public translations", async () => {
    await state(offer, null, true);
    expect((await asRole("anon", "select * from public.mentorship_offers where id = $1", [offer])).rows).toHaveLength(0);
    expect((await asRole("anon", "select * from public.mentorship_offer_translations where offer_id = $1", [offer])).rows).toHaveLength(0);
    expect((await asRole("authenticated", "select * from public.mentorship_applications where offer_id = $1", [offer])).rows).toHaveLength(0);
    await expect(submit(offer, "after-delete@example.kz")).rejects.toThrow("not_available");
  });
});
