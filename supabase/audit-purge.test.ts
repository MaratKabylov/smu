import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";

let db: PGlite;
const owner = "00000000-0000-4000-a000-000000000301";
const admin = "00000000-0000-4000-a000-000000000302";
const member = "00000000-0000-4000-a000-000000000303";
const token = "2026-10-19T00:00:00.123456Z";
async function run(actor: string | null, sql: string, params: unknown[] = [], role = "authenticated") {
  await db.exec(`set role ${role}`);
  if (actor) await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
  try { return await db.query<Record<string, unknown>>(sql, params); }
  finally { await db.exec("reset role; reset request.jwt.claim.sub"); }
}
async function article(deleted = true) {
  const { rows } = await db.query<{ id: string }>("insert into public.articles(author_id,deleted_at) values($1,$2) returning id", [owner, deleted ? token : null]);
  const id = rows[0].id;
  for (const locale of ["ru", "kk", "en"]) await db.query(`insert into public.article_translations(article_id,locale,title,slug,excerpt,body)
    values($1,$2,'Private draft',$3,'Private excerpt','Private body')`, [id, locale, `purge-${id}`]);
  return id;
}
async function scientist() {
  const { rows } = await db.query<{ id: string }>("insert into public.scientist_profiles(created_by,deleted_at) values($1,$2) returning id", [owner, token]);
  const id = rows[0].id;
  await db.query(`insert into public.scientist_profile_translations(scientist_profile_id,locale,full_name,slug,position,short_bio,biography)
    values($1,'ru','Private scientist',$2,'Position','Bio','Biography')`, [id, `scientist-${id}`]);
  return id;
}
const purge = (actor: string, kind: string, id: string, expected = token) =>
  run(actor, "select public.purge_deleted_editorial_record($1,$2,$3)", [kind, id, expected]);

beforeAll(async () => {
  // Exercise upgrading a populated preceding schema, not just fresh creation.
  db = await createMigrationDatabase({ through: 39 });
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [id, role] of [[owner, "super_admin"], [admin, "admin"], [member, "user"]]) {
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'private@example.org','{}')", [id]);
    await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2 on conflict do nothing", [id, role]);
  }
  await db.query("insert into public.audit_logs(user_id,entity_type,action,old_data) values($1,'article','historical','{\"email\":\"private@example.org\"}')", [owner]);
  await db.exec(await readFile(new URL("./migrations/040_audit_and_editorial_purge.sql", import.meta.url), "utf8"));
  expect((await db.query("select id from public.audit_logs where action='historical'")).rows).toHaveLength(1);
}, 30000);
beforeEach(async () => {
  await db.exec("delete from public.articles; delete from public.scientist_profiles; delete from public.audit_logs; delete from public.slug_redirects;");
});
afterAll(async () => { await db?.close(); });

it("closes raw audit snapshots and mutation shortcuts to every API role", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    for (const sql of ["select * from public.audit_logs", "delete from public.audit_logs", "update public.audit_logs set action='forged'", "truncate public.audit_logs"])
      await expect(run(owner, sql, [], role)).rejects.toThrow("permission denied");
    for (const table of ["articles", "scientist_profiles"])
      await expect(run(owner, `delete from public.${table}`, [], role)).rejects.toThrow("permission denied");
    if (role !== "authenticated") {
      await expect(run(owner, "select * from public.list_audit_records()", [], role)).rejects.toThrow("permission denied");
      await expect(run(owner, "select public.purge_deleted_editorial_record('article',$1,$2)", [owner, token], role)).rejects.toThrow("permission denied");
    }
  }
  await expect(run(owner, "select public.assert_editorial_purge_unreferenced('public.articles',$1,'{}')", [owner])).rejects.toThrow("permission denied");
});

it("requires both admin access and audit.read and returns metadata without snapshots", async () => {
  await db.query("insert into public.audit_logs(user_id,entity_type,entity_id,action,old_data,new_data) values($1,'article',$2,'changed','{\"email\":\"secret@example.org\"}','{\"body\":\"private draft\"}')", [owner, member]);
  const rows = (await run(admin, "select * from public.list_audit_records()")).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toEqual(expect.objectContaining({ user_id: owner, entity_id: member, action: "changed" }));
  expect(Object.keys(rows[0]).sort()).toEqual(["action", "created_at", "entity_id", "entity_type", "id", "user_id"]);
  expect(JSON.stringify(rows)).not.toContain("secret@example.org");
  await expect(run(member, "select * from public.list_audit_records()")).rejects.toThrow("forbidden");
  await expect(run(null, "select * from public.list_audit_records()")).rejects.toThrow("forbidden");
  await db.exec(`insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r,public.permissions p where r.code='user' and p.code='audit.read'`);
  try { await expect(run(member, "select * from public.list_audit_records()")).rejects.toThrow("forbidden"); }
  finally { await db.exec("delete from public.role_permissions where role_id=(select id from public.roles where code='user')"); }
});

