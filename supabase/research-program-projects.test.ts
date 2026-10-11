import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
let db: PGlite;
const manager = "00000000-0000-4000-a000-000000000091";
const user = "00000000-0000-4000-a000-000000000092";
let program: string, work: string, scientist: string, application: string, field: string;
async function asRole<T>(actor: string | null, action: () => Promise<T>, role = actor ? "authenticated" : "anon") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return await action(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
const input = (patch: Record<string, unknown> = {}) => ({ expectedVersion: 0, workIds: [work], participants: [{ workId: work, applicationId: application, scientistId: scientist }], ...patch });
async function save(patch: Record<string, unknown> = {}, actor = manager) {
  return asRole(actor, async () => (await db.query<{ version: number }>("select public.save_research_program_projects($1,$2) version", [program, JSON.stringify(input(patch))])).rows[0].version);
}
async function publicList(actor: string | null = null, locale = "ru") {
  return (await asRole(actor, () => db.query<{ value: { id: string; members: { id: string }[] }[] }>("select public.list_public_research_program_projects($1,$2) value", [program, locale]))).rows[0].value;
}
async function get() {
  return (await asRole(manager, () => db.query<{ value: { version: number; workIds: string[]; applications: { name: string }[]; participants: unknown[] } }>("select public.get_research_program_projects($1) value", [program]))).rows[0].value;
}
beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [id, role] of [[manager, "admin"], [user, "author"]]) {
    await db.query("insert into auth.users values($1,$2,'{}')", [id, id + "@example.kz"]);
    await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2", [id, role]);
  }
}, 30000);
beforeEach(async () => {
  await db.exec("truncate public.research_programs,public.science_works,public.scientist_profiles,public.scientific_fields,public.audit_logs cascade");
  field = (await db.query<{ id: string }>("insert into public.scientific_fields(slug,name_ru,name_kk) values('science','Наука','Ғылым') returning id")).rows[0].id;
  scientist = (await db.query<{ id: string }>("insert into public.scientist_profiles(created_by,status,verification_status,is_public,verified_at) values($1,'verified','verified',true,now()) returning id", [manager])).rows[0].id;
  for (const locale of ["ru", "kk"]) await db.query("insert into public.scientist_profile_translations(scientist_profile_id,locale,full_name,slug,short_bio,biography,position) values($1,$2,'Scientist Name','scientist','Scientific biography','Scientific biography','Researcher')", [scientist, locale]);
  work = (await db.query<{ id: string }>("insert into public.science_works(kind,status,published_at,field_id,created_by) values('project','published',now(),$1,$2) returning id", [field, manager])).rows[0].id;
  await db.query("insert into public.science_work_members values($1,$2,'lead')", [work, scientist]);
  for (const locale of ["ru", "kk"]) await db.query("insert into public.science_work_translations(work_id,locale,title,slug,summary,description) values($1,$2,'Program project','program-project','Regional scientific project summary.','Detailed scientific description of the regional research project.')", [work, locale]);
  program = (await db.query<{ id: string }>("insert into public.research_programs(coordinator_id,field_id,format,capacity,applications_open_on,application_deadline,starts_on,ends_on,status,created_by) values($1,$2,'online',20,current_date,current_date,current_date,current_date+100,'published',$3) returning id", [scientist, field, manager])).rows[0].id;
  for (const locale of ["ru", "kk"]) await db.query("insert into public.research_program_translations(program_id,locale,title,slug,summary,description,curriculum,eligibility,outcomes) values($1,$2,'Research program','research-program','Regional research program summary.','Detailed description of the regional research program.','Program curriculum description','Program eligibility description','Program outcomes description')", [program, locale]);
  application = (await db.query<{ id: string }>("insert into public.research_program_applications(program_id,locale,full_name,email,motivation,status) values($1,'ru','Private applicant','private@example.kz','Private motivation describing the scientific goals.','accepted') returning id", [program])).rows[0].id;
});
afterAll(async () => { await db?.close(); });
describe("research program project graph", () => {
  it("links existing projects, accepted participants and atomic audit without changing project content", async () => {
    expect(await save()).toBe(1);
    expect(await get()).toMatchObject({ version: 1, workIds: [work], participants: [input().participants[0]], applications: [{ name: "Private applicant" }] });
    expect((await publicList())[0]).toMatchObject({ id: work, members: [{ id: scientist }] });
    const audit = (await db.query<{ new_data: unknown }>("select new_data from public.audit_logs where action='research_program.projects.update'")).rows[0];
    expect(audit.new_data).toEqual({ workIds: [work], participants: input().participants });
    expect(JSON.stringify(audit)).not.toContain("private@example.kz");
    expect((await db.query("select title from public.science_work_translations where locale='ru'")).rows).toEqual([{ title: "Program project" }]);
  });
  it("rejects unauthorized, anonymous, service-role and direct writes", async () => {
    await expect(save({}, user)).rejects.toThrow("forbidden");
    for (const role of ["anon", "service_role"]) await expect(asRole(null, () => db.query("select public.save_research_program_projects($1,$2)", [program, JSON.stringify(input())]), role)).rejects.toThrow("permission denied");
    await expect(asRole(manager, () => db.query("insert into public.research_program_projects values($1,$2)", [program, work]))).rejects.toThrow("permission denied");
    await save();
    expect((await asRole(user, () => db.query("select * from public.research_program_project_participants"))).rows).toEqual([]);
    await expect(asRole(null, () => db.query("select * from public.research_program_project_participants"))).rejects.toThrow("permission denied");
  });
  it("uses optimistic locking and supports removal of projects and assignments", async () => {
    await save();
    await expect(save()).rejects.toThrow("stale_version");
    await expect(save({ expectedVersion: null })).rejects.toThrow("stale_version");
    expect(await save({ expectedVersion: 1, workIds: [], participants: [] })).toBe(2);
    expect(await publicList()).toEqual([]);
    expect((await get()).participants).toEqual([]);
  });
  it("requires accepted/completed applications from the same program and current project membership", async () => {
    await db.query("update public.research_program_applications set status='in_review' where id=$1", [application]);
    await expect(save()).rejects.toThrow("invalid_reference");
    await db.query("update public.research_program_applications set status='completed' where id=$1", [application]);
    await db.query("delete from public.science_work_members where work_id=$1", [work]);
    await expect(save()).rejects.toThrow("invalid_reference");
    await db.query("insert into public.science_work_members values($1,$2,'member')", [work, scientist]);
    await save();
    await db.query("update public.research_program_applications set deleted_at=now() where id=$1", [application]);
    await expect(save({ expectedVersion: 1 })).rejects.toThrow("invalid_reference");
  });
  it("rejects research kinds, deleted projects, duplicates and limits", async () => {
    await db.query("update public.science_works set kind='research' where id=$1", [work]);
    await expect(save()).rejects.toThrow("invalid_reference");
    await db.query("update public.science_works set kind='project',deleted_at=now() where id=$1", [work]);
    await expect(save()).rejects.toThrow("invalid_reference");
    await db.query("update public.science_works set deleted_at=null where id=$1", [work]);
    await expect(save({ workIds: [work, work] })).rejects.toThrow("invalid_input");
    await expect(save({ participants: [...input().participants, ...input().participants] })).rejects.toThrow("duplicate key");
    await expect(save({ workIds: Array(21).fill(work) })).rejects.toThrow("invalid_input");
    await expect(save({ participants: Array(501).fill(input().participants[0]) })).rejects.toThrow("invalid_input");
    expect((await get()).version).toBe(0);
  });
  it("hides private program/project/profile data in anon and manager public reads", async () => {
    await save();
    for (const actor of [null, manager]) {
      expect(JSON.stringify(await publicList(actor))).not.toMatch(/private@example|Private applicant|applicationId|scientistId/);
      expect(await publicList(actor, "en")).toEqual([]);
    }
    for (const state of ["draft", "archived"]) {
      await db.query("update public.science_works set status=$1 where id=$2", [state, work]);
      expect(await publicList(manager)).toEqual([]);
    }
    await db.query("update public.science_works set status='published',published_at=now()+interval '1 day' where id=$1", [work]);
    expect(await publicList()).toEqual([]);
    await db.query("update public.science_works set published_at=now(),deleted_at=now() where id=$1", [work]);
    expect(await publicList(manager)).toEqual([]);
    await db.query("update public.science_works set deleted_at=null where id=$1", [work]);
    await db.query("update public.scientist_profiles set is_public=false where id=$1", [scientist]);
    expect(await publicList(manager)).toEqual([]);
  });
  it("hides withdrawn programs, missing translations and inactive taxonomy", async () => {
    await save();
    await db.query("update public.research_programs set status='draft' where id=$1", [program]);
    expect(await publicList(manager)).toEqual([]);
    await db.query("update public.research_programs set status='published' where id=$1", [program]);
    await db.query("delete from public.science_work_translations where locale='kk'");
    expect(await publicList(manager, "kk")).toEqual([]);
    expect(await publicList()).toHaveLength(1);
    await db.query("update public.scientific_fields set is_active=false where id=$1", [field]);
    expect(await publicList()).toEqual([]);
  });
  it("rolls back link replacement, version and audit when final audit fails", async () => {
    await save();
    await db.exec("create function public.reject_program_audit() returns trigger language plpgsql as $$ begin raise exception 'audit_failed'; end $$; create trigger reject_program_audit before insert on public.audit_logs for each row execute function public.reject_program_audit()");
    try { await expect(save({ expectedVersion: 1, workIds: [], participants: [] })).rejects.toThrow("audit_failed"); }
    finally { await db.exec("drop trigger reject_program_audit on public.audit_logs; drop function public.reject_program_audit()"); }
    expect(await get()).toMatchObject({ version: 1, workIds: [work], participants: input().participants });
  });
  it("searches RU/KK literally and resolves selected projects beyond first 50", async () => {
    await save();
    for (let i=0; i<51; i++) await db.query("insert into public.science_works(kind,field_id,created_by) values('project',$1,$2)", [field, manager]);
    const options = async (query = "", ids: string[] | null = null) => (await asRole(manager, () => db.query<{ value: { id: string }[] }>("select public.research_program_project_options($1,$2) value", [query, ids]))).rows[0].value;
    expect(await options()).toHaveLength(50);
    expect(await options("", [work])).toEqual([expect.objectContaining({ id: work })]);
    expect(await options("%_")).toEqual([]);
    expect(await options("program")).toEqual([expect.objectContaining({ id: work })]);
    await expect(asRole(user, () => db.query("select public.research_program_project_options()"))).rejects.toThrow("forbidden");
  });
  it("resolves reverse links and reuses current output visibility without exposing private files", async () => {
    await save();
    const reverse = async () => (await asRole(null, () => db.query<{ value: { id: string }[] }>("select public.list_public_programs_by_project($1,'ru') value", [work]))).rows[0].value;
    expect(await reverse()).toEqual([expect.objectContaining({ id: program })]);
    const t = { title: "Program research output", description: "A detailed description of scientific program results." };
    const output = (await asRole(manager, () => db.query<{ id: string }>("select public.save_research_output(null,$1) id", [JSON.stringify({ kind: "report", status: "published", versionLabel: "1", license: "CC BY", externalUrl: "", changeNote: "", workIds: [work], files: [], ru: t, kk: t })]))).rows[0].id;
    const outputs = async () => (await asRole(null, () => db.query<{ value: { id: string }[] }>("select public.list_public_research_outputs('ru',$1) value", [work]))).rows[0].value;
    expect(await outputs()).toEqual([expect.objectContaining({ id: output })]);
    await db.query("update public.research_outputs set status='draft' where id=$1", [output]);
    expect(await outputs()).toEqual([]);
    await db.query("update public.research_programs set deleted_at=now() where id=$1", [program]);
    expect(await reverse()).toEqual([]);
    expect(await publicList(manager)).toEqual([]);
  });
  it("does not disclose private team members even to manager public reads", async () => {
    await save();
    const hidden = (await db.query<{ id: string }>("insert into public.scientist_profiles(created_by,is_public,status,verified_at) values($1,false,'verified',now()) returning id", [manager])).rows[0].id;
    await db.query("insert into public.science_work_members values($1,$2,'member')", [work, hidden]);
    expect((await publicList(manager))[0].members).toEqual([expect.objectContaining({ id: scientist })]);
    expect(JSON.stringify(await publicList(manager))).not.toContain(hidden);
  });
  it("upgrades legacy program content and accepted applications without copying projects", async () => {
    const before = (await db.query("select * from public.research_program_translations order by locale")).rows;
    await db.exec(`drop function public.list_public_programs_by_project(uuid,text);
      drop function public.list_public_research_program_projects(uuid,text);
      drop function public.save_research_program_projects(uuid,jsonb);
      drop function public.get_research_program_projects(uuid);
      drop function public.research_program_project_options(text,uuid[]);
      drop table public.research_program_project_participants;
      drop table public.research_program_projects;
      alter table public.research_programs drop column projects_version;`);
    await db.exec(await readFile(new URL("./migrations/029_research_program_projects.sql", import.meta.url), "utf8"));
    expect((await db.query("select * from public.research_program_translations order by locale")).rows).toEqual(before);
    expect(await get()).toMatchObject({ version: 0, workIds: [], participants: [], applications: [{ name: "Private applicant" }] });
    await save(); expect(await publicList()).toHaveLength(1);
  });
});
