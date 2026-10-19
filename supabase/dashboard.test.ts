import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import { dashboardSchema } from "../src/lib/dashboard";

let db: PGlite;
const admin = "00000000-0000-4000-a000-000000000501";
const author = "00000000-0000-4000-a000-000000000502";
const reviewer = "00000000-0000-4000-a000-000000000503";
const member = "00000000-0000-4000-a000-000000000504";
async function run(actor: string | null, sql = "select public.read_admin_dashboard() data", params: unknown[] = [], role = "authenticated") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  try { return await db.query<{ data: unknown }>(sql, params); }
  finally { await db.exec("reset role; reset request.jwt.claim.sub"); }
}
async function dashboard(actor: string) { return dashboardSchema.parse((await run(actor)).rows[0].data); }
beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const id of [admin, author, reviewer, member]) await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${id}@example.org`]);
  for (const [id, role] of [[admin, "super_admin"], [author, "author"], [reviewer, "scientific_reviewer"]])
    await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2", [id, role]);
  for (const [owner, status, assigned, deleted] of [
    [author, "draft", null, false], [author, "draft", null, true], [admin, "draft", null, false],
    [admin, "in_review", reviewer, false], [admin, "in_review", null, false], [author, "in_review", reviewer, true],
  ]) {
    const { rows } = await db.query<{ id: string }>("insert into public.articles(author_id,status,scientific_reviewer_id,deleted_at) values($1,$2,$3,case when $4 then now() end) returning id", [owner, status, assigned, deleted]);
    await db.query("insert into public.article_translations(article_id,locale,title,slug,excerpt,body) values($1::uuid,'ru',$2,$1::text,'Summary','Body')", [rows[0].id, `Private ${owner}`]);
  }
  await db.exec("insert into public.audit_logs(entity_type,action,new_data) values('article','secret-check','{\"email\":\"secret@example.org\",\"body\":\"confidential\"}')");
}, 30000);
afterAll(async () => { await db?.close(); });

it("denies anonymous, service-role and non-admin sessions even when an actor id is supplied", async () => {
  for (const role of ["anon", "service_role"]) await expect(run(admin, undefined, [], role)).rejects.toThrow("permission denied");
  await expect(run(null)).rejects.toThrow("forbidden");
  await expect(run(member)).rejects.toThrow("forbidden");
});
it("limits author counts and titles to owned live drafts and reviewer queues to assignments", async () => {
  const own = await dashboard(author);
  expect(own.metrics).toEqual({ own_drafts: 1 }); expect(own.ownDrafts).toHaveLength(1);
  expect(own.ownDrafts[0].title).toBe(`Private ${author}`); expect(own.reviewQueue).toEqual([]); expect(own.recentActions).toEqual([]);
  const review = await dashboard(reviewer);
  expect(review.metrics).toEqual({ review_articles: 1 }); expect(review.reviewQueue).toHaveLength(1);
  expect(review.ownDrafts).toEqual([]); expect(review.recentActions).toEqual([]);
  expect(JSON.stringify(review)).not.toContain(`Private ${author}`);
});
it("returns real global counts and safe recent action metadata only to permitted staff", async () => {
  const data = await dashboard(admin);
  expect(data.metrics.article_drafts).toBe(2); expect(data.metrics.review_articles).toBe(2);
  expect(data.metrics.pending_scientists).toBe(0); expect(data.metrics.it_requests).toBe(0);
  expect(data.metrics).toHaveProperty("upcoming_events", 0); expect(data.metrics).toHaveProperty("expiring_opportunities", 0);
  expect(data.ownDrafts).toHaveLength(1); expect(data.reviewQueue).toHaveLength(2);
  expect(data.recentActions[0]).toMatchObject({ action: "secret-check" });
  expect(JSON.stringify(data)).not.toMatch(/secret@example|confidential|new_data|old_data/);
});
it("enforces each metric permission independently and immediately respects revoked rights", async () => {
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='user' on conflict do nothing", [member]);
  await db.exec("insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='user' and p.code in ('admin.access','it_requests.manage')");
  try {
    expect((await dashboard(member)).metrics).toEqual({ it_requests: 0 });
    await db.exec("delete from public.role_permissions where role_id=(select id from public.roles where code='user') and permission_id=(select id from public.permissions where code='it_requests.manage')");
    expect((await dashboard(member)).metrics).toEqual({});
  } finally { await db.exec("delete from public.role_permissions where role_id=(select id from public.roles where code='user')"); }
});
it("bounds lists at five, counts all matches, and uses a deterministic translation fallback", async () => {
  for (let i = 0; i < 7; i++) {
    const { rows } = await db.query<{ id: string }>("insert into public.articles(author_id) values($1) returning id", [author]);
    await db.query("insert into public.article_translations(article_id,locale,title,slug,excerpt,body) values($1::uuid,'kk','Қазақша',$1::text,'Summary','Body')", [rows[0].id]);
  }
  const data = await dashboard(author);
  expect(data.metrics.own_drafts).toBe(8); expect(data.ownDrafts).toHaveLength(5); expect(data.ownDrafts[0].title).toBe("Қазақша");
});
it("upgrades a populated 041 without changing existing content or audit", async () => {
  const old = await createMigrationDatabase({ through: 41 });
  try {
    await old.query("insert into auth.users(id,email) values($1,'existing@example.org')", [admin]);
    await old.query("insert into public.articles(author_id) values($1)", [admin]);
    await old.exec("insert into public.audit_logs(entity_type,action) values('existing','preserved')");
    const before = (await old.query("select to_jsonb(a) data from public.articles a")).rows;
    await old.exec(await readFile(new URL("./migrations/042_homepage_dashboard.sql", import.meta.url), "utf8"));
    expect((await old.query("select to_jsonb(a) data from public.articles a")).rows).toEqual(before);
    expect((await old.query("select action from public.audit_logs")).rows).toEqual([{ action: "preserved" }]);
  } finally { await old.close(); }
}, 30000);

it("counts only future published events and open opportunities expiring within seven days", async () => {
  await db.exec("begin");
  try {
    for (const [status, start, published, deleted] of [
      ["published", "1 day", "-1 day", false], ["published", "-1 hour", "-1 day", false],
      ["cancelled", "1 day", "-1 day", false], ["published", "1 day", "1 hour", false], ["published", "1 day", "-1 day", true],
    ]) await db.query("insert into public.events(status,kind,format,starts_at,ends_at,published_at,created_by,deleted_at) values($1,'seminar','offline',now()+$2::interval,now()+$2::interval+interval '2 hours',now()+$3::interval,$4,case when $5 then now() end)", [status, start, published, admin, deleted]);
    for (const [status, deadline, published, deleted] of [
      ["published", "1 day", "-1 day", false], ["published", "7 days", "-1 day", false], ["published", "7 days 1 second", "-1 day", false],
      ["published", "0 seconds", "-1 day", false], ["draft", "1 day", "-1 day", false], ["archived", "1 day", "-1 day", false],
      ["published", "1 day", "1 hour", false], ["published", "1 day", "-1 day", true],
    ]) await db.query("insert into public.opportunities(type,status,source_url,deadline,published_at,deleted_at) values('grant',$1,'https://example.org',now()+$2::interval,now()+$3::interval,case when $4 then now() end)", [status, deadline, published, deleted]);
    const data = await dashboard(admin);
    expect(data.metrics.upcoming_events).toBe(1); expect(data.metrics.expiring_opportunities).toBe(2);
  } finally { await db.exec("rollback"); }
});

it("exposes current result titles only through published translated works regardless of caller session", async () => {
  await db.exec("begin");
  try {
    const field = (await db.query<{ id: string }>("insert into public.scientific_fields(slug,name_ru,name_kk) values('home-science','Наука','Ғылым') returning id")).rows[0].id;
    const work = (await db.query<{ id: string }>("insert into public.science_works(kind,status,field_id,created_by,published_at) values('research','published',$1,$2,now()-interval '1 day') returning id", [field, admin])).rows[0].id;
    await db.query("insert into public.science_work_translations(work_id,locale,title,slug,summary,description) values($1,'ru','Visible research','visible-research',repeat('summary ',4),repeat('description ',4))", [work]);
    const ids: string[] = [];
    for (const status of ["published", "draft", "published"]) {
      const id = (await db.query<{ id: string }>("insert into public.research_outputs(owner_id,kind,status,published_at) values($1,'dataset',$2,now()-interval '1 day') returning id", [admin, status])).rows[0].id;
      ids.push(id);
      await db.query("insert into public.research_output_versions(output_id,version,created_by,snapshot) values($1,1,$2,$3)", [id, admin, JSON.stringify({ ru: { title: `Result ${ids.length}`, description: "Public description" }, ownerEmail: "private@example.org", files: [{ path: "closed/path" }] })]);
      await db.query("insert into public.research_output_works(output_id,work_id) values($1,$2)", [id, work]);
    }
    const read = async (actor: string | null, locale = "ru", limit = 12) => (await run(actor, "select public.list_homepage_results($1,$2) data", [locale, limit], actor ? "authenticated" : "anon")).rows[0].data as { id: string; href: string }[];
    const visible = await read(null);
    expect(visible).toHaveLength(2); expect(visible.map(v => v.id)).not.toContain(ids[1]);
    expect(visible[0].href).toBe("/ru/research/visible-research#results");
    expect(JSON.stringify(visible)).not.toMatch(/private@example|closed\/path|ownerEmail|files/);
    expect(await read(admin)).toEqual(visible); expect(await read(null, "kk")).toEqual([]); expect(await read(null, "ru", 1)).toHaveLength(1);
    await db.query("update public.research_outputs set version=2 where id=$1", [ids[0]]);
    await db.query("insert into public.research_output_versions(output_id,version,created_by,snapshot) values($1,2,$2,'{\"ru\":{\"title\":\"New version\",\"description\":\"Updated\"}}')", [ids[0], admin]);
    expect(JSON.stringify(await read(null))).toContain("New version"); expect(JSON.stringify(await read(null))).not.toContain("Result 1");
    for (const update of ["status='draft'", "status='published',published_at=now()+interval '1 day'", "published_at=now()-interval '1 day',deleted_at=now()"] ) {
      await db.query(`update public.science_works set ${update} where id=$1`, [work]);
      expect(await read(admin)).toEqual([]);
    }
  } finally { await db.exec("rollback"); }
});
it("rejects unsupported result locales and unbounded result limits", async () => {
  for (const [locale, limit] of [["de", 1], ["ru", 0], ["ru", 13], [null, 1], ["ru", null]])
    await expect(run(null, "select public.list_homepage_results($1,$2)", [locale, limit], "anon")).rejects.toThrow("invalid_input");
});
it("returns only live upcoming or ongoing translated events in chronological order", async () => {
  await db.exec("begin");
  try {
    for (const [status, start, published, deleted] of [
      ["published", "2 days", "-1 day", false], ["published", "-1 hour", "-1 day", false],
      ["cancelled", "1 day", "-1 day", false], ["published", "1 day", "1 hour", false],
      ["published", "1 day", "-1 day", true], ["published", "-3 hours", "-1 day", false],
    ]) {
      const { rows } = await db.query<{ id: string }>("insert into public.events(status,kind,format,starts_at,ends_at,published_at,created_by,deleted_at) values($1,'seminar','offline',now()+$2::interval,now()+$2::interval+interval '2 hours',now()+$3::interval,$4,case when $5 then now() end) returning id", [status, start, published, admin, deleted]);
      await db.query("insert into public.event_translations(event_id,locale,title,slug,summary,description,organizer) values($1::uuid,'ru',$2,$1::text,repeat('summary ',4),repeat('description ',4),'Community')", [rows[0].id, `Event ${start}`]);
    }
    const read = async (actor: string | null, locale = "ru", limit = 12) => (await run(actor, "select public.list_homepage_events($1,$2) data", [locale, limit], actor ? "authenticated" : "anon")).rows[0].data as { title: string }[];
    expect((await read(null)).map(event => event.title)).toEqual(["Event -1 hour", "Event 2 days"]);
    expect(await read(admin)).toEqual(await read(null)); expect(await read(null, "kk")).toEqual([]);
    expect(await read(null, "ru", 1)).toHaveLength(1);
  } finally { await db.exec("rollback"); }
  await expect(run(admin, "select public.list_homepage_events('ru',1)", [], "service_role")).rejects.toThrow("permission denied");
  for (const [locale, limit] of [["de", 1], ["ru", 0], ["ru", 13], [null, 1], ["ru", null]])
    await expect(run(null, "select public.list_homepage_events($1,$2)", [locale, limit], "anon")).rejects.toThrow("invalid_input");
});
