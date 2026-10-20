import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrations, createMigrationDatabase } from "../scripts/database-schema.mjs";

const owner = "00000000-0000-4000-a000-000000000801";
const article = "00000000-0000-4000-a000-000000000802";
const scientist = "00000000-0000-4000-a000-000000000803";
const event = "00000000-0000-4000-a000-000000000804";
const publishedAt = "2026-01-15T08:30:00.000Z";
const verifiedAt = "2026-01-14T07:20:00.000Z";
const legacyBody = "  Legacy first paragraph.\n\nSecond paragraph with <script>literal text</script>.\n  ";

let db: PGlite | undefined;

afterEach(async () => {
  await db?.close();
  db = undefined;
});

async function seed(database: PGlite) {
  await database.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
}

describe("migration readiness", () => {
  it("applies the complete chain to an empty database", async () => {
    db = await createMigrationDatabase();
    await seed(db);

    const { rows } = await db.query<{
      dashboard: string | null;
      pages: string | null;
      sections: string | null;
      page_count: number;
      section_count: number;
      super_admin_permissions: number;
    }>(`
      select
        to_regprocedure('public.read_admin_dashboard()')::text dashboard,
        to_regclass('public.content_pages')::text pages,
        to_regclass('public.homepage_sections')::text sections,
        (select count(*)::int from public.content_pages) page_count,
        (select count(*)::int from public.homepage_sections) section_count,
        (select count(*)::int from public.role_permissions rp
          join public.roles r on r.id=rp.role_id where r.code='super_admin') super_admin_permissions
    `);

    expect(rows[0]).toMatchObject({
      dashboard: "read_admin_dashboard()",
      pages: "content_pages",
      sections: "homepage_sections",
      page_count: 9,
      section_count: 11,
    });
    expect(rows[0].super_admin_permissions).toBeGreaterThan(0);
  }, 30_000);

  it("upgrades a populated 008 database through 042 without losing legacy content", async () => {
    db = await createMigrationDatabase({ through: 8 });
    await seed(db);
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,'legacy@example.org','{}')",
      [owner],
    );
    await db.query(
      "insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='admin'",
      [owner],
    );
    await db.query(
      "insert into public.articles(id,author_id,status,published_at) values($1,$2,'published',$3)",
      [article, owner, publishedAt],
    );
    await db.query(
      "insert into public.article_translations(article_id,locale,title,slug,excerpt,body) values($1,'ru','Legacy article','legacy-article','Legacy article summary',$2)",
      [article, legacyBody],
    );
    await db.query(
      "insert into public.scientist_profiles(id,created_by,status,verified_at) values($1,$2,'verified',$3)",
      [scientist, owner, verifiedAt],
    );
    await db.query(
      "insert into public.events(id,status,kind,format,starts_at,ends_at,external_url,created_by,published_at) values($1,'published','seminar','online','2026-11-01T09:00:00Z','2026-11-01T10:00:00Z','https://example.org/event',$2,$3)",
      [event, owner, publishedAt],
    );
    await db.query(
      "insert into public.event_translations(event_id,locale,title,slug,summary,description,organizer) values($1,'ru','Legacy seminar','legacy-seminar','Regional science seminar','Detailed regional science seminar description.','SMU')",
      [event],
    );
    await db.query(
      "insert into public.audit_logs(user_id,entity_type,entity_id,action,new_data) values($1,'article',$2,'legacy.import','{\"source\":\"old-cms\"}')",
      [owner, article],
    );

    await applyMigrations(db, { from: 9 });

    const upgradedArticle = (await db.query<{
      status: string;
      published_at: Date;
      first_published_at: Date;
      content_version: number;
      approved_version: number;
      body: string;
      recovered: string;
    }>(`
      select a.status,a.published_at,a.first_published_at,a.content_version,a.approved_version,
        t.body,public.validate_smu_rich_text(t.content_json) recovered
      from public.articles a join public.article_translations t on t.article_id=a.id
      where a.id=$1 and t.locale='ru'
    `, [article])).rows[0];
    expect(upgradedArticle).toMatchObject({
      status: "published",
      content_version: 1,
      approved_version: 1,
      body: legacyBody,
      recovered: legacyBody,
    });
    expect(upgradedArticle.published_at.toISOString()).toBe(publishedAt);
    expect(upgradedArticle.first_published_at.toISOString()).toBe(publishedAt);

    const upgradedScientist = (await db.query<{
      status: string;
      verification_status: string;
      verified_at: Date;
      first_verified_at: Date;
      content_version: number;
    }>("select status,verification_status,verified_at,first_verified_at,content_version from public.scientist_profiles where id=$1", [scientist])).rows[0];
    expect(upgradedScientist).toMatchObject({ status: "verified", verification_status: "verified", content_version: 1 });
    expect(upgradedScientist.verified_at.toISOString()).toBe(verifiedAt);
    expect(upgradedScientist.first_verified_at.toISOString()).toBe(verifiedAt);

    expect((await db.query("select status,external_url from public.events where id=$1", [event])).rows[0])
      .toEqual({ status: "published", external_url: "https://example.org/event" });
    expect((await db.query("select action,new_data from public.audit_logs where entity_id=$1 and action='legacy.import'", [article])).rows)
      .toEqual([{ action: "legacy.import", new_data: { source: "old-cms" } }]);
    expect((await db.query<{ code: string }>(`
      select r.code from public.user_roles ur join public.roles r on r.id=ur.role_id
      where ur.user_id=$1 order by r.code
    `, [owner])).rows.map(row => row.code)).toEqual(["admin", "user"]);
    expect((await db.query("select to_regprocedure('public.read_admin_dashboard()')::text dashboard")).rows[0])
      .toEqual({ dashboard: "read_admin_dashboard()" });
  }, 30_000);
});
