import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import { searchPageSchema, type SearchPage } from "../src/lib/search";

let db: PGlite;
const admin = "00000000-0000-4000-a000-000000000001";
const author = "00000000-0000-4000-a000-000000000002";
const reviewer = "00000000-0000-4000-a000-000000000003";
const other = "00000000-0000-4000-a000-000000000004";
let person: string;
let field: string;
let article: string;

async function asRole<T>(user: string | null, action: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try { return await action(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub', '', false)"); }
}
async function publicSearch(query = "", section = "", filters = {}, page = 1, locale = "ru", user: string | null = null): Promise<SearchPage> {
  return asRole(user, async () => searchPageSchema.parse((await db.query<{ result: unknown }>(
    "select public.search_public($1, $2, $3, $4, $5, 12) result", [locale, query, section, JSON.stringify(filters), page])).rows[0].result));
}
async function adminSearch(user: string | null, query: string, section = "") {
  return asRole(user, async () => searchPageSchema.parse((await db.query<{ result: unknown }>(
    "select public.search_admin($1, $2, 1, 20) result", [query, section])).rows[0].result));
}
async function temporary(sql: string, run: () => Promise<void>) {
  await db.exec("begin");
  try { await db.exec(sql); await run(); } finally { await db.exec("rollback"); }
}

beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [user, role] of [[admin, "admin"], [author, "author"], [reviewer, "scientific_reviewer"], [other, "author"]]) {
    await db.query("insert into auth.users(id, email, raw_user_meta_data) values($1, $2, '{}')", [user, `${role}-${user}@example.com`]);
    await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code=$2", [user, role]);
  }
  field = (await db.query<{ id: string }>("insert into public.scientific_fields(slug,name_ru,name_kk) values('water','Вода','Су') returning id")).rows[0].id;
  person = (await db.query<{ id: string }>("insert into public.scientist_profiles(status,verified_at,created_by) values('verified',now(),$1) returning id", [admin])).rows[0].id;
  for (const locale of ["ru", "kk", "en"]) {
    await db.query(`insert into public.scientist_profile_translations(scientist_profile_id,locale,full_name,slug,position,short_bio,biography)
      values($1,$2,'Scientist Aurora','aurora','Professor','Research on water','Hydrology and ecosystems')`, [person, locale]);
  }
  for (let index = 0; index < 133; index++) {
    const status = index < 130 ? "published" : "draft";
    const id = (await db.query<{ id: string }>(`insert into public.articles(author_id,status,published_at,scientific_reviewer_id)
      values($1,$2,now() - interval '1 day',$3) returning id`, [index === 131 ? other : author, status, index === 132 ? reviewer : null])).rows[0].id;
    if (index === 0) article = id;
    await db.query(`insert into public.article_translations(article_id,locale,title,slug,excerpt,body)
      values($1,'ru',$2,$3,'Research excerpt',$4)`, [id, `Материал ${index}`, `material-${index}`, index >= 130 ? "privatequartz" : "Изучение водных ресурсов и гидрологии."]);
  }
  await db.query(`insert into public.article_translations(article_id,locale,title,slug,excerpt,body)
    values($1,'kk','Су ресурстары','water-kk','Ғылыми зерттеу','Су экология зерттеу'),
    ($1,'en','Water systems','water-en','Research article','Studying ecosystems and lakes')`, [article]);
}, 30000);
afterAll(async () => { await db?.close(); });

