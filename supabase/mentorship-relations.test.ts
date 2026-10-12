import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";

let db: PGlite;
const manager = "00000000-0000-4000-a000-000000000001";
const own = "00000000-0000-4000-a000-000000000002";
const other = "00000000-0000-4000-a000-000000000003";
const unconfirmed = "00000000-0000-4000-a000-000000000004";
const anonymous = "00000000-0000-4000-a000-000000000005";
let field: string, mentor: string, offer: string, legacy: string, legacyCompleted: string;
let legacySnapshot: Record<string, unknown>;
async function asRole<T>(actor: string | null, sql: string, values: unknown[] = [], role = actor ? "authenticated" : "anon") {
  await db.exec("savepoint operation");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec(`set role ${role}`);
  try { return await db.query<T>(sql, values); }
  catch (error) { await db.exec("rollback to savepoint operation"); throw error; }
  finally { await db.exec("reset role; release savepoint operation"); }
}
async function application(owner: string | null = own, status = "new", target = offer) {
  return (await db.query<{ id: string }>("insert into public.mentorship_applications(offer_id,user_id,locale,full_name,email,motivation,status,manager_note) values($1,$2,'ru','Private Applicant',$3,'Private applicant motivation for scientific mentorship.',$4,'SECRET INTERNAL NOTE') returning id", [target, owner, `${crypto.randomUUID()}@example.org`, status])).rows[0].id;
}
async function decision(id: string, status: string, kind = "mentor", actor = manager, note = "SECRET INTERNAL NOTE") {
  return asRole(actor, "select public.decide_mentorship_application($1,$2,$3,$4)", [id, status, note, kind]);
}
async function accept(id: string, kind = "mentor") { await decision(id, "in_review"); await decision(id, "accepted", kind); }
async function change(id: string, status: string, actor = manager) { return asRole(actor, "select public.change_mentorship_relation($1,$2)", [id, status]); }
async function withdraw(id: string, actor = own) { return asRole(actor, "select public.withdraw_mentorship_application($1)", [id]); }
async function progress(id: string, actor = own) {
  return (await asRole<{ result: { applicationStatus: string; relation: { id: string; status: string; kind: string } | null; history: Array<{ scope: string; toStatus: string; baseline: boolean }>; historyTotal: number } | null }>(actor, "select public.get_mentorship_progress($1) result", [id])).rows[0].result;
}
beforeAll(async () => {
  db = await createMigrationDatabase({ through: 31 });
  await db.exec("alter table auth.users add column email_confirmed_at timestamptz; alter table auth.users add column is_anonymous boolean default false");
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [id, confirmed, anon] of [[manager, true, false], [own, true, false], [other, true, false], [unconfirmed, false, false], [anonymous, true, true]] as const)
    await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values($1,$2,$3,$4,'{\"role\":\"super_admin\"}')", [id, `${id}@example.org`, confirmed ? "2026-10-12" : null, anon]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='admin'", [manager]);
  field = (await db.query<{ id: string }>("insert into public.scientific_fields(slug,name_ru,name_kk) values('mentorship-relations','Наука','Ғылым') returning id")).rows[0].id;
  mentor = (await db.query<{ id: string }>("insert into public.scientist_profiles(created_by,status,verified_at) values($1,'verified',now()) returning id", [manager])).rows[0].id;
  offer = (await db.query<{ id: string }>("insert into public.mentorship_offers(scientist_id,field_id,created_by,format,capacity,status) values($1,$2,$3,'online',5,'published') returning id", [mentor, field, manager])).rows[0].id;
  legacy = await application(null, "accepted"); legacyCompleted = await application(null, "completed");
  legacySnapshot = (await db.query<Record<string, unknown>>("select * from public.mentorship_applications where id=$1", [legacy])).rows[0];
  await db.exec(await readFile(new URL("./migrations/032_mentorship_relations.sql", import.meta.url), "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("begin");
  offer = (await db.query<{ id: string }>("insert into public.mentorship_offers(scientist_id,field_id,created_by,format,capacity,status) values($1,$2,$3,'online',1,'published') returning id", [mentor, field, manager])).rows[0].id;
});
afterEach(async () => { await db.exec("rollback; reset role"); });
afterAll(async () => { await db?.close(); });

