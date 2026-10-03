import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const db = new PGlite();
const actor = "00000000-0000-4000-a000-000000000021";
const field = "00000000-0000-4000-a000-000000000022";
const coordinator = "00000000-0000-4000-a000-000000000023";
const outsider = "00000000-0000-4000-a000-000000000024";
const translation = { title: "Regional Research Program", slug: "program", summary: "Research skills for young scientists in the region.", description: "Develop research skills and prepare a scientific project with an experienced coordinator.", curriculum: "Research methods, analysis and scientific writing.", eligibility: "Young scientists with a proposed research topic.", outcomes: "A research plan and an initial scientific presentation." };
let dates: { applicationsOpenOn: string; applicationDeadline: string; startsOn: string; endsOn: string };
let serial = 0;
const input = () => ({ coordinatorId: coordinator, fieldId: field, format: "online", capacity: 1, ...dates, ru: { ...translation, slug: `program-${++serial}-ru` }, kk: { ...translation, slug: `program-${serial}-kk` } });
async function save(value = input(), id: string | null = null) {
  return (await asRole("service_role", "select public.save_research_program($1, $2, $3::jsonb) as id", [id, actor, JSON.stringify(value)])).rows[0].id as string;
}
async function state(id: string, status: string | null, remove = false) {
  return asRole("service_role", "select public.change_research_program_state($1, $2, $3, $4)", [id, actor, status, remove]);
}
async function published(overrides = {}) {
  const id = await save({ ...input(), ...overrides }); await state(id, "published"); return id;
}
async function submit(id: string, email: string, overrides = {}) {
  return asRole("service_role", "select public.submit_research_program_application($1, $2::jsonb)", [id, JSON.stringify({ fullName: "Young Scientist", email, locale: "ru", motivation: "I want to develop my research skills and prepare a scientific publication.", consent: true, ...overrides })]);
}
async function update(id: string, status: string, note = "Internal note") {
  return asRole("service_role", "select public.update_research_program_application($1, $2, $3, $4)", [id, actor, status, note]);
}
async function application(id: string, email: string) {
  await submit(id, email);
  return (await db.query<{ id: string }>("select id from public.research_program_applications where program_id = $1 and email = $2", [id, email])).rows[0].id;
}
async function asRole(role: "anon" | "authenticated" | "service_role", sql: string, values: unknown[] = []) {
  await db.exec("set role " + role);
  try { return await db.query<Record<string, unknown>>(sql, values); } finally { await db.exec("reset role"); }
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
    alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
    alter default privileges in schema public grant all on tables to service_role;
  `);
  const directory = new URL("./migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
    await db.exec((await readFile(new URL(file, directory), "utf8")).replace("create extension if not exists pgcrypto;", ""));
  }
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users(id, email) values ($1, 'admin@example.kz'), ($2, 'outsider@example.kz')", [actor, outsider]);
  await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = 'admin'", [actor]);
  await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = 'project_manager'", [outsider]);
  await db.query("insert into public.scientific_fields(id, slug, name_ru, name_kk) values ($1, 'science', 'Наука', 'Ғылым')", [field]);
  await db.query("insert into public.scientist_profiles(id, status, verified_at, created_by) values ($1, 'verified', now(), $2)", [coordinator, actor]);
  for (const locale of ["ru", "kk"]) await db.query("insert into public.scientist_profile_translations(scientist_profile_id, locale, full_name, slug, position, short_bio, biography) values ($1, $2, 'Program Coordinator', $2 || '-coordinator', 'Researcher', 'Biography', 'Detailed biography')", [coordinator, locale]);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]);
  const today = (await db.query<{ day: string }>("select to_char((now() at time zone 'Asia/Almaty')::date, 'YYYY-MM-DD') as day")).rows[0].day;
  const date = (offset: number) => new Date(new Date(today + "T00:00:00Z").getTime() + offset * 86400000).toISOString().slice(0, 10);
  dates = { applicationsOpenOn: date(-2), applicationDeadline: date(2), startsOn: date(3), endsOn: date(30) };
}, 30000);
afterAll(async () => { await db.close(); });

describe("research program PostgreSQL permissions and workflow", () => {
  it("saves bilingual content and audit atomically and keeps drafts private", async () => {
    const value = input(); const id = await save(value);
    expect((await db.query("select * from public.research_program_translations where program_id = $1", [id])).rows).toHaveLength(2);
    expect((await asRole("anon", "select * from public.research_programs where id = $1", [id])).rows).toHaveLength(0);
    expect((await asRole("authenticated", "select * from public.research_programs where id = $1", [id])).rows).toHaveLength(1);
    await expect(save(value)).rejects.toThrow(/unique constraint/);
    expect((await db.query("select * from public.audit_logs where entity_id = $1", [id])).rows).toHaveLength(1);
    await expect(save({ ...input(), startsOn: dates.applicationsOpenOn })).rejects.toThrow(/check constraint/);
  });
  it("revokes default client writes and denies all mutation RPCs to public clients", async () => {
    const id = await save();
    for (const role of ["anon", "authenticated"] as const) {
      for (const [sql, values] of [
        ["select public.save_research_program(null, $1, $2::jsonb)", [actor, JSON.stringify(input())]],
        ["select public.change_research_program_state($1, $2, 'published')", [id, actor]],
        ["select public.submit_research_program_application($1, '{}'::jsonb)", [id]],
        ["select public.update_research_program_application($1, $2, 'accepted', '')", [id, actor]],
        ["update public.research_programs set capacity = 500 where id = $1", [id]],
        ["delete from public.research_program_translations where program_id = $1", [id]],
        ["insert into public.research_program_applications(program_id) values ($1)", [id]],
      ] as Array<[string, unknown[]]>) {
        await expect(asRole(role, sql, values)).rejects.toThrow(/permission denied/);
      }
    }
  });
  it("closes submission before and after the inclusive intake dates", async () => {
    const future = await published({ applicationsOpenOn: dates.applicationDeadline });
    await expect(submit(future, "future@example.kz")).rejects.toThrow("applications_closed");
    const past = await published({ applicationDeadline: dates.applicationsOpenOn });
    await expect(submit(past, "past@example.kz")).rejects.toThrow("applications_closed");
    const today = (await db.query<{ day: string }>("select to_char((now() at time zone 'Asia/Almaty')::date, 'YYYY-MM-DD') as day")).rows[0].day;
    const lastDay = await published({ applicationDeadline: today });
    await submit(lastDay, "last-day@example.kz");
  });
  it("requires consent, normalizes email and keeps personal data out of audit", async () => {
    const id = await published();
    await expect(submit(id, "no-consent@example.kz", { consent: false })).rejects.toThrow("consent_required");
    await expect(submit(id, "no-consent@example.kz", { consent: undefined })).rejects.toThrow("consent_required");
    await submit(id, " APPLICANT@example.kz ");
    const rows = (await db.query<{ email: string; consent_at: string }>("select email, consent_at from public.research_program_applications where program_id = $1", [id])).rows;
    expect(rows[0].email).toBe("applicant@example.kz"); expect(rows[0].consent_at).toBeTruthy();
    const audit = await db.query("select old_data, new_data from public.audit_logs where action like 'research_program.application.%'");
    expect(JSON.stringify(audit.rows)).not.toMatch(/example.kz|Young Scientist|scientific publication/);
    await expect(submit(id, "APPLICANT@example.kz")).rejects.toThrow("duplicate_application");
  });
  it("restricts applicant information to research program managers", async () => {
    const id = await published(); await submit(id, "private@example.kz");
    await expect(asRole("anon", "select * from public.research_program_applications")).rejects.toThrow(/permission denied/);
    expect((await asRole("authenticated", "select * from public.research_program_applications where program_id = $1", [id])).rows).toHaveLength(1);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [outsider]);
    try {
      expect((await asRole("authenticated", "select * from public.research_program_applications")).rows).toHaveLength(0);
      const draft = await save();
      expect((await asRole("authenticated", "select * from public.research_programs where id = $1", [draft])).rows).toHaveLength(0);
    } finally { await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]); }
  });
  it("hides programs when the coordinator or direction becomes unavailable", async () => {
    const id = await published();
    await db.query("update public.scientist_profiles set status = 'draft' where id = $1", [coordinator]);
    expect((await asRole("anon", "select * from public.research_program_translations where program_id = $1", [id])).rows).toHaveLength(0);
    await expect(submit(id, "hidden@example.kz")).rejects.toThrow("not_available");
    await db.query("update public.scientist_profiles set status = 'verified' where id = $1", [coordinator]);
    await db.query("update public.scientific_fields set is_active = false where id = $1", [field]);
    expect((await asRole("anon", "select * from public.research_programs where id = $1", [id])).rows).toHaveLength(0);
    await expect(submit(id, "hidden@example.kz")).rejects.toThrow("not_available");
    await db.query("update public.scientific_fields set is_active = true where id = $1", [field]);
  });
  it("requires review, preserves cohort limits after completion and rolls back bad notes", async () => {
    const id = await published();
    const first = await application(id, "first@example.kz");
    const second = await application(id, "second@example.kz");
    await expect(update(first, "accepted")).rejects.toThrow("invalid_transition");
    await update(first, "in_review"); await update(first, "accepted");
    await update(second, "in_review");
    await expect(update(second, "accepted")).rejects.toThrow("capacity_exceeded");
    await update(first, "completed");
    await expect(update(second, "accepted")).rejects.toThrow("capacity_exceeded");
    await expect(submit(id, "third@example.kz")).rejects.toThrow("capacity_exceeded");
    await expect(submit(id, "first@example.kz")).rejects.toThrow("duplicate_application");
    await expect(update(second, "rejected", "x".repeat(5001))).rejects.toThrow(/check constraint/);
    expect((await db.query<{ status: string }>("select status from public.research_program_applications where id = $1", [second])).rows[0].status).toBe("in_review");
    await expect(update(first, "accepted")).rejects.toThrow("invalid_transition");
  });
  it("rejects capacity reductions and coordinator replacements while applications are active", async () => {
    const value = { ...input(), capacity: 2 }; const id = await save(value); await state(id, "published");
    for (const email of ["capacity-1@example.kz", "capacity-2@example.kz"]) {
      const app = await application(id, email); await update(app, "in_review"); await update(app, "accepted");
    }
    await expect(save({ ...value, capacity: 1 }, id)).rejects.toThrow("capacity_exceeded");
    const replacement = "00000000-0000-4000-a000-000000000025";
    await db.query("insert into public.scientist_profiles(id, status, verified_at, created_by) values ($1, 'verified', now(), $2)", [replacement, actor]);
    await expect(save({ ...value, coordinatorId: replacement }, id)).rejects.toThrow("program_has_applications");
    await expect(state(id, null, true)).rejects.toThrow("program_has_applications");
  });
  it("rolls back conflicting edits and resets successful edits to draft", async () => {
    const value = input(); const id = await save(value); await state(id, "published");
    const other = input(); await save(other);
    await expect(save({ ...value, ru: { ...value.ru, title: "Changed title" }, kk: other.kk }, id)).rejects.toThrow(/unique constraint/);
    expect((await db.query<{ status: string }>("select status from public.research_programs where id = $1", [id])).rows[0].status).toBe("published");
    await save(value, id);
    expect((await asRole("anon", "select * from public.research_programs where id = $1", [id])).rows).toHaveLength(0);
  });
  it("bounds daily submissions across programs", async () => {
    for (let n = 0; n < 4; n++) {
      const id = await published();
      if (n < 3) await submit(id, "daily@example.kz");
      else await expect(submit(id, "daily@example.kz")).rejects.toThrow("rate_limited");
    }
  });
  it("allows selection after the deadline but blocks it for archived or ended programs", async () => {
    const value = input(); const id = await save(value); await state(id, "published");
    const app = await application(id, "selection@example.kz"); await update(app, "in_review");
    await save({ ...value, applicationDeadline: dates.applicationsOpenOn }, id); await state(id, "published");
    await update(app, "accepted");
    const archived = await published(); const other = await application(archived, "archived@example.kz");
    await update(other, "in_review"); await state(archived, "archived");
    await expect(update(other, "accepted")).rejects.toThrow("not_available");
    await expect(state(archived, "published")).rejects.toThrow("invalid_transition");
    await state(archived, "draft");
    await save({ ...input(), applicationDeadline: dates.applicationsOpenOn, startsOn: dates.applicationsOpenOn, endsOn: dates.applicationsOpenOn }, archived);
    await state(archived, "published");
    await expect(update(other, "accepted")).rejects.toThrow("not_available");
  });
  it("soft-deletes finished programs and removes applications from manager queues", async () => {
    const id = await published(); const app = await application(id, "finished@example.kz");
    await update(app, "in_review"); await update(app, "accepted"); await update(app, "completed");
    await state(id, null, true);
    expect((await asRole("anon", "select * from public.research_program_translations where program_id = $1", [id])).rows).toHaveLength(0);
    expect((await asRole("authenticated", "select * from public.research_program_applications where program_id = $1", [id])).rows).toHaveLength(0);
    await expect(submit(id, "after-delete@example.kz")).rejects.toThrow("not_available");
  });
});
