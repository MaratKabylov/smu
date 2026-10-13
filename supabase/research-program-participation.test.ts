import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import type { AccountResearchProgram } from "../src/lib/validation/research-program-participation";
let db: PGlite;
const manager = "00000000-0000-4000-a000-000000000081";
const own = "00000000-0000-4000-a000-000000000082";
const other = "00000000-0000-4000-a000-000000000083";
const unconfirmed = "00000000-0000-4000-a000-000000000084";
const anonymous = "00000000-0000-4000-a000-000000000085";
let program: string, mentor: string, field: string;
let legacyApp: string, completedApp: string, legacyBefore: unknown, legacyAfter: unknown;
async function run<T = Record<string, unknown>>(actor: string | null, sql: string, params: unknown[] = [], role = actor ? "authenticated" : "anon") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return (await db.query<T>(sql, params)).rows; }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function person(userId: string | null = null, isPublic = true) {
  const id = (await db.query<{ id: string }>("insert into public.scientist_profiles(user_id,created_by,status,verification_status,is_public,verified_at) values($1,$2,'verified','verified',$3,now()) returning id", [userId, manager, isPublic])).rows[0].id;
  for (const locale of ["ru", "kk"]) await db.query("insert into public.scientist_profile_translations(scientist_profile_id,locale,full_name,slug,position,short_bio,biography) values($1,$2,'Program Mentor',$3,'Scientist','Scientific biography','Detailed scientific biography')", [id, locale, `mentor-${id}`]);
  return id;
}
async function setupProgram() {
  field = (await db.query<{ id: string }>("insert into public.scientific_fields(slug,name_ru,name_kk) values('science','Science','Science') returning id")).rows[0].id;
  mentor = await person();
  program = (await db.query<{ id: string }>("insert into public.research_programs(coordinator_id,field_id,format,capacity,applications_open_on,application_deadline,starts_on,ends_on,status,created_by) values($1,$2,'online',2,current_date-1,current_date,current_date,current_date+30,'published',$3) returning id", [mentor, field, manager])).rows[0].id;
  for (const locale of ["ru", "kk"]) await db.query("insert into public.research_program_translations(program_id,locale,title,slug,summary,description,curriculum,eligibility,outcomes) values($1,$2,'Research Program','program','Research program summary.','Detailed scientific research program description.','Research methods and training.','Researchers and scientists.','Scientific results and skills.')", [program, locale]);
}
async function application(userId: string | null = own, status = "new") {
  return (await db.query<{ id: string }>("insert into public.research_program_applications(program_id,user_id,locale,full_name,email,motivation,status,manager_note) values($1,$2,'ru','SECRET NAME',$3,'SECRET MOTIVATION for scientific research and collaboration.',$4,'SECRET NOTE') returning id", [program, userId, `${crypto.randomUUID()}@example.org`, status])).rows[0].id;
}
const decide = (id: string, status: string, actor = manager, note = "SECRET NOTE") => run(actor, "select public.decide_research_program_application($1,$2,$3)", [id, status, note]);
async function accept(id: string) { await decide(id, "in_review"); await decide(id, "accepted"); }
const assign = (id: string, person: string | null = mentor, version = 1, actor = manager) => run(actor, "select public.assign_research_program_mentor($1,$2,$3)", [id, person, version]);
async function account(id: string, actor = own, locale = "ru") {
  return (await run<{ result: AccountResearchProgram | null }>(actor, "select public.get_account_research_program($1,$2) result", [id, locale]))[0].result;
}
async function relation(id: string) {
  return (await run<{ result: { mentorId: string | null; version: number; status: string } }>(manager, "select public.get_research_program_participation($1) result", [id]))[0].result;
}
async function list(actor = own, page = 1, locale = "ru") {
  return (await run<{ result: { total: number; items: { id: string; locale: string }[] } }>(actor, "select public.list_account_records($1,'research-program',$2,null) result", [locale, page]))[0].result;
}
async function project(id: string, scientist: string) {
  const work = (await db.query<{ id: string }>("insert into public.science_works(kind,field_id,created_by,status,published_at) values('project',$1,$2,'published',now()) returning id", [field, manager])).rows[0].id;
  await db.query("insert into public.science_work_members values($1,$2,'member')", [work, scientist]);
  for (const locale of ["ru", "kk"]) await db.query("insert into public.science_work_translations(work_id,locale,title,slug,summary,description) values($1,$2,'Program project',$3,'Scientific research project summary.','Detailed description of the scientific project.')", [work, locale, `project-${work}`]);
  await db.query("insert into public.research_program_projects values($1,$2)", [program, work]);
  await db.query("insert into public.research_program_project_participants values($1,$2,$3,$4)", [program, work, id, scientist]);
  return work;
}
beforeAll(async () => {
  db = await createMigrationDatabase({ through: 32 });
  await db.exec("alter table auth.users add column email_confirmed_at timestamptz; alter table auth.users add column is_anonymous boolean default false");
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const id of [manager, own, other, unconfirmed, anonymous]) await db.query("insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at,is_anonymous) values($1,$2,$3,$4,$5)", [id, `${id}@example.org`, '{"role":"super_admin"}', id === unconfirmed ? null : "2026-10-01", id === anonymous]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='admin'", [manager]);
  await setupProgram(); legacyApp = await application(own, "accepted"); completedApp = await application(null, "completed");
  legacyBefore = (await db.query("select * from public.research_program_applications order by id")).rows;
  await db.exec(await readFile(new URL("./migrations/033_research_program_participation.sql", import.meta.url), "utf8"));
  legacyAfter = (await db.query("select * from public.research_program_applications order by id")).rows;
}, 30000);
beforeEach(async context => {
  if (context.task.name.startsWith("preserves legacy")) return;
  await db.exec("truncate public.research_programs,public.science_works,public.scientist_profiles,public.scientific_fields,public.audit_logs cascade");
  await setupProgram();
});
afterAll(async () => { await db?.close(); });

