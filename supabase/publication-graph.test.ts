import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
let db: PGlite;
const manager = "00000000-0000-4000-a000-000000000031";
const user = "00000000-0000-4000-a000-000000000032";
const ids = [1, 2, 3].map(n => "00000000-0000-4000-b000-" + String(n).padStart(12, "0"));
let research: string, project: string;
async function asRole<T>(actor: string | null, action: () => Promise<T>, role = actor ? "authenticated" : "anon") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return await action(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
const input = (patch: Record<string, unknown> = {}) => ({ scientistId: ids[0], title: "Regional scientific publication", year: 2026, journal: "Regional Science", doi: "10.1234/region", url: "https://example.kz/paper", publicationType: "article", status: "published", coauthors: [{ scientistId: ids[1], name: "", affiliation: "" }, { scientistId: null, name: "External Author", affiliation: "International Institute" }], workIds: [research, project], ...patch });
async function save(value = input(), id: string | null = null, actor = manager) {
  return asRole(actor, async () => (await db.query<{ id: string }>("select public.save_publication($1,$2) id", [id, JSON.stringify(value)])).rows[0].id);
}
async function stamp(id: string) { return (await db.query<{ value: string }>("select updated_at::text value from public.publications where id=$1", [id])).rows[0].value; }
type Graph = { id: string; authors: { scientistId: string | null; name: string; href: string | null; affiliation: string }[]; works: { id: string; kind: string; href: string }[] };
async function publicList(actor: string | null, id: string | null, scientist: string | null = null, locale = "ru") {
  return (await asRole(actor, () => db.query<Graph>("select * from public.list_public_publications($1,$2,$3)", [locale, id, scientist]))).rows;
}
beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [id, role] of [[manager, "scientist_manager"], [user, "user"]]) {
    await db.query("insert into auth.users values($1,$2,'{}')", [id, id + "@example.kz"]);
    await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2", [id, role]);
  }
}, 30000);
beforeEach(async () => {
  await db.exec("truncate public.scientist_profiles,public.scientific_fields,public.audit_logs cascade");
  for (const [index, id] of ids.entries()) {
    await db.query("insert into public.scientist_profiles(id,created_by,status,verification_status,is_public,verified_at) values($1,$2,'verified','verified',true,now())", [id, manager]);
    for (const locale of ["ru", "kk", "en"]) await db.query("insert into public.scientist_profile_translations(scientist_profile_id,locale,full_name,slug,position,short_bio,biography) values($1,$2,$3,$4,'Researcher','Regional scientist biography.','Detailed biography of a regional scientist and their scientific work.')", [id, locale, "Scientist " + index, "scientist-" + index]);
  }
  const field = (await db.query<{ id: string }>("insert into public.scientific_fields(slug,name_ru,name_kk) values('science','Наука','Ғылым') returning id")).rows[0].id;
  const works: string[] = [];
  for (const kind of ["research", "project"]) {
    const id = (await db.query<{ id: string }>("insert into public.science_works(kind,status,published_at,field_id,created_by) values($1,'published',now(),$2,$3) returning id", [kind, field, manager])).rows[0].id;
    works.push(id);
    for (const locale of ["ru", "kk", "en"]) await db.query("insert into public.science_work_translations(work_id,locale,title,slug,summary,description) values($1,$2,$3,$3,'A regional scientific work summary.','Detailed description of regional scientific work and experimental results.')", [id, locale, kind + "-work"]);
  }
  [research, project] = works;
});
afterAll(async () => { await db?.close(); });
describe("scientific publication graph", () => {
  it("saves ordered linked/external coauthors, research/project links and audit atomically", async () => {
    const id = await save();
    const [row] = await publicList(null, id);
    expect(row.authors.map(a => a.name)).toEqual(["Scientist 0", "Scientist 1", "External Author"]);
    expect(row.authors[2]).toEqual({ scientistId: null, name: "External Author", href: null, affiliation: "International Institute" });
    expect(new Set(row.works.map(w => w.id))).toEqual(new Set([research, project]));
    expect(row.works.find(w => w.id === research)?.href).toBe("/ru/research/research-work");
    expect((await db.query<{ new_data: Record<string, unknown> }>("select new_data from public.audit_logs where entity_id=$1", [id])).rows[0].new_data).toMatchObject({ coauthors: input().coauthors, workIds: [research, project] });
  });
  it("retains the single-scientist bibliography contract for existing callers", async () => {
    const legacy = input(); delete (legacy as Partial<typeof legacy>).coauthors; delete (legacy as Partial<typeof legacy>).workIds;
    const id = await save(legacy);
    expect((await publicList(null, id))[0]).toMatchObject({ authors: [{ scientistId: ids[0] }], works: [] });
  });
  it("requires session permissions and denies direct writes and service-role RPCs", async () => {
    await expect(save(input(), null, user)).rejects.toThrow("forbidden");
    for (const [actor, role] of [[null, "anon"], [manager, "service_role"]] as const) await expect(asRole(actor, () => db.query("select public.save_publication(null,$1)", [JSON.stringify(input())]), role)).rejects.toThrow("permission denied");
    const id = await save();
    for (const table of ["publication_coauthors", "publication_works"]) await expect(asRole(manager, () => db.query("delete from public." + table + " where publication_id=$1", [id]))).rejects.toThrow(/permission denied|row-level security/);
  });
  it("rejects duplicates, excess links, ambiguous authors and non-public references at the RPC boundary", async () => {
    for (const patch of [
      { coauthors: [{ scientistId: ids[0] }] }, { coauthors: [{ scientistId: ids[1] }, { scientistId: ids[1] }] },
      { coauthors: [{ scientistId: ids[1], name: "Override" }] }, { coauthors: [{ scientistId: null, name: "x" }] },
      { coauthors: [{ scientistId: null, name: "Valid Author", accountEmail: "secret@example.kz" }] },
      { coauthors: Array.from({ length: 31 }, () => ({ scientistId: null, name: "Author" })) },
      { coauthors: {} }, { workIds: [research, research] }, { workIds: [42] }, { workIds: [user] },
    ]) await expect(save(input(patch))).rejects.toThrow(/invalid_input|invalid_reference/);
    await db.query("update public.scientist_profiles set is_public=false where id=$1", [ids[1]]);
    await expect(save()).rejects.toThrow("invalid_reference");
    await db.query("update public.scientist_profiles set is_public=true where id=$1", [ids[1]]);
    await db.query("update public.science_works set status='draft' where id=$1", [research]);
    await expect(save()).rejects.toThrow("invalid_reference");
    expect((await db.query("select id from public.publications")).rows).toEqual([]);
  });
  it("replaces/removes links with optimistic locking and preserves the publication date", async () => {
    const id = await save(); const expected = await stamp(id);
    const publishedAt = (await db.query("select published_at::text value from public.publications where id=$1", [id])).rows;
    await save(input({ expectedUpdatedAt: expected, coauthors: [], workIds: [] }), id);
    expect((await publicList(null, id))[0]).toMatchObject({ authors: [{ scientistId: ids[0] }], works: [] });
    expect((await db.query("select published_at::text value from public.publications where id=$1", [id])).rows).toEqual(publishedAt);
    await expect(save(input({ expectedUpdatedAt: expected }), id)).rejects.toThrow("stale_version");
    await expect(save(input(), id)).rejects.toThrow("stale_version");
    expect((await db.query<{ old_data: Record<string, unknown> }>("select old_data from public.audit_logs where entity_id=$1 and old_data is not null", [id])).rows[0].old_data).toMatchObject({ workIds: expect.arrayContaining([research, project]), coauthors: expect.arrayContaining([expect.objectContaining({ scientist_id: ids[1] })]) });
  });
  it("rolls back bibliography, relations and audit if the final audit fails", async () => {
    const id = await save(); const expected = await stamp(id); const before = await publicList(null, id);
    await db.exec("create function public.fail_publication_audit() returns trigger language plpgsql as $$ begin if new.entity_type='publication' then raise exception 'audit_failed'; end if; return new; end $$; create trigger fail_publication_audit before insert on public.audit_logs for each row execute function public.fail_publication_audit()");
    try {
      await expect(save(input({ expectedUpdatedAt: expected, title: "Must roll back", coauthors: [], workIds: [] }), id)).rejects.toThrow("audit_failed");
      await expect(save()).rejects.toThrow("audit_failed");
      expect(await publicList(null, id)).toEqual(before); expect(await stamp(id)).toBe(expected);
      expect((await db.query("select id from public.publications")).rows).toHaveLength(1);
      expect((await db.query("select id from public.audit_logs where entity_type='publication'")).rows).toHaveLength(1);
    } finally { await db.exec("drop trigger fail_publication_audit on public.audit_logs; drop function public.fail_publication_audit()"); }
  });
  it("hides private coauthors through public RPCs even in a manager session", async () => {
    const id = await save(); await db.query("update public.scientist_profiles set is_public=false where id=$1", [ids[1]]);
    for (const actor of [null, manager]) {
      expect((await publicList(actor, id))[0].authors.map(a => a.name)).toEqual(["Scientist 0", "External Author"]);
      expect(await publicList(actor, null, ids[1])).toEqual([]);
    }
    expect((await asRole(null, () => db.query("select name,scientist_id from public.publication_coauthors"))).rows).toEqual([{ name: "External Author", scientist_id: null }]);
    expect((await asRole(manager, () => db.query("select name from public.publication_coauthors"))).rows).toHaveLength(2);
    await db.query("update public.scientist_profiles set is_public=false where id=$1", [ids[0]]);
    for (const actor of [null, manager]) expect(await publicList(actor, id)).toEqual([]);
    expect((await asRole(null, () => db.query("select * from public.publication_coauthors"))).rows).toEqual([]);
    expect((await asRole(null, () => db.query("select * from public.publication_works"))).rows).toEqual([]);
  });
  it("filters unavailable translations, future/draft/deleted works and deleted publications", async () => {
    const id = await save();
    await db.query("delete from public.scientist_profile_translations where scientist_profile_id=$1 and locale='en'", [ids[1]]);
    await db.query("delete from public.science_work_translations where work_id=$1 and locale='en'", [project]);
    expect((await publicList(manager, id, null, "en"))[0].authors.map(a => a.name)).toEqual(["Scientist 0", "External Author"]);
    expect((await publicList(manager, id, null, "en"))[0].works.map(w => w.id)).toEqual([research]);
    for (const clause of ["status='draft'", "status='published',published_at=now()+interval '1 day'", "published_at=now(),deleted_at=now()"]) {
      await db.query("update public.science_works set " + clause + " where id=$1", [research]);
      expect((await publicList(manager, id))[0].works.map(w => w.id)).toEqual([project]);
      expect((await asRole(manager, () => db.query("select * from public.list_public_work_publications('ru',$1)", [research]))).rows).toEqual([]);
    }
    await db.query("update public.publications set deleted_at=now() where id=$1", [id]);
    expect(await publicList(manager, id)).toEqual([]);
  });
  it("shows reverse links on coauthor profiles and works beyond the first 100 unrelated publications", async () => {
    for (let n = 0; n < 101; n++) await save(input({ title: "Earlier " + n, year: 2200, coauthors: [], workIds: [] }));
    const id = await save();
    expect((await publicList(null, null, ids[1])).map(p => p.id)).toEqual([id]);
    expect((await asRole(null, () => db.query<Graph>("select * from public.list_public_work_publications('ru',$1)", [research]))).rows.map(p => p.id)).toEqual([id]);
  });
  it("transfers and deduplicates coauthors during scientist merge, preserving external authors and work links", async () => {
    const shared = await save(input({ scientistId: ids[2], coauthors: [{ scientistId: ids[0] }, { scientistId: ids[1] }, { scientistId: null, name: "External Author" }] }));
    const primary = await save(input({ coauthors: [{ scientistId: ids[1] }] }));
    const sourceOnly = await save(input({ scientistId: ids[2], coauthors: [{ scientistId: ids[0] }] }));
    const expected = await stamp(shared);
    await asRole(manager, () => db.query("select public.merge_scientists($1,$2,1,1,'Confirmed duplicate scientific identity')", [ids[0], ids[1]]));
    expect((await db.query("select scientist_id from public.publication_coauthors where publication_id=$1 order by sort_order", [shared])).rows).toEqual([{ scientist_id: ids[1] }, { scientist_id: null }]);
    expect((await db.query("select scientist_id from public.publication_coauthors where publication_id=$1", [sourceOnly])).rows).toEqual([{ scientist_id: ids[1] }]);
    expect((await db.query("select scientist_id from public.publications where id=$1", [primary])).rows).toEqual([{ scientist_id: ids[1] }]);
    expect((await db.query("select * from public.publication_coauthors where publication_id=$1", [primary])).rows).toEqual([]);
    expect((await db.query("select * from public.publication_works where publication_id=$1", [shared])).rows).toHaveLength(2);
    expect(await stamp(shared)).not.toBe(expected);
    expect((await db.query<{ source_snapshot: Record<string, unknown> }>("select source_snapshot from public.scientist_merges")).rows[0].source_snapshot.publicationCoauthors).toEqual(expect.arrayContaining([expect.objectContaining({ publication_id: shared, scientist_id: ids[0] })]));
  });
  it("rolls back coauthor merge when its final audit fails", async () => {
    const id = await save(input({ scientistId: ids[2], coauthors: [{ scientistId: ids[0] }] })); const expected = await stamp(id);
    await db.exec("create function public.fail_merge_graph() returns trigger language plpgsql as $$ begin if new.action='scientist.merge' then raise exception 'merge_audit_failed'; end if; return new; end $$; create trigger fail_merge_graph before insert on public.audit_logs for each row execute function public.fail_merge_graph()");
    try {
      await expect(asRole(manager, () => db.query("select public.merge_scientists($1,$2,1,1,'Confirmed duplicate scientific identity')", [ids[0], ids[1]]))).rejects.toThrow("merge_audit_failed");
      expect((await db.query("select scientist_id from public.publication_coauthors where publication_id=$1", [id])).rows).toEqual([{ scientist_id: ids[0] }]);
      expect(await stamp(id)).toBe(expected); expect((await db.query("select id from public.scientist_merges")).rows).toEqual([]);
    } finally { await db.exec("drop trigger fail_merge_graph on public.audit_logs; drop function public.fail_merge_graph()"); }
  });
});