it("filters exact action/type, actor, entity and inclusive UTC dates with stable paging", async () => {
  await db.query(`insert into public.audit_logs(user_id,entity_type,entity_id,action,created_at)
    select $1,'article',$2,'changed','2026-10-19T23:59:59.999999Z' from generate_series(1,52)`, [owner, member]);
  await db.query("insert into public.audit_logs(user_id,entity_type,entity_id,action,created_at) values($1,'scientist',$2,'other','2026-10-20T00:00:00Z')", [admin, member]);
  const sql = "select * from public.list_audit_records('article','changed',$1,$2,'2026-10-19','2026-10-19',$3)";
  const first = (await run(admin, sql, [owner, member, 1])).rows;
  const second = (await run(admin, sql, [owner, member, 2])).rows;
  expect(first).toHaveLength(51); expect(second).toHaveLength(2);
  expect(first[50].id).toBe(second[0].id);
  expect(first.slice(0, 50).some(row => row.id === second[0].id)).toBe(false);
  expect((await run(admin, "select * from public.list_audit_records('', '', $1)", [admin])).rows).toHaveLength(1);
  expect((await run(admin, sql, [member, member, 1])).rows).toHaveLength(0);
  for (const query of ["select * from public.list_audit_records(p_page=>0)", "select * from public.list_audit_records(p_entity_type=>null)", "select * from public.list_audit_records(p_from=>'2026-10-20',p_until=>'2026-10-19')"])
    await expect(run(admin, query)).rejects.toThrow("invalid_input");
});

it("requires a current super-admin role and an exact deleted-state token", async () => {
  const id = await article();
  for (const actor of [admin, member]) await expect(purge(actor, "article", id)).rejects.toThrow("forbidden");
  await expect(purge(owner, "article", id, "2026-10-19T00:00:00.123455Z")).rejects.toThrow("stale_version");
  await expect(purge(owner, "article", await article(false))).rejects.toThrow("stale_version");
  await expect(purge(owner, "media", id)).rejects.toThrow("invalid_input");
  expect((await db.query("select id from public.articles where id=$1", [id])).rows).toHaveLength(1);
  expect((await db.query("select id from public.audit_logs where action='purged'")).rows).toHaveLength(0);
});

it("purges owned article details/revisions/reviews, retains audit and reserves all current URLs", async () => {
  const id = await article();
  await db.query("insert into public.article_revisions(article_id,revision_number,content_version,reason,title_ru,title_kk,snapshot) values($1,1,1,'manual','RU','KK','{}')", [id]);
  await db.query("insert into public.article_reviews(article_id,content_version,reviewer_id,decision,comment) values($1,1,$2,'approved','Review')", [id, owner]);
  await db.query("insert into public.audit_logs(entity_type,entity_id,action) values('article',$1,'created')", [id]);
  await purge(owner, "article", id);
  for (const table of ["articles", "article_translations", "article_revisions", "article_reviews"])
    expect((await db.query(`select * from public.${table}`)).rows).toHaveLength(0);
  expect((await db.query("select * from public.slug_redirects where entity_id=$1", [id])).rows).toHaveLength(3);
  expect((await db.query("select action from public.audit_logs where entity_id=$1 order by action", [id])).rows).toEqual([{ action: "created" }, { action: "purged" }]);
  await expect(db.query("select public.preserve_smu_slug('article',$1,'ru',null,$2,false)", [member, `purge-${id}`])).rejects.toThrow("slug_reserved");
  await expect(purge(owner, "article", id)).rejects.toThrow("not_found");
});

it("refuses to detach external scientist references, and purges an unreferenced profile", async () => {
  const id = await scientist();
  const linked = await article();
  await db.query("insert into public.article_scientists(article_id,scientist_id,relation_type,sort_order) values($1,$2,'expert',0)", [linked, id]);
  await expect(purge(owner, "scientist", id)).rejects.toThrow("record_in_use");
  expect((await db.query("select * from public.article_scientists")).rows).toHaveLength(1);
  expect((await db.query("select * from public.slug_redirects")).rows).toHaveLength(0);
  await db.query("delete from public.article_scientists where scientist_id=$1", [id]);
  await purge(owner, "scientist", id);
  expect((await db.query("select * from public.scientist_profiles where id=$1", [id])).rows).toHaveLength(0);
  expect((await db.query("select * from public.scientist_profile_translations where scientist_profile_id=$1", [id])).rows).toHaveLength(0);
  expect((await db.query("select * from public.slug_redirects where entity_id=$1", [id])).rows).toHaveLength(1);
});

it("blocks future cascade relationships and rolls back all deletion when audit fails", async () => {
  const id = await article();
  await db.exec("create table public.future_article_reference(article_id uuid references public.articles(id) on delete cascade)");
  try {
    await db.query("insert into public.future_article_reference values($1)", [id]);
    await expect(purge(owner, "article", id)).rejects.toThrow("record_in_use");
  } finally { await db.exec("drop table public.future_article_reference"); }
  await db.exec("create function public.reject_purge_audit() returns trigger language plpgsql as $$ begin if new.action='purged' then raise exception 'audit_failed'; end if; return new; end $$; create trigger reject_purge_audit before insert on public.audit_logs for each row execute function public.reject_purge_audit()");
  try {
    await expect(purge(owner, "article", id)).rejects.toThrow("audit_failed");
    expect((await db.query("select * from public.article_translations where article_id=$1", [id])).rows).toHaveLength(3);
    expect((await db.query("select * from public.articles where id=$1", [id])).rows).toHaveLength(1);
    expect((await db.query("select * from public.slug_redirects where entity_id=$1", [id])).rows).toHaveLength(0);
  } finally { await db.exec("drop trigger reject_purge_audit on public.audit_logs; drop function public.reject_purge_audit()"); }
});