describe("persistent mentorship relationships", () => {
  it("upgrades legacy accepted/completed guests without claiming or changing their data", async () => {
    expect((await db.query("select * from public.mentorship_applications where id=$1", [legacy])).rows[0]).toEqual(legacySnapshot);
    const a = await progress(legacy, manager); expect(a?.relation).toMatchObject({ status: "active", kind: "mentor" });
    expect(a?.history.every(x => x.baseline)).toBe(true);
    expect((await progress(legacyCompleted, manager))?.relation?.status).toBe("completed");
    expect(await progress(legacy)).toBeNull();
  });
  it("denies anonymous/service execution, direct writes and internal helpers", async () => {
    const id = await application();
    for (const sql of ["select public.get_mentorship_progress($1)", "select public.withdraw_mentorship_application($1)", "select public.change_mentorship_relation($1,'paused')", "select public.decide_mentorship_application($1,'accepted','','mentor')"])
      for (const role of ["anon", "service_role"]) await expect(asRole(null, sql, [id], role)).rejects.toThrow("permission denied");
    for (const sql of ["update public.mentorship_relations set status='completed'", "delete from public.mentorship_decisions", "select public.smu_decide_mentorship($1,$2,'accepted','','mentor')", "select public.update_mentorship_application_core($1,$2,'accepted','')", "select public.update_mentorship_application($1,$2,'accepted','')"])
      await expect(asRole(manager, sql, sql.includes("$2") ? [id, manager] : [])).rejects.toThrow("permission denied");
    await expect(asRole(null, "select * from public.mentorship_relations")).rejects.toThrow("permission denied");
  });
  it("checks actual management permissions even when metadata claims super_admin", async () => {
    const id = await application();
    await expect(decision(id, "in_review", "mentor", other)).rejects.toThrow("forbidden");
    await expect(change(id, "paused", other)).rejects.toThrow("forbidden");
    await db.query("delete from public.user_roles where user_id=$1", [manager]);
    await expect(decision(id, "in_review")).rejects.toThrow("forbidden");
    expect((await asRole(other, "select * from public.mentorship_decisions")).rows).toEqual([]);
  });
  it.each(["mentor", "consultant", "project_supervisor", "coauthor", "reviewer", "research_program_mentor"])("creates exactly one %s relation at acceptance", async kind => {
    const id = await application(); await accept(id, kind);
    const first = await progress(id); expect(first?.relation).toMatchObject({ kind, status: "active" });
    expect(first?.history.filter(x => x.scope === "application").map(x => x.toStatus)).toEqual(["accepted", "in_review", "new"]);
    await decision(id, "accepted", "mentor");
    expect(await progress(id)).toEqual(first);
    expect((await db.query("select * from public.mentorship_relations where application_id=$1", [id])).rows).toHaveLength(1);
  });
  it("keeps paused seats occupied and frees capacity only on completion", async () => {
    const id = await application(); const second = await application(other);
    await accept(id); await change(id, "paused"); await decision(second, "in_review");
    await expect(decision(second, "accepted")).rejects.toThrow("capacity_exceeded");
    await change(id, "active"); await change(id, "completed");
    expect(await progress(id)).toMatchObject({ applicationStatus: "completed", relation: { status: "completed" } });
    await decision(second, "accepted");
    await expect(change(id, "active")).rejects.toThrow("invalid_transition");
    await expect(withdraw(id)).rejects.toThrow("invalid_transition");
  });
  it("synchronizes completion through the existing application action", async () => {
    const id = await application(); await accept(id); await change(id, "paused"); await decision(id, "completed");
    expect((await progress(id))?.relation?.status).toBe("completed");
  });
  it.each(["new", "in_review", "accepted", "paused"])("allows verified owners to withdraw from %s idempotently", async state => {
    const id = await application();
    if (state === "in_review") await decision(id, "in_review");
    if (state === "accepted" || state === "paused") await accept(id);
    if (state === "paused") await change(id, "paused");
    await withdraw(id); const result = await progress(id);
    expect(result?.applicationStatus).toBe("withdrawn");
    if (state === "accepted" || state === "paused") expect(result?.relation?.status).toBe("cancelled");
    await withdraw(id); expect(await progress(id)).toEqual(result);
    expect((await db.query("select * from public.audit_logs where entity_id=$1 and action='mentorship.application.withdraw'", [id])).rows).toHaveLength(1);
    await expect(decision(id, "accepted")).rejects.toThrow("invalid_transition");
  });
  it("manager cancellation releases the seat and prevents reopening", async () => {
    const id = await application(); await accept(id); await change(id, "cancelled");
    expect(await progress(id)).toMatchObject({ applicationStatus: "withdrawn", relation: { status: "cancelled" } });
    await expect(change(id, "active")).rejects.toThrow("invalid_transition");
    const second = await application(other); await accept(second);
  });
  it("rejects foreign, unconfirmed, anonymous and unlinked guest withdrawal", async () => {
    const id = await application(); const guest = await application(null);
    await expect(withdraw(id, other)).rejects.toThrow("not_found");
    await expect(withdraw(id, manager)).rejects.toThrow("not_found");
    for (const actor of [unconfirmed, anonymous]) {
      await expect(withdraw(id, actor)).rejects.toThrow("forbidden");
      await expect(progress(id, actor)).rejects.toThrow("forbidden");
    }
    await expect(withdraw(guest)).rejects.toThrow("not_found");
    expect(await progress(id, other)).toBeNull();
  });
  it("preserves the accepted relation when a verified email claim links a guest", async () => {
    const id = await application(null); await accept(id); const relation = (await progress(id, manager))?.relation;
    await db.query("update public.mentorship_applications set email=$1 where id=$2", [`${own}@example.org`, id]);
    await asRole(own, "select public.claim_account_applications()");
    expect((await progress(id))?.relation).toEqual(relation); await withdraw(id);
    expect((await progress(id))?.relation?.status).toBe("cancelled");
  });
  it("hides contacts, notes and actors in both account and manager projections", async () => {
    const id = await application(); await accept(id);
    for (const actor of [own, manager]) {
      const result = await progress(id, actor); expect(JSON.stringify(result)).not.toMatch(/SECRET|Private Applicant|@example|actorId|mentorId|userId/);
    }
    const audit = (await db.query("select new_data,old_data from public.audit_logs where entity_id=$1", [id])).rows;
    expect(JSON.stringify(audit)).not.toMatch(/SECRET|Private Applicant|@example/);
    await db.query("update public.mentorship_applications set deleted_at=now() where id=$1", [id]);
    expect(await progress(id)).toBeNull(); await expect(withdraw(id)).rejects.toThrow("not_found");
  });
  it("rejects archived acceptance and invalid kinds/notes without partial relations", async () => {
    const id = await application(); await decision(id, "in_review");
    await expect(decision(id, "accepted", "invented")).rejects.toThrow("invalid_input");
    await expect(decision(id, "accepted", "mentor", manager, "x".repeat(5001))).rejects.toThrow("check constraint");
    await db.query("update public.mentorship_offers set status='archived' where id=$1", [offer]);
    await expect(decision(id, "accepted")).rejects.toThrow("not_available");
    expect((await progress(id))?.relation).toBeNull();
  });
  it("rolls back acceptance, relation and decisions when audit fails", async () => {
    const id = await application(); await decision(id, "in_review"); const before = await progress(id);
    await db.exec("create function public.reject_mentorship_audit() returns trigger language plpgsql as $$ begin raise exception 'audit_failed'; end $$; create trigger reject_mentorship_audit before insert on public.audit_logs for each row execute function public.reject_mentorship_audit()");
    await expect(decision(id, "accepted")).rejects.toThrow("audit_failed");
    expect(await progress(id)).toEqual(before);
  });
  it("rolls back both withdrawal and relation changes when the final audit fails", async () => {
    const id = await application(); await accept(id); const before = await progress(id);
    await db.exec("create function public.reject_mentorship_audit() returns trigger language plpgsql as $$ begin raise exception 'audit_failed'; end $$; create trigger reject_mentorship_audit before insert on public.audit_logs for each row execute function public.reject_mentorship_audit()");
    await expect(withdraw(id)).rejects.toThrow("audit_failed"); expect(await progress(id)).toEqual(before);
    await expect(change(id, "paused")).rejects.toThrow("audit_failed"); expect(await progress(id)).toEqual(before);
    await expect(change(id, "cancelled")).rejects.toThrow("audit_failed"); expect(await progress(id)).toEqual(before);
  });
  it("limits history to the latest 100 decisions without losing the total", async () => {
    const id = await application();
    await db.query("insert into public.mentorship_decisions(application_id,scope,to_status) select $1,'application','new' from generate_series(1,105)", [id]);
    const result = await progress(id); expect(result?.historyTotal).toBe(106); expect(result?.history).toHaveLength(100);
  });
});