describe("database search and pagination", () => {
  it("evaluates stable PostgREST now timestamp filters at the database clock without exposing future articles", async () => {
    const visible = () => asRole(null, () => db.query<{ id: string }>("select id from public.articles where id=$1 and status='published' and deleted_at is null and published_at <= 'now'::timestamptz", [article]));
    expect((await visible()).rows.map(row => row.id)).toEqual([article]);
    await temporary(`update public.articles set published_at=now()+interval '1 day' where id='${article}'`, async () => { expect((await visible()).rows).toEqual([]); });
  });
  it("searches the body with Russian stemming, counts all records and goes beyond the former 100-row cap", async () => {
    const first = await publicSearch("водные", "journal");
    expect(first.total).toBe(130); expect(first.items).toHaveLength(12);
    const ids: string[] = [];
    for (let page = 1; page <= 11; page++) ids.push(...(await publicSearch("водные", "journal", {}, page)).items.map(item => item.id));
    expect(ids).toHaveLength(130); expect(new Set(ids).size).toBe(130);
    expect((await publicSearch("водные", "journal", {}, 99)).total).toBe(130);
    expect((await publicSearch("водные", "journal", {}, 99)).items).toEqual([]);
  });
  it("isolates RU, KK and EN translations and supports English stemming", async () => {
    expect((await publicSearch("ecosystem", "journal", {}, 1, "en")).items[0].href).toBe("/en/journal/water-en");
    expect((await publicSearch("экология", "journal", {}, 1, "kk")).items[0].href).toBe("/kk/journal/water-kk");
    expect((await publicSearch("экология", "journal", {}, 1, "ru")).total).toBe(0);
    expect((await publicSearch("", "journal", {}, 1, "en")).total).toBe(1);
  });
  it("never exposes drafts or their counts to public search, including an admin session", async () => {
    expect((await publicSearch("privatequartz", "", {}, 1, "ru", admin)).total).toBe(0);
    const result = await adminSearch(admin, "privatequartz");
    expect(result.total).toBe(3); expect(result.items).toHaveLength(3);
  });
  it("enforces ownership and reviewer assignment in the database", async () => {
    expect((await adminSearch(author, "privatequartz")).total).toBe(2);
    expect((await adminSearch(other, "privatequartz")).total).toBe(1);
    expect((await adminSearch(reviewer, "privatequartz")).total).toBe(1);
    expect((await adminSearch(reviewer, "Aurora", "scientists")).total).toBe(0);
  });
  it("forbids anonymous admin RPC calls and direct access to the internal view", async () => {
    await expect(adminSearch(null, "privatequartz")).rejects.toThrow(/permission denied/);
    for (const user of [null, admin]) await expect(asRole(user, () => db.query("select * from public.search_entries"))).rejects.toThrow(/permission denied/);
    const roles = (await db.query<{ role_id: string }>("delete from public.user_roles where user_id=$1 returning role_id", [other])).rows;
    try {
      await expect(adminSearch(other, "privatequartz")).rejects.toThrow("forbidden");
    } finally {
      for (const role of roles) await db.query("insert into public.user_roles(user_id,role_id) values($1,$2)", [other, role.role_id]);
    }
  });
  it("excludes soft deletes and future publication before counting or pagination", async () => {
    await temporary(`update public.articles set deleted_at=now() where id='${article}'`, async () => {
      expect((await publicSearch("водные", "journal")).total).toBe(129);
      expect((await adminSearch(admin, "водные", "journal")).total).toBe(129);
    });
    await temporary(`update public.articles set published_at=now()+interval '1 day' where id='${article}'`, async () => {
      expect((await publicSearch("", "journal")).total).toBe(129);
    });
  });
  it("updates the stored index after edits and weights titles above body matches", async () => {
    await temporary(`update public.article_translations set title='Водные ресурсы', body='Проверка инвентаризации' where article_id='${article}' and locale='ru'`, async () => {
      expect((await publicSearch("водные", "journal")).items[0].id).toBe(article);
      expect((await publicSearch("инвентаризация", "journal")).total).toBe(1);
    });
    expect((await publicSearch("инвентаризация", "journal")).total).toBe(0);
  });
  it("filters categories and tags at the database before counting", async () => {
    await temporary(`
      insert into public.article_categories(slug,name_ru,name_kk) values('test-category','Test','Test');
      insert into public.article_category_links(article_id,category_id,sort_order) select '${article}',id,0 from public.article_categories where slug='test-category';
      insert into public.article_tags(slug,name_ru,name_kk) values('test-tag','Test','Test');
      insert into public.article_tag_links(article_id,tag_id) select '${article}',id from public.article_tags where slug='test-tag';
    `, async () => {
      expect((await publicSearch("водные", "journal", { category: "test-category", tag: "test-tag" })).total).toBe(1);
      expect((await publicSearch("", "journal", { tag: "missing" })).total).toBe(0);
      expect((await publicSearch("", "journal", { field: "water" })).total).toBe(0);
    });
  });
  it("supports biography search and deduplicates admin results across translations", async () => {
    expect((await publicSearch("Hydrology", "scientists", {}, 1, "en")).total).toBe(1);
    expect((await adminSearch(admin, "Aurora", "scientists")).total).toBe(1);
    expect((await adminSearch(admin, "Aurora", "scientists")).items[0].locale).toBe("ru");
  });
  it("rejects invalid locale, page, size, query length and malformed filters at the RPC boundary", async () => {
    for (const values of [["de", "", 1, 12, {}], ["ru", "x".repeat(121), 1, 12, {}], ["ru", "", 0, 12, {}], ["ru", "", 1, 61, {}], ["ru", "", 1, 12, []]]) {
      await expect(asRole(null, () => db.query("select public.search_public($1,$2,'',$5,$3,$4)", values))).rejects.toThrow("invalid_input");
    }
    expect((await publicSearch("%%% _ ; DROP TABLE articles")).total).toBe(0);
    expect((await publicSearch('"unterminated')).total).toBe(0);
  });
  it("uses GIN indexes for every stored search document", async () => {
    const { rows } = await db.query<{ count: number }>("select count(*)::int count from pg_indexes where schemaname='public' and indexdef like '%USING gin (search_document)%'");
    expect(rows[0].count).toBe(12);
  });
  it("searches projects and research results, and applies stage and field filters", async () => {
    await temporary(`
      insert into public.science_works(id,kind,status,stage,field_id,created_by,published_at)
        values('10000000-0000-4000-a000-000000000001','project','published','completed','${field}','${admin}',now());
      insert into public.science_work_translations(work_id,locale,title,slug,summary,description,results)
        values('10000000-0000-4000-a000-000000000001','en','Regional project','regional-project',
          'A complete scientific project summary','A complete scientific description of regional data','aquifer measurements');
    `, async () => {
      expect((await publicSearch("aquifer", "projects", { field: "water", stage: "completed" }, 1, "en")).total).toBe(1);
      expect((await seoPage(1, 1000, "projects")).items[0].translations).toEqual([{ locale: "en", href: "/en/projects/regional-project" }]);
      expect((await publicSearch("aquifer", "projects", { stage: "active" }, 1, "en")).total).toBe(0);
      expect((await publicSearch("aquifer", "research", {}, 1, "en")).total).toBe(0);
    });
  });
  it("searches original publication titles and hides publications of an unverified scientist", async () => {
    await temporary(`insert into public.publications(scientist_id,title,year,journal,publication_type,status,created_by,published_at)
      values('${person}','Aquifer discovery',2026,'Geosciences','article','published','${admin}',now())`, async () => {
      expect((await publicSearch("aquifer", "publications", {}, 1, "en")).total).toBe(1);
      expect((await seoPage(1, 1000, "publications")).items[0].translations).toHaveLength(3);
      await db.query("update public.scientist_profiles set status='draft' where id=$1", [person]);
      expect((await publicSearch("aquifer", "publications", {}, 1, "en", admin)).total).toBe(0);
      expect((await seoPage(1, 1000, "publications", admin)).items).toEqual([]);
      expect((await adminSearch(admin, "aquifer", "publications")).total).toBe(1);
    });
  });
  it("searches event descriptions, includes cancellations and filters periods and formats", async () => {
    await temporary(`
      insert into public.events(id,status,kind,format,starts_at,ends_at,published_at,created_by)
        values('10000000-0000-4000-a000-000000000002','cancelled','seminar','offline',now()+interval '1 day',now()+interval '2 days',now(),'${admin}');
      insert into public.event_translations(event_id,locale,title,slug,summary,description,organizer)
        values('10000000-0000-4000-a000-000000000002','en','Water seminar','water-seminar',
          'Scientific seminar about water management','Scientific seminar about water management and aquifers','University');
    `, async () => {
      expect((await publicSearch("aquifer", "events", { period: "upcoming", format: "offline", kind: "seminar" }, 1, "en")).total).toBe(1);
      expect((await seoPage(1, 1000, "events")).items[0].translations[0].href).toBe("/en/events/water-seminar");
      expect((await publicSearch("aquifer", "events", { period: "past" }, 1, "en")).total).toBe(0);
      expect((await publicSearch("aquifer", "events", { format: "online" }, 1, "en")).total).toBe(0);
    });
  });
  it("requires a visible translated mentor/coordinator and active field for programs", async () => {
    await temporary(`
      insert into public.mentorship_offers(id,scientist_id,field_id,format,capacity,status,created_by)
        values('10000000-0000-4000-a000-000000000003','${person}','${field}','offline',5,'published','${admin}');
      insert into public.mentorship_offer_translations(offer_id,locale,title,slug,summary,description)
        values('10000000-0000-4000-a000-000000000003','en','Water mentorship','water-mentorship',
          'Learn scientific water measurement methods','Learn scientific water measurement methods and aquifer analysis');
      insert into public.research_programs(id,coordinator_id,field_id,format,capacity,status,created_by,applications_open_on,application_deadline,starts_on,ends_on)
        values('10000000-0000-4000-a000-000000000004','${person}','${field}','offline',5,'published','${admin}',current_date,current_date,current_date,current_date+1);
      insert into public.research_program_translations(program_id,locale,title,slug,summary,description,curriculum,eligibility,outcomes)
        values('10000000-0000-4000-a000-000000000004','en','Water program','water-program',
          'Learn scientific water measurement methods','Learn scientific water measurement methods and aquifer analysis',
          'Learn scientific measurement methods','Young scientists with experience','Scientific measurement datasets');
    `, async () => {
      for (const section of ["mentorship", "research-program"]) {
        expect((await publicSearch("aquifer", section, { format: "offline", field: "water" }, 1, "en")).total).toBe(1);
        expect((await seoPage(1, 1000, section)).items[0].translations).toHaveLength(1);
      }
      await db.query("delete from public.scientist_profile_translations where scientist_profile_id=$1 and locale='en'", [person]);
      expect((await publicSearch("aquifer", "mentorship", {}, 1, "en", admin)).total).toBe(0);
      for (const section of ["mentorship", "research-program"]) expect((await seoPage(1, 1000, section, admin)).items).toEqual([]);
      await db.query("update public.scientific_fields set is_active=false where id=$1", [field]);
      expect((await publicSearch("aquifer", "research-program", {}, 1, "en", admin)).total).toBe(0);
    });
  });
  it("keeps application contacts private and checks managers before matching or counting", async () => {
    await temporary(`
      insert into public.mentorship_offers(id,scientist_id,field_id,format,capacity,status,created_by)
        values('10000000-0000-4000-a000-000000000005','${person}','${field}','offline',5,'published','${admin}');
      insert into public.mentorship_applications(offer_id,locale,full_name,email,motivation)
        values('10000000-0000-4000-a000-000000000005','ru','Applicant Quartz','privatequartz@example.com','A detailed personal motivation for scientific collaboration');
    `, async () => {
      const result = await adminSearch(admin, "privatequartz", "mentorship-applications");
      expect(result.total).toBe(1);
      expect(result.items[0].href).toContain("/admin/programs/mentorship/applications");
      expect(JSON.stringify(result)).not.toContain("privatequartz@example.com");
      expect((await adminSearch(author, "privatequartz", "mentorship-applications")).total).toBe(0);
      expect((await publicSearch("privatequartz", "", {}, 1, "ru", admin)).total).toBe(0);
    });
  });
});


