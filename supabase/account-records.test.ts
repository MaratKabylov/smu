import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";

let db: PGlite;
const own = "00000000-0000-4000-a000-000000000001";
const other = "00000000-0000-4000-a000-000000000002";
const unconfirmed = "00000000-0000-4000-a000-000000000003";
const anonymous = "00000000-0000-4000-a000-000000000004";
let field: string;
let legacySnapshot: Record<string, unknown>;
let upgradedSnapshot: Record<string, unknown>;
type RecordPage = { total: number; page: number; pageSize: number; items: Array<Record<string, unknown>> };
async function asRole<T>(actor: string | null, operation: () => Promise<T>, role = actor ? "authenticated" : "anon") {
  await db.exec("savepoint account_operation");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec(`set role ${role}`);
  try { return await operation(); }
  catch (error) { await db.exec("rollback to savepoint account_operation"); throw error; }
  finally { await db.exec("reset role; release savepoint account_operation"); }
}
async function list(section: string, actor: string | null = own, id: string | null = null, page = 1, locale = "ru") {
  return asRole(actor, async () => (await db.query<{ result: RecordPage }>("select public.list_account_records($1,$2,$3,$4) result", [locale, section, page, id])).rows[0].result);
}
async function claim(actor = own) {
  return asRole(actor, async () => (await db.query<{ count: number }>("select public.claim_account_applications() count")).rows[0].count);
}
async function scientist(actor: string | null = own, creator = other) {
  const id = (await db.query<{ id: string }>("insert into public.scientist_profiles(user_id,created_by,is_public) values($1,$2,false) returning id", [actor, creator])).rows[0].id;
  await db.query("insert into public.scientist_profile_translations(scientist_profile_id,locale,full_name,slug,position,short_bio,biography) values($1,'ru','Own Scientist',$2,'Researcher','Own scientific summary.','Own private scientific biography.')", [id, `person-${id}`]);
  return id;
}
async function article(actor = own) {
  const id = (await db.query<{ id: string }>("insert into public.articles(author_id) values($1) returning id", [actor])).rows[0].id;
  await db.query("insert into public.article_translations(article_id,locale,title,slug,excerpt,body) values($1,'ru','Own Article',$2,'Own excerpt','Own private article body')", [id, `article-${id}`]);
  return id;
}
async function project(actor = own, kind = "project") {
  const id = (await db.query<{ id: string }>("insert into public.science_works(kind,field_id,created_by) values($1,$2,$3) returning id", [kind, field, actor])).rows[0].id;
  await db.query("insert into public.science_work_translations(work_id,locale,title,slug,summary,description) values($1,'ru','Own Project',$2,'A summary of the scientific project.','A detailed description of the private scientific project.')", [id, `project-${id}`]);
  return id;
}
async function applications(email = "own@example.org") {
  const person = await scientist(null);
  const offer = (await db.query<{ id: string }>("insert into public.mentorship_offers(scientist_id,field_id,format,capacity,created_by) values($1,$2,'online',5,$3) returning id", [person, field, other])).rows[0].id;
  await db.query("insert into public.mentorship_offer_translations(offer_id,locale,title,slug,summary,description) values($1,'ru','Mentorship Offer',$2,'A summary of the mentorship offer.','A detailed description of the private mentorship offer.')", [offer, `offer-${offer}`]);
  const program = (await db.query<{ id: string }>("insert into public.research_programs(coordinator_id,field_id,format,capacity,created_by,applications_open_on,application_deadline,starts_on,ends_on) values($1,$2,'online',5,$3,'2026-01-01','2026-12-01','2026-12-02','2026-12-03') returning id", [person, field, other])).rows[0].id;
  await db.query("insert into public.research_program_translations(program_id,locale,title,slug,summary,description,curriculum,eligibility,outcomes) values($1,'ru','Research Program',$2,'A summary of the research program.','A detailed description of the private research program.','Training in modern research methods.','Researchers and graduate students.','Research results and scientific skills.')", [program, `program-${program}`]);
  const mentorApplication = (await db.query<{ id: string }>("insert into public.mentorship_applications(offer_id,locale,full_name,email,motivation,manager_note) values($1,'ru','Own Applicant',$2,'My private motivation for scientific mentorship.','SECRET INTERNAL NOTE') returning id", [offer, email])).rows[0].id;
  const programApplication = (await db.query<{ id: string }>("insert into public.research_program_applications(program_id,locale,full_name,email,motivation,manager_note) values($1,'ru','Own Applicant',$2,'My private motivation for the research program.','SECRET INTERNAL NOTE') returning id", [program, email])).rows[0].id;
  return { offer, program, mentorApplication, programApplication };
}

beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec("alter table auth.users add column email_confirmed_at timestamptz; alter table auth.users add column is_anonymous boolean default false");
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [id, email, confirmed, anon] of [[own, "Own@Example.Org", true, false], [other, "other@example.org", true, false], [unconfirmed, "own@example.org", false, false], [anonymous, "own@example.org", true, true]] as const) {
    await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values($1,$2,$3,$4,'{\"role\":\"super_admin\",\"email_confirmed_at\":\"2026-01-01\"}')", [id, email, confirmed ? "2026-01-01" : null, anon]);
  }
  field = (await db.query<{ id: string }>("insert into public.scientific_fields(slug,name_ru,name_kk) values('account-science','Наука','Ғылым') returning id")).rows[0].id;
  // Recreate the actual previous schema, insert guests, then apply 031. The
  // fresh-schema path is already executed above and in database-types.test.ts.
  await db.exec("drop function public.list_account_records(text,text,integer,uuid); drop function public.claim_account_applications(); drop function public.smu_account_user_id(); alter table public.mentorship_applications drop column user_id; alter table public.research_program_applications drop column user_id; drop index public.science_works_creator_idx");
  const legacyRows = await applications();
  legacySnapshot = (await db.query<Record<string, unknown>>("select * from public.mentorship_applications where id=$1", [legacyRows.mentorApplication])).rows[0];
  await db.exec(await readFile(new URL("./migrations/031_account_records.sql", import.meta.url), "utf8"));
  upgradedSnapshot = (await db.query<Record<string, unknown>>("select * from public.mentorship_applications where id=$1", [legacyRows.mentorApplication])).rows[0];
  await db.exec("truncate public.scientist_profiles cascade");
}, 30000);
beforeEach(async () => { await db.exec("begin"); });
afterEach(async () => { await db.exec("rollback; reset role"); });
afterAll(async () => { await db?.close(); });

describe("account data boundaries", () => {
  it("upgrades existing guests without claiming addresses, changing statuses, notes or consent", async () => {
    expect(upgradedSnapshot).toEqual({ ...legacySnapshot, user_id: null });
    expect((await list("applications")).total).toBe(0);
  });
  it("denies anonymous grants, helper and service role execution", async () => {
    for (const sql of ["select public.list_account_records('ru','articles')", "select public.claim_account_applications()", "select public.smu_account_user_id()"])
      await expect(asRole(null, () => db.query(sql))).rejects.toThrow("permission denied");
    await expect(asRole(own, () => db.query("select public.smu_account_user_id()"))).rejects.toThrow("permission denied");
    await expect(asRole(own, () => db.query("select public.claim_account_applications()"), "service_role")).rejects.toThrow("permission denied");
  });
  it("requires a confirmed non-anonymous Auth identity for every read and claim", async () => {
    for (const actor of [unconfirmed, anonymous, "00000000-0000-4000-a000-000000000099"]) {
      await expect(list("articles", actor)).rejects.toThrow("forbidden");
      await expect(claim(actor)).rejects.toThrow("forbidden");
    }
  });
  it("does not treat the profile creator or administrative roles as the account owner", async () => {
    const mine = await scientist(); await scientist(other, own); const a = await article(); await article(other);
    await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='super_admin'", [own]);
    expect((await list("scientist")).items.map(x => x.id)).toEqual([mine]);
    expect((await list("articles")).items.map(x => x.id)).toEqual([a]);
    expect((await list("scientist", own, mine)).items[0].body).toBe("Own private scientific biography.");
  });
  it("shows creator and participant works once and revokes membership after unlink or soft deletion", async () => {
    const person = await scientist(); const created = await project(); const member = await project(other, "research"); const stranger = await project(other);
    await db.query("insert into public.science_work_members values($1,$2,'member'),($3,$2,'member')", [created, person, member]);
    expect((await list("projects")).total).toBe(2);
    expect((await list("projects", own, member)).items[0]).toMatchObject({ relationship: "member", kind: "research" });
    expect((await list("projects", own, stranger)).total).toBe(0);
    await db.query("update public.scientist_profiles set user_id=null where id=$1", [person]);
    expect((await list("projects")).items.map(x => x.id)).toEqual([created]);
    await db.query("update public.scientist_profiles set user_id=$1,deleted_at=now() where id=$2", [own, person]);
    expect((await list("projects")).total).toBe(1);
  });
  it("never exposes another owner's detail or deleted records", async () => {
    const mine = await article(); const theirs = await article(other);
    expect((await list("articles", own, theirs)).items).toEqual([]);
    await db.query("update public.articles set deleted_at=now() where id=$1", [mine]);
    expect((await list("articles", own, mine)).items).toEqual([]);
    const person = await scientist(); await db.query("update public.scientist_profiles set deleted_at=now() where id=$1", [person]);
    expect((await list("scientist")).items).toEqual([]);
  });
  it("keeps public reads and search closed for account-visible private drafts", async () => {
    const person = await scientist(); await article(); await project();
    expect((await list("scientist")).total).toBe(1);
    const result = await asRole(null, () => db.query("select id from public.scientist_profiles where id=$1", [person])); expect(result.rows).toEqual([]);
    const search = await asRole(null, () => db.query<{ result: { total: number } }>("select public.search_public('ru','','journal') result")); expect(search.rows[0].result.total).toBe(0);
  });
  it("paginates in a stable order without leaking bodies into lists and marks language fallback", async () => {
    for (let i = 0; i < 23; i++) await article();
    const first = await list("articles", own, null, 1, "en"); const second = await list("articles", own, null, 2, "kk");
    expect(first.total).toBe(23); expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map(x => x.id)).size).toBe(23);
    expect(first.items[0]).toMatchObject({ locale: "ru", body: null, content: null });
    expect((await list("articles", own, first.items[0].id as string)).items[0].body).toBe("Own private article body");
    expect((await list("articles", own, null, 3)).items).toEqual([]);
  });
  it("validates locale, section and bounded pagination inside the RPC", async () => {
    for (const [locale, section, page] of [["de", "articles", 1], ["ru", "audit", 1], ["ru", "articles", 0], ["ru", "articles", 100001], [null, "articles", 1], ["ru", null, 1]] as const)
      await expect(asRole(own, () => db.query("select public.list_account_records($1,$2,$3)", [locale, section, page]))).rejects.toThrow("invalid_input");
  });
});