describe("Research Program participation and private account projection", () => {
  it("preserves legacy applications and records observed active/completed state without fabricated mentors", async () => {
    expect(legacyAfter).toEqual(legacyBefore);
    expect(await account(legacyApp)).toMatchObject({ participation: { status: "active", baseline: true, mentorAssigned: false, mentor: null } });
    expect(await relation(completedApp)).toMatchObject({ status: "completed", mentorId: null, version: 1 });
  });
  it("creates one stable participation on acceptance and completes it atomically", async () => {
    const id = await application(); expect((await account(id))?.participation).toBeNull(); expect((await list()).total).toBe(0);
    await expect(decide(id, "accepted")).rejects.toThrow("invalid_transition");
    await accept(id); await assign(id); const before = await relation(id);
    expect((await account(id))?.participation).toMatchObject({ status: "active", baseline: false, mentorAssigned: true, mentor: { name: "Program Mentor" } });
    const audits = (await db.query("select * from public.audit_logs")).rows.length;
    await decide(id, "accepted"); expect(await relation(id)).toEqual(before); expect((await db.query("select * from public.audit_logs")).rows.length).toBe(audits);
    await decide(id, "completed"); expect(await relation(id)).toEqual({ ...before, status: "completed", version: before.version + 1 });
    await expect(decide(id, "accepted")).rejects.toThrow("invalid_transition"); await expect(assign(id, null, 3)).rejects.toThrow("invalid_transition");
    expect((await list()).items).toEqual([expect.objectContaining({ id })]);
  });
  it("retains intake capacity after completion and rejects unavailable acceptance", async () => {
    await db.query("update public.research_programs set capacity=1 where id=$1", [program]);
    const id = await application(); await accept(id); await decide(id, "completed");
    const next = await application(other); await decide(next, "in_review"); await expect(decide(next, "accepted")).rejects.toThrow("capacity_exceeded");
    await db.query("update public.research_programs set status='archived' where id=$1", [program]); await expect(decide(next, "accepted")).rejects.toThrow("not_available");
    expect(await relation(next)).toBeNull();
  });
  it("protects assignments from stale versions, permits unassignment and validates current mentor visibility", async () => {
    const id = await application(); await accept(id); await assign(id); await expect(assign(id, null)).rejects.toThrow("stale_version");
    await assign(id, null, 2); expect(await relation(id)).toEqual({ status: "active", mentorId: null, version: 3 });
    await assign(id, null, 3); expect((await relation(id)).version).toBe(3);
    await db.query("update public.scientist_profiles set is_public=false where id=$1", [mentor]); await expect(assign(id, mentor, 3)).rejects.toThrow("invalid_reference");
    await expect(run(manager, "select public.assign_research_program_mentor($1,$2,null)", [id, mentor])).rejects.toThrow("stale_version");
  });
  it("hides mentor details immediately when a profile becomes private, unverified or deleted", async () => {
    const id = await application(); await accept(id); await assign(id);
    for (const clause of ["is_public=false", "is_public=true,status='draft'", "status='verified',verified_at=now(),deleted_at=now()"]) {
      await db.query(`update public.scientist_profiles set ${clause} where id=$1`, [mentor]);
      expect((await account(id))?.participation).toMatchObject({ mentorAssigned: true, mentor: null });
      expect(JSON.stringify(await account(id))).not.toContain("Program Mentor");
    }
  });
  it("limits account reads to the current owner even for managers, with confirmed nonanonymous Auth", async () => {
    const id = await application(); await accept(id);
    for (const actor of [other, manager]) { expect(await account(id, actor)).toBeNull(); expect((await list(actor)).total).toBe(0); }
    for (const actor of [unconfirmed, anonymous]) await expect(account(id, actor)).rejects.toThrow("forbidden");
    await expect(run(null, "select public.get_account_research_program($1,'ru')", [id])).rejects.toThrow("permission denied");
    expect(JSON.stringify(await account(id))).not.toMatch(/SECRET|@example|userId|mentorId|actorId|manager_note/);
  });
  it("enforces DB management permissions, client grants and RLS rather than metadata", async () => {
    const id = await application(); await accept(id);
    await expect(decide(id, "completed", other)).rejects.toThrow("forbidden"); await expect(assign(id, mentor, 1, own)).rejects.toThrow("forbidden");
    await expect(run(other, "select public.get_research_program_participation($1)", [id])).rejects.toThrow("forbidden");
    expect(await run(own, "select * from public.research_program_participations")).toEqual([]);
    await expect(run(manager, "update public.research_program_participations set mentor_id=$1", [mentor])).rejects.toThrow("permission denied");
    for (const role of ["anon", "service_role"]) await expect(run(null, "select public.get_account_research_program($1,'ru')", [id], role)).rejects.toThrow("permission denied");
    await expect(run(manager, "select public.update_research_program_application_core($1,$2,'completed','')", [id, manager])).rejects.toThrow("permission denied");
    await expect(run(manager, "select public.list_account_records_core('ru','applications',1,null)")).rejects.toThrow("permission denied");
  });
  it("keeps the trusted legacy decision RPC consistent and rejects unauthorized actors", async () => {
    const id = await application(); await decide(id, "in_review");
    await expect(run(null, "select public.update_research_program_application($1,$2,'accepted','')", [id, other], "service_role")).rejects.toThrow("forbidden");
    await run(null, "select public.update_research_program_application($1,$2,'accepted','')", [id, manager], "service_role");
    expect(await relation(id)).toMatchObject({ status: "active" });
  });
  it("keeps guest participation stable after verified email claim", async () => {
    const id = await application(null); await accept(id); await assign(id); const before = await relation(id);
    await db.query("update public.research_program_applications set email=$1 where id=$2", [`${own}@example.org`, id]);
    expect(await account(id)).toBeNull(); await run(own, "select public.claim_account_applications()");
    expect(await relation(id)).toEqual(before); expect((await account(id))?.participation?.mentorAssigned).toBe(true);
    await db.query("update auth.users set email='changed@example.org' where id=$1", [own]); expect(await account(id)).not.toBeNull();
  });
  it("shows assigned projects only with current own scientist linkage and team membership", async () => {
    const id = await application(); await accept(id); const scientist = await person(own, false); const work = await project(id, scientist);
    expect((await account(id))?.projects).toEqual([expect.objectContaining({ id: work })]);
    await db.query("update public.scientist_profiles set user_id=$1 where id=$2", [other, scientist]); expect((await account(id))?.projects).toEqual([]);
    await db.query("update public.scientist_profiles set user_id=$1 where id=$2", [own, scientist]);
    await db.query("delete from public.science_work_members where work_id=$1", [work]); expect((await account(id))?.projects).toEqual([]);
    await db.query("insert into public.science_work_members values($1,$2,'member')", [work, scientist]);
    await db.query("update public.science_works set deleted_at=now() where id=$1", [work]); expect((await account(id))?.projects).toEqual([]);
  });
  it("returns published output versions through existing visibility rules without private files", async () => {
    const id = await application(); await accept(id); const scientist = await person(own); const work = await project(id, scientist);
    const translation = { title: "Scientific output", description: "Detailed report of the scientific research findings." };
    const output = (await run<{ id: string }>(manager, "select public.save_research_output(null,$1) id", [JSON.stringify({ kind: "report", status: "published", versionLabel: "v1", license: "CC BY", externalUrl: "", changeNote: "", workIds: [work], files: [], ru: translation, kk: translation })]))[0].id;
    expect((await account(id))?.projects[0].outputs).toEqual([expect.objectContaining({ id: output, version: 1, files: [] })]);
    expect((await account(id, own, "en"))?.projects[0]).toMatchObject({ locale: "ru", outputs: [] });
    for (const clause of ["status='draft'", "status='published',published_at=now()+interval '1 day'"]) {
      await db.query(`update public.research_outputs set ${clause} where id=$1`, [output]); expect((await account(id))?.projects[0].outputs).toEqual([]);
    }
    await db.query("update public.research_outputs set published_at=now() where id=$1", [output]);
    await db.query("update public.science_works set status='draft' where id=$1", [work]); expect((await account(id))?.projects[0].outputs).toEqual([]);
  });
  it("paginates own enrollments stably and provides translation fallback without public exposure", async () => {
    for (let i=0; i<21; i++) { const id = await application(own, "completed"); await db.query("insert into public.research_program_participations(application_id,status) values($1,'completed')", [id]); }
    const first = await list(own, 1, "en"), next = await list(own, 2); expect(first.total).toBe(21); expect(first.items).toHaveLength(20); expect(next.items).toHaveLength(1);
    expect(first.items.every(item => item.locale === "ru")).toBe(true); expect(first.items.map(item => item.id)).not.toContain(next.items[0].id);
    await expect(run(own, "select public.list_account_records('ru','research-program',0,null)")).rejects.toThrow("invalid_input");
    await expect(account(first.items[0].id, own, "de")).rejects.toThrow("invalid_input");
    await db.query("update public.research_programs set deleted_at=now() where id=$1", [program]); expect((await list()).total).toBe(0); expect(await account(first.items[0].id)).toBeNull();
  });
  it("rolls back acceptance, completion and mentor assignment when audit insertion fails", async () => {
    const id = await application(); await decide(id, "in_review");
    await db.exec("create function public.reject_program_participation_audit() returns trigger language plpgsql as $$ begin raise exception 'audit_failed'; end $$; create trigger reject_program_participation_audit before insert on public.audit_logs for each row execute function public.reject_program_participation_audit()");
    try { await expect(decide(id, "accepted")).rejects.toThrow("audit_failed"); expect(await relation(id)).toBeNull(); }
    finally { await db.exec("drop trigger reject_program_participation_audit on public.audit_logs"); }
    await decide(id, "accepted"); const before = await relation(id);
    await db.exec("create trigger reject_program_participation_audit before insert on public.audit_logs for each row execute function public.reject_program_participation_audit()");
    try {
      await expect(assign(id)).rejects.toThrow("audit_failed"); await expect(decide(id, "completed")).rejects.toThrow("audit_failed");
      expect(await relation(id)).toEqual(before); expect((await account(id))?.applicationStatus).toBe("accepted");
    } finally { await db.exec("drop trigger reject_program_participation_audit on public.audit_logs; drop function public.reject_program_participation_audit()"); }
  });
});