type SeoPage = { total: number; items: Array<{ id: string; section: string; updatedAt: string; translations: Array<{ locale: string; href: string }> }> };
type FeedItem = { id: string; title: string; summary: string; href: string; publishedAt: string };
async function seoPage(page = 1, size = 1000, section = "", user: string | null = null) {
  return asRole(user, async () => (await db.query<{ result: SeoPage }>("select public.seo_public_page($1,$2,$3) result", [page, size, section])).rows[0].result);
}
async function seoFeed(locale = "ru", user: string | null = null, limit = 50) {
  return asRole(user, async () => (await db.query<{ result: FeedItem[] }>("select public.seo_public_feed($1,$2) result", [locale, limit])).rows[0].result);
}

describe("public SEO database projection", () => {
  it("preserves existing published content when applying the SEO migration", async () => {
    const before = (await db.query("select a.status,a.published_at,a.content_version,t.title,t.body,t.slug from public.articles a join public.article_translations t on t.article_id=a.id where a.id=$1 order by t.locale", [article])).rows;
    await temporary("drop function public.seo_public_page(integer,integer,text,uuid); drop function public.seo_public_feed(text,integer)", async () => {
      await db.exec(await readFile(new URL("./migrations/024_public_seo.sql", import.meta.url), "utf8"));
      expect((await db.query("select a.status,a.published_at,a.content_version,t.title,t.body,t.slug from public.articles a join public.article_translations t on t.article_id=a.id where a.id=$1 order by t.locale", [article])).rows).toEqual(before);
      expect((await seoPage()).total).toBe(131);
    });
  });
  it("groups translations by entity, preserves real language slugs and excludes private data", async () => {
    const result = await seoPage();
    expect(result.total).toBe(131);
    expect(result.items.find(item => item.id === article)?.translations).toEqual([{ locale: "en", href: "/en/journal/water-en" }, { locale: "kk", href: "/kk/journal/water-kk" }, { locale: "ru", href: "/ru/journal/material-0" }]);
    expect(result.items.filter(item => item.section === "journal" && item.id !== article).every(item => item.translations.length === 1)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/privatequartz|admin\//);
    expect(result.items[0]).not.toHaveProperty("title");
    expect(result.items[0]).not.toHaveProperty("summary");
  });
  it("covers all 130 articles in stable pages without truncation or duplicate translations", async () => {
    const ids: string[] = [];
    for (let n = 1; n <= 11; n++) { const result = await seoPage(n, 12, "journal"); expect(result.total).toBe(130); ids.push(...result.items.map(item => item.id)); }
    expect(ids).toHaveLength(130); expect(new Set(ids).size).toBe(130);
    expect((await seoPage(12, 12, "journal")).items).toEqual([]);
    expect((await seoPage(1, 1, "journal")).items).toHaveLength(1);
  });
  it("gives anon and admin identical public indexing data", async () => {
    expect(await seoPage(1, 1000, "", admin)).toEqual(await seoPage());
    expect(await seoFeed("ru", admin)).toEqual(await seoFeed());
    expect(await seoFeed()).toHaveLength(50);
    expect(await seoFeed("en")).toHaveLength(1);
    expect((await seoFeed("kk"))[0].href).toBe("/kk/journal/water-kk");
    expect(JSON.stringify(await seoFeed())).not.toMatch(/privatequartz|body|admin\//);
    const raw = (await db.query<{ published_at: Date }>("select published_at from public.articles where id=$1", [article])).rows[0];
    expect(new Date((await seoFeed("en"))[0].publishedAt).toISOString()).toBe(new Date(raw.published_at).toISOString());
  });
  it("filters future, deleted and draft articles before feed limits and sitemap counts", async () => {
    for (const patch of ["status='draft'", "deleted_at=now()", "published_at=now()+interval '1 day'"]) await temporary("update public.articles set " + patch + " where id='" + article + "'", async () => {
      expect(await seoFeed("en", admin)).toEqual([]); expect((await seoPage(1, 1000, "journal", admin)).total).toBe(129);
    });
  });
  it("targets visible records without revealing private ids or counts", async () => {
    const lookup = async (id: string) => asRole(null, async () => (await db.query<{ result: SeoPage }>("select public.seo_public_page(1,1,'journal',$1) result", [id])).rows[0].result);
    expect((await lookup(article)).total).toBe(1);
    const privateId = (await db.query<{ id: string }>("select id from public.articles where status='draft' limit 1")).rows[0].id;
    expect(await lookup(privateId)).toEqual({ total: 0, items: [] });
  });
  it("denies service-role execution and retains a closed source view", async () => {
    await db.exec("set role service_role");
    try {
      await expect(db.query("select public.seo_public_page()" )).rejects.toThrow(/permission denied/);
      await expect(db.query("select public.seo_public_feed('ru')")).rejects.toThrow(/permission denied/);
      await expect(db.query("select * from public.search_entries")).rejects.toThrow(/permission denied/);
    } finally { await db.exec("reset role"); }
  });
  it("rejects invalid sitemap and feed inputs at the database boundary", async () => {
    for (const args of [[0, 1000, ""], [1, 1001, ""], [1, 0, ""], [null, 12, ""], [1, 12, "users"], [1, 12, null]]) await expect(asRole(null, () => db.query("select public.seo_public_page($1,$2,$3)", args))).rejects.toThrow("invalid_input");
    for (const args of [["de", 50], [null, 50], ["ru", 0], ["ru", 101], ["ru", null]]) await expect(asRole(null, () => db.query("select public.seo_public_feed($1,$2)", args))).rejects.toThrow("invalid_input");
  });
});