describe("verified guest application claiming", () => {
  it("leaves existing guests unowned until explicit verified claim, links both queues and is idempotent", async () => {
    const rows = await applications();
    expect((await list("applications")).total).toBe(0);
    expect(await claim()).toBe(2); expect(await claim()).toBe(0);
    expect((await list("applications")).total).toBe(2);
    const detail = (await list("applications", own, rows.mentorApplication)).items[0];
    expect(detail).toMatchObject({ relationship: "applicant", kind: "mentorship_application", status: "new", body: "My private motivation for scientific mentorship." });
    const json = JSON.stringify(await list("applications", own, rows.mentorApplication));
    for (const value of ["SECRET INTERNAL NOTE", "own@example.org", "manager_note", "full_name", "consent_at", "user_id"]) expect(json).not.toContain(value);
    const audit = (await db.query<{ action: string; new_data: unknown }>("select action,new_data from public.audit_logs where action='application.account.claim'")).rows;
    expect(audit).toHaveLength(2); expect(audit[0].new_data).toEqual({ linked: true });
  });
  it("ignores JWT email, foreign ownership, deleted guests and other email addresses", async () => {
    const foreign = await applications("other@example.org"); const mine = await applications();
    await db.query("update public.mentorship_applications set user_id=$1 where id=$2", [other, mine.mentorApplication]);
    await db.query("update public.research_program_applications set deleted_at=now() where id=$1", [mine.programApplication]);
    await db.query("select set_config('request.jwt.claim.email','other@example.org',false)");
    expect(await claim()).toBe(0); expect((await list("applications")).total).toBe(0);
    expect(await claim(other)).toBe(2); expect((await list("applications", other)).total).toBe(3);
    expect((await list("applications", own, foreign.mentorApplication)).total).toBe(0);
  });
  it("preserves established ownership after the account email changes and does not reveal deleted parents", async () => {
    const rows = await applications(); await claim();
    await db.query("update auth.users set email='new@example.org' where id=$1", [own]);
    expect((await list("applications")).total).toBe(2);
    await db.query("update auth.users set email='own@example.org' where id=$1", [other]); expect(await claim(other)).toBe(0);
    await db.query("update public.mentorship_offers set deleted_at=now() where id=$1", [rows.offer]);
    expect((await list("applications")).total).toBe(1);
    expect((await list("applications", own, rows.mentorApplication)).items).toEqual([]);
  });
  it("prevents account deletion from turning claimed applications into guests for a reused email", async () => {
    await applications(); await claim();
    await db.exec("savepoint delete_account");
    await expect(db.query("delete from auth.users where id=$1", [own])).rejects.toThrow("foreign key constraint");
    await db.exec("rollback to savepoint delete_account; release savepoint delete_account");
    expect((await list("applications")).total).toBe(2);
  });
  it("rolls back ownership in both queues if the second audit fails", async () => {
    await applications();
    await db.exec("create function public.reject_claim_audit() returns trigger language plpgsql as $$ begin if new.entity_type='research_program_application' then raise exception 'audit_failed'; end if; return new; end $$; create trigger reject_claim_audit before insert on public.audit_logs for each row execute function public.reject_claim_audit()");
    await expect(claim()).rejects.toThrow("audit_failed");
    expect((await db.query("select id from public.mentorship_applications where user_id is not null")).rows).toEqual([]);
    expect((await db.query("select id from public.research_program_applications where user_id is not null")).rows).toEqual([]);
    expect((await db.query("select id from public.audit_logs where action='application.account.claim'")).rows).toEqual([]);
  });
  it("does not grant direct writes or full applicant reads to ordinary users", async () => {
    await applications(); await claim();
    expect((await asRole(own, () => db.query("select manager_note from public.mentorship_applications"))).rows).toEqual([]);
    await expect(asRole(own, () => db.query("update public.mentorship_applications set user_id=$1", [other]))).rejects.toThrow("permission denied");
    await expect(asRole(own, () => db.query("update public.research_program_applications set status='accepted'"))).rejects.toThrow("permission denied");
  });
});
