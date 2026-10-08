import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { editorBlocksDocument, invalidEditorBlocks, paragraph } from "../src/lib/articles/editor-blocks.fixture";
import { richTextToPlainText } from "../src/lib/articles/rich-text";

const db = new PGlite();
const admin = "00000000-0000-4000-a000-000000000001";
const author = "00000000-0000-4000-a000-000000000002";
const otherAuthor = "00000000-0000-4000-a000-000000000003";
const reviewer = "00000000-0000-4000-a000-000000000004";
const otherReviewer = "00000000-0000-4000-a000-000000000005";
const scientistManager = "00000000-0000-4000-a000-000000000006";
const editor = "00000000-0000-4000-a000-000000000007";
const cover = "00000000-0000-4000-a000-000000000008";
const category = "00000000-0000-4000-a000-000000000009";
const field = "00000000-0000-4000-a000-000000000010";
let upgradedArticle: Record<string, unknown>;
let upgradedScientist: Record<string, unknown>;
let upgradedContent: Record<string, unknown>;
let revisionUpgrade: Record<string, unknown>;
let creditsUpgrade: Record<string, unknown>;
let relationsUpgrade: Record<string, unknown>;
let schedulingUpgrade: Record<string, unknown>;
let restoreUpgrade: Record<string, unknown>;
let blocksUpgrade: Record<string, unknown>;
const legacyBody = "  Legacy first line.\n\nSecond line with <script>literal text</script>.\n  ";
const translation = { title: "A scientific article", slug: "article-ru", excerpt: "A description of regional scientific research.", body: "A detailed explanation of regional scientific research and its results.", seoTitle: null, seoDescription: null };
const input = { contentType: "article", categoryId: null, coverMediaId: null, tagIds: [], ru: translation, kk: { ...translation, slug: "article-kk" } };
const scientistTranslation = { fullName: "Regional Scientist", slug: "scientist-ru", position: "Researcher", academicDegree: null, shortBio: "A scientist researching the region's natural resources.", biography: "A scientist working on regional development, natural resources and practical research projects." };
const scientistInput = { organizationId: null, avatarMediaId: null, publicEmail: "scientist@example.kz", orcid: null, scholarUrl: null, fieldIds: [field], ru: scientistTranslation, kk: { ...scientistTranslation, slug: "scientist-kk" } };

async function asUser<T>(user: string | null, action: () => Promise<T>, role = "authenticated") {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec("set role " + role);
  try { return await action(); }
  finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}
async function save(user = author, value: unknown = input, id: string | null = null) {
  if (id && !(value as { expectedVersion?: number }).expectedVersion) {
    const current = (await db.query<{ content_version: number }>("select content_version from public.articles where id = $1", [id])).rows[0];
    value = { ...(value as object), expectedVersion: current?.content_version };
  }
  return asUser(user, async () => (await db.query<{ id: string }>(
    "select public.save_article($1, $2::jsonb) as id", [id, JSON.stringify(value)],
  )).rows[0].id);
}
async function state(user: string, id: string, status: string | null, remove = false) {
  const { rows } = await db.query<{ content_version: number }>("select content_version from public.articles where id = $1", [id]);
  return asUser(user, () => db.query("select public.change_article_state($1, $2, $3, $4)", [id, status, remove, rows[0]?.content_version]));
}
const assign = (user: string, id: string, reviewerId: string | null) => asUser(user, () => db.query(
  "select public.assign_article_reviewer($1, $2)", [id, reviewerId],
));
const configureReview = (user: string, id: string, required: boolean, reviewerId: string | null) => asUser(user, () => db.query(
  "select public.configure_article_review($1, $2, $3)", [id, required, reviewerId],
));
const review = (user: string, id: string, decision: "approved" | "changes_requested", comment = "Review completed.", version?: number) => asUser(user, async () => {
  const current = version ?? (await db.query<{ content_version: number }>("select content_version from public.articles where id = $1", [id])).rows[0]?.content_version;
  return db.query("select public.submit_article_review($1, $2, $3, $4)", [id, current, decision, comment]);
});
async function publish(id: string) {
  await state(author, id, "in_review");
  await review(admin, id, "approved");
  await state(admin, id, "published");
}
async function saveScientist(value: unknown = scientistInput, id: string | null = null, user = scientistManager) {
  if (id && !(value as { expectedContentVersion?: number }).expectedContentVersion) {
    const current = (await db.query<{ content_version: number }>("select content_version from public.scientist_profiles where id=$1", [id])).rows[0];
    value = { ...(value as object), expectedContentVersion: current?.content_version };
  }
  return asUser(user, async () => (await db.query<{ id: string }>(
    "select public.save_scientist($1, $2::jsonb) as id", [id, JSON.stringify(value)],
  )).rows[0].id);
}
const verify = (id: string) => asUser(scientistManager, () => db.query("select public.change_scientist_verification($1, 'verified', (select content_version from public.scientist_profiles where id=$1), '')", [id]));
const visible = (table: string, user: string | null = null) => asUser(user, () => db.query<Record<string, unknown>>("select " + (table === "scientist_profiles" ? "id" : "*") + " from public." + table), user ? "authenticated" : "anon");
const createRevision = (user: string, id: string, version: number | null = 1) => asUser(user, async () =>
  (await db.query<{ id: string }>("select public.create_article_revision($1, $2) as id", [id, version])).rows[0].id);
const restoreRevision = (user: string, id: string, revisionId: string, version: number | null) => asUser(user, () =>
  db.query("select public.restore_article_revision($1, $2, $3) as version", [id, revisionId, version]));

beforeAll(async () => {
  // No default table grants: the new migration must be usable on a fresh project.
  await db.exec(String.raw`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text);
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
  `);
  const files = (await readdir(new URL("./migrations/", import.meta.url))).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  for (const file of files) {
    if (file === "012_article_credits_taxonomy.sql") {
      await db.exec(`
        insert into public.article_categories(id, slug, name_ru, name_kk) values ('00000000-0000-4000-a000-000000000098', 'legacy-category', 'Legacy RU', 'Legacy KK');
        update public.articles set category_id = '00000000-0000-4000-a000-000000000098';
        insert into public.article_revisions(article_id, revision_number, content_version, reason, title_ru, title_kk, snapshot)
          select id, 1, 1, 'manual', 'Legacy RU', 'Legacy KK', jsonb_build_object('categoryId', category_id, 'contentType', content_type) from public.articles;
      `);
    }
    if (file === "010_article_rich_text.sql") {
      await db.query("insert into public.article_translations(article_id, locale, title, slug, excerpt, body) select id, 'ru', 'Legacy article', 'legacy-article', 'Legacy description', $1 from public.articles", [legacyBody]);
    }
    if (file === "009_editorial_integrity.sql") {
      // Existing published/verified data must survive an upgrade unchanged.
      const legacyActor = "00000000-0000-4000-a000-000000000099";
      await db.query("insert into auth.users(id, email) values ($1, 'legacy@example.kz')", [legacyActor]);
      await db.query("insert into public.articles(author_id, status, published_at) values ($1, 'published', now() - interval '1 day')", [legacyActor]);
      await db.query("insert into public.scientist_profiles(created_by, status, verified_at) values ($1, 'verified', now() - interval '1 day')", [legacyActor]);
    }
    const sql = (await readFile(new URL("./migrations/" + file, import.meta.url), "utf8")).replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
    if (file === "017_article_editor_blocks.sql") blocksUpgrade = (await db.query<Record<string, unknown>>(
      "select a.status, a.content_version, a.approved_version, t.body, t.content_json, public.validate_smu_rich_text(t.content_json) recovered from public.articles a join public.article_translations t on t.article_id = a.id",
    )).rows[0];
    if (file === "016_editorial_soft_delete_restore.sql") restoreUpgrade = (await db.query<Record<string, unknown>>(
      "select status, content_version, approved_version, deleted_at, first_published_at = published_at as preserved from public.articles",
    )).rows[0];
    if (file === "015_article_scheduled_publishing.sql") schedulingUpgrade = (await db.query<Record<string, unknown>>(
      "select status, content_version, approved_version, scheduled_at, scheduled_by, first_published_at = published_at as preserved from public.articles",
    )).rows[0];
    if (file === "013_article_relations.sql") relationsUpgrade = (await db.query<Record<string, unknown>>(`
      select a.status, a.content_type, a.content_version, a.approved_version,
        (select snapshot->'relations' from public.article_revisions where article_id = a.id) as relations,
        (select count(*)::int from public.smu_article_links) as link_count from public.articles a
    `)).rows[0];
    if (file === "012_article_credits_taxonomy.sql") creditsUpgrade = (await db.query<Record<string, unknown>>(`
      select a.status, a.content_type, a.content_version, a.approved_version,
        (select count(*)::int from public.article_authors where article_id = a.id) as author_count,
        (select count(*)::int from public.article_category_links where article_id = a.id and category_id = a.category_id) as category_count,
        (select snapshot from public.article_revisions where article_id = a.id) as snapshot from public.articles a
    `)).rows[0];
    if (file === "011_article_revisions.sql") revisionUpgrade = (await db.query<Record<string, unknown>>("select status, content_version, approved_version, (select count(*)::int from public.article_revisions) as revision_count from public.articles")).rows[0];
    if (file === "010_article_rich_text.sql") upgradedContent = (await db.query<Record<string, unknown>>("select body, content_json, public.validate_smu_rich_text(content_json) as recovered from public.article_translations")).rows[0];
    if (file === "009_editorial_integrity.sql") {
      upgradedArticle = (await db.query<Record<string, unknown>>("select status, content_version, approved_version, first_published_at = published_at as preserved from public.articles")).rows[0];
      upgradedScientist = (await db.query<Record<string, unknown>>("select status, first_verified_at = verified_at as preserved from public.scientist_profiles")).rows[0];
    }
  }
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [id, role] of [[admin, "admin"], [author, "author"], [otherAuthor, "author"], [reviewer, "scientific_reviewer"], [otherReviewer, "scientific_reviewer"], [scientistManager, "scientist_manager"], [editor, "editor"]]) {
    await db.query("insert into auth.users(id, email) values ($1, $2)", [id, role + id.slice(-1) + "@example.kz"]);
    await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = $2", [id, role]);
  }
  await db.query("insert into public.article_categories(id, slug, name_ru, name_kk) values ($1, 'research', 'Research', 'Research')", [category]);
  await db.query("insert into public.scientific_fields(id, slug, name_ru, name_kk) values ($1, 'science', 'Science', 'Science')", [field]);
  await db.query("insert into public.media_assets(id, storage_bucket, storage_path, file_name, mime_type, file_size, uploaded_by, status) values ($1, 'article-media', 'cover.jpg', 'cover.jpg', 'image/jpeg', 100, $2, 'ready')", [cover, admin]);
}, 30000);
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec("delete from public.articles; delete from public.publications; delete from public.science_works; delete from public.events; delete from public.scientist_profiles; delete from public.slug_redirects; delete from public.audit_logs;");
  await db.exec("delete from public.authors; delete from public.article_types where slug not in ('article', 'news', 'interview', 'announcement'); update public.article_types set is_active = true; update public.article_categories set is_active = true;");
});

const authorInput = { profileId: null, nameRu: "Внешний автор", nameKk: "Сыртқы автор", bioRu: "Биография", bioKk: "Өмірбаян", organization: "University", position: "Researcher", websiteUrl: "https://example.kz", isActive: true };

async function deletionToken(table: "articles" | "scientist_profiles", id: string) {
  return (await db.query<{ token: string }>(`select deleted_at::text token from public.${table} where id = $1`, [id])).rows[0]?.token;
}
const restoreDeletedArticle = (id: string, token: string | null, user = admin) => asUser(user, () =>
  db.query("select public.restore_deleted_article($1, $2::timestamptz)", [id, token]));
const restoreDeletedScientist = (id: string, token: string | null, user = scientistManager) => asUser(user, () =>
  db.query("select public.restore_deleted_scientist($1, $2::timestamptz)", [id, token]));
const trash = (user: string, kind = "all", query = "", page = 1) => asUser(user, () =>
  db.query<{ id: string; entity_type: string; title_ru: string; title_kk: string; deleted_at: Date }>(
    "select * from public.list_deleted_editorial_records($1, $2, $3)", [kind, query, page]));

describe("localized media metadata", () => {
  it("stores optional English in translation rows and removes it atomically", async () => {
    const metadata = { altRu: "Обложка", altKk: "Мұқаба", altEn: "Cover", captionRu: "Подпись", captionKk: "Қолтаңба", captionEn: "Caption", copyrightHolder: "SMU", sourceUrl: "https://example.kz/source" };
    await asUser(null, () => db.query("select public.save_media_metadata($1, $2::jsonb)", [cover, JSON.stringify(metadata)]), "service_role");
    expect((await db.query("select locale, alt_text, caption from public.media_asset_translations where media_asset_id=$1 order by locale", [cover])).rows)
      .toEqual([{ locale: "en", alt_text: "Cover", caption: "Caption" }, { locale: "kk", alt_text: "Мұқаба", caption: "Қолтаңба" }, { locale: "ru", alt_text: "Обложка", caption: "Подпись" }]);
    await asUser(null, () => db.query("select public.save_media_metadata($1, $2::jsonb)", [cover, JSON.stringify({ ...metadata, altEn: null, captionEn: null })]), "service_role");
    expect((await db.query("select locale from public.media_asset_translations where media_asset_id=$1 order by locale", [cover])).rows)
      .toEqual([{ locale: "kk" }, { locale: "ru" }]);
  });
  it("does not expose the write RPC to application roles", async () => {
    await expect(asUser(admin, () => db.query("select public.save_media_metadata($1, '{}'::jsonb)", [cover]))).rejects.toThrow(/permission denied/);
  });
});

describe("soft delete restoration", () => {
  it("adds restore RPCs without changing existing published content or approval", () => {
    expect(restoreUpgrade).toMatchObject({ status: "published", content_version: 1, approved_version: 1, deleted_at: null, preserved: true });
  });
  it("lists deleted bilingual records only for authorized entity types and leaves ordinary RLS unchanged", async () => {
    const id = await save(); await publish(id); await state(admin, id, null, true);
    const scientist = await saveScientist(); await verify(scientist);
    await asUser(scientistManager, () => db.query("select public.change_scientist_state($1, null, true)", [scientist]));
    expect((await trash(admin)).rows.map(r => r.id).sort()).toEqual([id, scientist].sort());
    expect((await trash(admin, "article")).rows[0]).toMatchObject({ id, entity_type: "article", title_ru: translation.title, title_kk: translation.title });
    expect((await trash(scientistManager)).rows.map(r => r.id)).toEqual([scientist]);
    expect((await trash(admin, "all", "Regional Scientist")).rows.map(r => r.id)).toEqual([scientist]);
    expect((await trash(admin, "all", "unmatched-title")).rows).toHaveLength(0);
    for (const user of [author, otherAuthor, reviewer, editor]) await expect(trash(user)).rejects.toThrow("forbidden");
    await expect(trash(scientistManager, "article")).rejects.toThrow("forbidden");
    for (const user of [null, author, admin]) {
      expect((await visible("articles", user)).rows).toHaveLength(0);
      expect((await visible("article_translations", user)).rows).toHaveLength(0);
      expect((await visible("scientist_profiles", user)).rows).toHaveLength(0);
      expect((await visible("scientist_profile_translations", user)).rows).toHaveLength(0);
    }
  });
  it("filters by the KK translation and paginates deterministically without duplicates", async () => {
    await db.query(`insert into public.articles(author_id, deleted_at)
      select $1, '2026-10-06T10:00:00.123456Z'::timestamptz from generate_series(1, 52)`, [author]);
    const first = await trash(admin); const second = await trash(admin, "all", "", 2);
    expect(first.rows).toHaveLength(51); expect(second.rows).toHaveLength(2);
    expect(second.rows[0].id).toBe(first.rows[50].id);
    expect(new Set([...first.rows.slice(0, 50), ...second.rows].map(r => r.id)).size).toBe(52);
    const id = first.rows[0].id;
    await db.query("insert into public.article_translations(article_id, locale, title, slug, excerpt, body) values($1, 'kk', 'Қазақша іздеу', 'trash-kk', 'Description of research', $2)", [id, translation.body]);
    expect((await trash(admin, "all", "іздеу")).rows.map(r => r.id)).toEqual([id]);
  });
  it("restores full published content, credits, links, slug history and media as a private new draft version", async () => {
    const { links } = await relationFixtures();
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: translation.body }] }, { type: "image", attrs: { mediaId: cover, caption: "Kept caption" } }] };
    const id = await save(author, { ...input, categoryIds: [category], coverMediaId: cover, relations: links, ru: { ...translation, contentJson: document } });
    await publish(id);
    await save(admin, { ...input, categoryIds: [category], coverMediaId: cover, relations: links, ru: { ...translation, slug: "renamed-ru", contentJson: document } }, id);
    await publish(id);
    const before = (await db.query<Record<string, unknown>>("select * from public.articles where id = $1", [id])).rows[0];
    const translations = (await db.query("select * from public.article_translations where article_id = $1 order by locale", [id])).rows;
    const credits = (await db.query("select * from public.article_authors where article_id = $1", [id])).rows;
    const revisions = (await db.query("select * from public.article_revisions where article_id = $1 order by revision_number", [id])).rows;
    await state(admin, id, null, true);
    expect((await db.query("select * from public.media_usages where entity_type = 'article' and entity_id = $1", [id])).rows).toHaveLength(0);
    const token = await deletionToken("articles", id); await restoreDeletedArticle(id, token);
    const after = (await db.query<Record<string, unknown>>("select * from public.articles where id = $1", [id])).rows[0];
    expect(after).toMatchObject({ deleted_at: null, status: "draft", approved_version: null, published_at: null, scheduled_at: null, scheduled_by: null, content_version: Number(before.content_version) + 1, author_id: author, updated_by: admin, first_published_at: before.first_published_at });
    expect((await db.query("select * from public.article_translations where article_id = $1 order by locale", [id])).rows).toEqual(translations);
    expect((await db.query("select * from public.article_authors where article_id = $1", [id])).rows).toEqual(credits);
    expect((await db.query("select * from public.article_revisions where article_id = $1 order by revision_number", [id])).rows).toEqual(revisions);
    expect((await db.query("select * from public.smu_article_links where article_id = $1", [id])).rows).toHaveLength(5);
    expect((await db.query<{ field_name: string }>("select field_name from public.media_usages where entity_type = 'article' and entity_id = $1 order by field_name", [id])).rows.map(r => r.field_name)).toEqual(["content_ru", "cover"]);
    expect((await visible("articles", admin)).rows).toHaveLength(1);
    expect((await visible("articles")).rows).toHaveLength(0);
    expect((await visible("slug_redirects")).rows).toHaveLength(0);
    expect((await trash(admin)).rows).toHaveLength(0);
    expect((await db.query("select * from public.audit_logs where action = 'article.restore' and entity_id = $1", [id])).rows).toHaveLength(1);
    await expect(restoreDeletedArticle(id, token)).rejects.toThrow("stale_version");
    await state(author, id, "in_review"); await review(admin, id, "approved"); await state(admin, id, "published");
    expect((await visible("slug_redirects")).rows).toHaveLength(1);
  });
  it("restores a verified scientist to draft, preserves translations and reinstates avatar usage", async () => {
    await db.query("update public.media_assets set storage_bucket = 'avatars' where id = $1", [cover]);
    try {
      const id = await saveScientist({ ...scientistInput, avatarMediaId: cover }); await verify(id);
      const before = (await db.query<Record<string, unknown>>("select * from public.scientist_profiles where id = $1", [id])).rows[0];
      await asUser(scientistManager, () => db.query("select public.change_scientist_state($1, null, true)", [id]));
      const token = await deletionToken("scientist_profiles", id); await restoreDeletedScientist(id, token);
      expect((await db.query("select * from public.scientist_profiles where id = $1", [id])).rows[0]).toMatchObject({ status: "draft", deleted_at: null, verified_at: null, verified_by: null, first_verified_at: before.first_verified_at, public_email: scientistInput.publicEmail, avatar_media_id: cover });
      expect((await db.query("select * from public.scientist_profile_translations where scientist_profile_id = $1", [id])).rows).toHaveLength(2);
      expect((await db.query("select * from public.media_usages where entity_type = 'scientist_profile' and entity_id = $1", [id])).rows).toHaveLength(1);
      expect((await visible("scientist_profiles")).rows).toHaveLength(0);
      await expect(restoreDeletedScientist(id, token)).rejects.toThrow("stale_version");
      await verify(id); expect((await visible("scientist_profiles")).rows).toHaveLength(1);
    } finally { await db.query("update public.media_assets set storage_bucket = 'article-media' where id = $1", [cover]); }
  });
  it("denies restore to authors, reviewers, editors and unrelated managers even through direct RPC", async () => {
    const id = await save(); await state(admin, id, null, true);
    const token = await deletionToken("articles", id);
    for (const user of [author, reviewer, editor, scientistManager]) await expect(restoreDeletedArticle(id, token, user)).rejects.toThrow("forbidden");
    const scientist = await saveScientist(); await asUser(scientistManager, () => db.query("select public.change_scientist_state($1, null, true)", [scientist]));
    for (const user of [author, reviewer, editor]) await expect(restoreDeletedScientist(scientist, await deletionToken("scientist_profiles", scientist), user)).rejects.toThrow("forbidden");
    expect((await db.query("select * from public.audit_logs where action in ('article.restore', 'scientist.restore')")).rows).toHaveLength(0);
  });
  it("denies callers without admin.access and rechecks revoked restore permission", async () => {
    const id = await save(); await state(admin, id, null, true); const token = await deletionToken("articles", id);
    for (const code of ["admin.access", "articles.delete"]) {
      const removed = (await db.query<{ role_id: string; permission_id: string }>(
        "delete from public.role_permissions where permission_id in (select id from public.permissions where code = $1) returning role_id, permission_id", [code],
      )).rows;
      try { await expect(restoreDeletedArticle(id, token)).rejects.toThrow("forbidden"); }
      finally { for (const row of removed) await db.query("insert into public.role_permissions(role_id, permission_id) values($1, $2)", [row.role_id, row.permission_id]); }
    }
  });
  it("rejects missing/stale deletion tokens, active or nonexistent records and outdated second deletions", async () => {
    const id = await save(); await expect(restoreDeletedArticle(id, null)).rejects.toThrow("invalid_input");
    await expect(restoreDeletedArticle(id, "2020-01-01Z")).rejects.toThrow("stale_version");
    await expect(restoreDeletedArticle(cover, "2020-01-01Z")).rejects.toThrow("not_found");
    await state(admin, id, null, true);
    await db.query("update public.articles set deleted_at = '2026-10-06T10:00:00.123456Z' where id = $1", [id]);
    const token = await deletionToken("articles", id);
    await expect(restoreDeletedArticle(id, "2026-10-06T10:00:00.123Z")).rejects.toThrow("stale_version");
    await restoreDeletedArticle(id, token); await state(admin, id, null, true);
    await expect(restoreDeletedArticle(id, token)).rejects.toThrow("stale_version");
    expect((await db.query("select * from public.audit_logs where action = 'article.restore'")).rows).toHaveLength(1);
  });
  it.each(["cover", "inline", "category", "type", "author", "tag"])("rejects unavailable article %s and rolls back all state/usages/audit", async reference => {
    const tag = (await db.query<{ id: string }>("insert into public.article_tags(slug, name_ru, name_kk) values('restore-tag', 'Tag', 'Tag') returning id")).rows[0].id;
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: translation.body }] }, { type: "image", attrs: { mediaId: cover } }] };
    const id = await save(author, { ...input, categoryIds: [category], tagIds: [tag], coverMediaId: reference === "cover" ? cover : null, ru: { ...translation, contentJson: reference === "inline" ? document : undefined } });
    await state(admin, id, null, true); const token = await deletionToken("articles", id);
    try {
      if (reference === "cover" || reference === "inline") await db.query("update public.media_assets set deleted_at = now() where id = $1", [cover]);
      if (reference === "category") await db.query("update public.article_categories set is_active = false where id = $1", [category]);
      if (reference === "type") await db.query("update public.article_types set is_active = false where slug = 'article'");
      if (reference === "author") await db.query("update public.authors set is_active = false where id in (select author_id from public.article_authors where article_id = $1)", [id]);
      if (reference === "tag") await db.query("update public.article_tags set is_active = false where id = $1", [tag]);
      await expect(restoreDeletedArticle(id, token)).rejects.toThrow("invalid_reference");
      expect(await deletionToken("articles", id)).toBe(token);
      expect((await db.query("select * from public.media_usages where entity_type = 'article' and entity_id = $1", [id])).rows).toHaveLength(0);
      expect((await db.query("select * from public.audit_logs where action = 'article.restore'")).rows).toHaveLength(0);
    } finally {
      await db.query("update public.media_assets set deleted_at = null where id = $1", [cover]);
      await db.query("update public.article_categories set is_active = true where id = $1", [category]);
      await db.query("update public.article_types set is_active = true where slug = 'article'");
      await db.query("update public.authors set is_active = true");
      await db.query("delete from public.article_tag_links where tag_id = $1", [tag]);
      await db.query("delete from public.article_tags where id = $1", [tag]);
    }
  });
  it.each(["scientist", "project", "research", "event", "publication"])("rechecks unavailable %s relation targets", async kind => {
    const { links } = await relationFixtures(); const link = links.find(l => l.kind === kind)!;
    const id = await save(author, { ...input, relations: links }); await state(admin, id, null, true);
    const table = kind === "scientist" ? "scientist_profiles" : kind === "event" ? "events" : kind === "publication" ? "publications" : "science_works";
    await db.query(`update public.${table} set deleted_at = now() where id = $1`, [link.entityId]);
    const token = await deletionToken("articles", id);
    await expect(restoreDeletedArticle(id, token)).rejects.toThrow("invalid_reference");
    expect(await deletionToken("articles", id)).toBe(token);
  });
  it("rechecks the scientist parent of a publication and permits publicly cancelled events", async () => {
    const { publication, scientist, event } = await relationFixtures();
    const id = await save(author, { ...input, relations: [{ kind: "publication", entityId: publication, relationType: "subject" }] }); await state(admin, id, null, true);
    await asUser(scientistManager, () => db.query("select public.change_scientist_verification($1, 'unverified', (select content_version from public.scientist_profiles where id=$1), '')", [scientist]));
    await expect(restoreDeletedArticle(id, await deletionToken("articles", id))).rejects.toThrow("invalid_reference");
    await db.query("update public.events set status = 'cancelled' where id = $1", [event]);
    const eventId = await save(author, { ...input, ru: { ...translation, slug: "event-article-ru" }, kk: { ...translation, slug: "event-article-kk" }, relations: [{ kind: "event", entityId: event, relationType: "subject" }] });
    await state(admin, eventId, null, true); await restoreDeletedArticle(eventId, await deletionToken("articles", eventId));
  });
  it.each(["avatar", "organization", "field"])("rechecks unavailable scientist %s", async reference => {
    const org = (await db.query<{ id: string }>("insert into public.scientific_organizations(slug, name_ru, name_kk) values('restore-org', 'Org', 'Org') returning id")).rows[0].id;
    await db.query("update public.media_assets set storage_bucket = 'avatars' where id = $1", [cover]);
    try {
      const id = await saveScientist({ ...scientistInput, organizationId: org, avatarMediaId: cover });
      await asUser(scientistManager, () => db.query("select public.change_scientist_state($1, null, true)", [id]));
      try {
        if (reference === "avatar") await db.query("update public.media_assets set deleted_at = now() where id = $1", [cover]);
        if (reference === "organization") await db.query("update public.scientific_organizations set is_active = false where id = $1", [org]);
        if (reference === "field") await db.query("update public.scientific_fields set is_active = false where id = $1", [field]);
        const token = await deletionToken("scientist_profiles", id);
        await expect(restoreDeletedScientist(id, token)).rejects.toThrow("invalid_reference");
        expect(await deletionToken("scientist_profiles", id)).toBe(token);
        expect((await db.query("select * from public.audit_logs where action = 'scientist.restore'")).rows).toHaveLength(0);
      } finally {
        await db.query("update public.media_assets set deleted_at = null where id = $1", [cover]);
        await db.query("update public.scientific_fields set is_active = true where id = $1", [field]);
      }
    } finally { await db.query("update public.media_assets set storage_bucket = 'article-media' where id = $1", [cover]); await db.query("update public.scientist_profiles set organization_id = null where organization_id = $1", [org]); await db.query("delete from public.scientific_organizations where id = $1", [org]); }
  });
  it.each(["article", "scientist"])("rejects historical slug reservations during %s restoration", async kind => {
    const id = kind === "article" ? await save() : await saveScientist();
    if (kind === "article") await state(admin, id, null, true);
    else await asUser(scientistManager, () => db.query("select public.change_scientist_state($1, null, true)", [id]));
    await db.query("insert into public.slug_redirects(entity_type, entity_id, locale, old_slug) values($1, $2, 'ru', $3)", [kind, cover, kind === "article" ? translation.slug : scientistTranslation.slug]);
    const token = await deletionToken(kind === "article" ? "articles" : "scientist_profiles", id);
    await expect(kind === "article" ? restoreDeletedArticle(id, token) : restoreDeletedScientist(id, token)).rejects.toThrow("slug_reserved");
  });
  it("rolls back restoration, version reset and media usages when the audit insert fails", async () => {
    const id = await save(author, { ...input, coverMediaId: cover }); await publish(id); await state(admin, id, null, true);
    const token = await deletionToken("articles", id);
    const before = (await db.query("select * from public.articles where id = $1", [id])).rows[0];
    await db.exec(`create function public.reject_restore_audit() returns trigger language plpgsql as $$ begin if new.action = 'article.restore' then raise exception 'audit_failed'; end if; return new; end $$;
      create trigger reject_restore_audit before insert on public.audit_logs for each row execute function public.reject_restore_audit();`);
    try {
      await expect(restoreDeletedArticle(id, token)).rejects.toThrow("audit_failed");
      expect((await db.query("select * from public.articles where id = $1", [id])).rows[0]).toEqual(before);
      expect((await db.query("select * from public.media_usages where entity_type = 'article' and entity_id = $1", [id])).rows).toHaveLength(0);
    } finally { await db.exec("drop trigger reject_restore_audit on public.audit_logs; drop function public.reject_restore_audit();"); }
  });
  it("keeps recovery possible for legacy drafts with an incomplete translation", async () => {
    const id = await save(); await db.query("delete from public.article_translations where article_id = $1 and locale = 'kk'", [id]);
    await state(admin, id, null, true); await restoreDeletedArticle(id, await deletionToken("articles", id));
    await expect(state(author, id, "in_review")).rejects.toThrow("invalid_input");
    expect((await visible("articles")).rows).toHaveLength(0);
  });
  it("revokes restore/list grants from anon and service_role and keeps internal validation private", async () => {
    for (const role of ["anon", "service_role"]) for (const sql of [
      "select public.list_deleted_editorial_records()", "select public.restore_deleted_article(null, null)", "select public.restore_deleted_scientist(null, null)",
    ]) await expect(asUser(null, () => db.query(sql), role)).rejects.toThrow("permission denied");
    await expect(asUser(admin, () => db.query("select public.assert_restorable_article_links(null)"))).rejects.toThrow("permission denied");
    for (const [kind, query, page] of [["bad", "", 1], ["all", "x".repeat(121), 1], ["all", "", 0], ["all", "", 10001]] as const)
      await expect(trash(admin, kind, query, page)).rejects.toThrow("invalid_input");
  });
});

type EditorialLink = { kind: string; entityId: string; relationType: string };
async function relationFixtures() {
  const scientist = await saveScientist(); await verify(scientist);
  const project = (await db.query<{ id: string }>(`insert into public.science_works(kind, field_id, created_by, status, published_at)
    values('project', $1, $2, 'published', now() - interval '1 day') returning id`, [field, admin])).rows[0].id;
  const research = (await db.query<{ id: string }>(`insert into public.science_works(kind, field_id, created_by, status, published_at)
    values('research', $1, $2, 'published', now() - interval '1 day') returning id`, [field, admin])).rows[0].id;
  for (const [id, kind] of [[project, "project"], [research, "research"]]) {
    for (const locale of ["ru", "kk"]) await db.query(`insert into public.science_work_translations(work_id, locale, title, slug, summary, description)
      values($1, $2, $3, $4, $5, $6)`, [id, locale, `${kind} ${locale}`, `${kind}-${locale}`, "A regional scientific work summary.", "A detailed description of the regional scientific work and research."]);
  }
  const event = (await db.query<{ id: string }>(`insert into public.events(kind, format, starts_at, ends_at, created_by, status, published_at)
    values('seminar', 'offline', now() + interval '1 day', now() + interval '2 days', $1, 'published', now() - interval '1 day') returning id`, [admin])).rows[0].id;
  for (const locale of ["ru", "kk"]) await db.query(`insert into public.event_translations(event_id, locale, title, slug, summary, description, organizer)
    values($1, $2, $3, $4, $5, $6, 'Regional University')`, [event, locale, `Event ${locale}`, `event-${locale}`, "A regional scientific seminar summary.", "A detailed description of the scientific seminar at the university."]);
  const publication = await savePublicationRecord(scientist);
  const links = [
    { kind: "scientist", entityId: scientist, relationType: "expert" },
    { kind: "project", entityId: project, relationType: "subject" },
    { kind: "research", entityId: research, relationType: "mentioned" },
    { kind: "event", entityId: event, relationType: "mentioned" },
    { kind: "publication", entityId: publication, relationType: "author" },
  ];
  return { scientist, project, research, event, publication, links };
}
async function savePublicationRecord(scientistId: string, user = scientistManager, patch: Record<string, unknown> = {}, id: string | null = null) {
  return asUser(user, async () => (await db.query<{ id: string }>("select public.save_publication($1, $2::jsonb) as id", [id, JSON.stringify({
    scientistId, title: "Regional scientific publication", year: 2026, journal: "Regional Science", doi: "10.1234/regional",
    url: "https://example.kz/paper", publicationType: "article", status: "published", ...patch,
  })])).rows[0].id);
}
const publicLinks = (id: string, locale = "ru", user: string | null = null) => asUser(user, () => db.query<{ kind: string; entity_id: string; title: string; href: string; relation_type: string }>(
  "select * from public.public_article_relations($1, $2)", [id, locale]), user ? "authenticated" : "anon");
const reverseLinks = (link: EditorialLink, locale = "ru", user: string | null = null) => asUser(user, () => db.query<{ id: string; title: string; href: string; relation_type: string }>(
  "select * from public.public_related_articles($1, $2, $3)", [link.kind, link.entityId, locale]), user ? "authenticated" : "anon");

const futureTime = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
const schedule = (user: string, id: string, time: string | null, version: number | null = 1, previous: string | null = null) => asUser(user, () =>
  db.query("select public.schedule_article($1, $2, $3, $4)", [id, version, time, previous]));
const runSchedule = (limit = 100) => asUser(null, async () =>
  (await db.query<{ result: { published: number; rejected: number } }>("select public.publish_scheduled_articles($1) as result", [limit])).rows[0].result, "service_role");
async function approvedArticle(value: unknown = input) {
  const id = await save(author, value);
  await state(author, id, "in_review"); await review(admin, id, "approved");
  return id;
}
const makeDue = (id: string) => db.query("update public.articles set scheduled_at = now() - interval '1 minute' where id = $1", [id]);

describe("scheduled article publishing", () => {
  it("upgrades published data without scheduling it or changing its history", () => {
    expect(schedulingUpgrade).toEqual({ status: "published", content_version: 1, approved_version: 1,
      scheduled_at: null, scheduled_by: null, preserved: true });
  });
  it("allows only publishers to schedule an approved current version", async () => {
    const id = await approvedArticle(); const time = futureTime();
    for (const user of [author, reviewer, editor, scientistManager]) await expect(schedule(user, id, time)).rejects.toThrow("forbidden");
    await schedule(admin, id, time);
    expect((await db.query("select status, content_version, approved_version, scheduled_by, published_at from public.articles where id = $1", [id])).rows[0])
      .toEqual({ status: "scheduled", content_version: 1, approved_version: 1, scheduled_by: admin, published_at: null });
    expect((await visible("articles")).rows).toEqual([]);
    expect((await visible("article_translations")).rows).toEqual([]);
    expect((await runSchedule())).toEqual({ published: 0, rejected: 0 });
  });
  it("rejects a draft, missing approval, missing translation and invalid time without audit side effects", async () => {
    const id = await save(); const time = futureTime();
    await expect(schedule(admin, id, time)).rejects.toThrow("invalid_transition");
    await state(author, id, "in_review"); await review(admin, id, "approved");
    const before = (await db.query("select * from public.audit_logs")).rows.length;
    for (const at of ["2000-01-01T00:00:00Z", "infinity"]) await expect(schedule(admin, id, at)).rejects.toThrow("invalid_input");
    await db.query("update public.articles set approved_version = null where id = $1", [id]);
    await expect(schedule(admin, id, time)).rejects.toThrow("invalid_transition");
    await db.query("update public.articles set approved_version = 1 where id = $1", [id]);
    await db.query("delete from public.article_translations where article_id = $1 and locale = 'kk'", [id]);
    await expect(schedule(admin, id, time)).rejects.toThrow("invalid_transition");
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(before);
  });
  it("rejects stale content and missing expected versions", async () => {
    const id = await approvedArticle();
    for (const version of [null, 2]) await expect(schedule(admin, id, futureTime(), version)).rejects.toThrow("stale_version");
    expect((await db.query("select * from public.audit_logs where action = 'article.schedule.set'")).rows).toEqual([]);
  });
  it("detects stale rescheduling and cancellation even when content_version has not changed", async () => {
    const id = await approvedArticle(); const first = futureTime();
    const second = new Date(Date.parse(first) + 60000).toISOString();
    await schedule(admin, id, first);
    await expect(schedule(admin, id, second)).rejects.toThrow("stale_version");
    await schedule(admin, id, second, 1, first);
    await expect(schedule(admin, id, null, 1, first)).rejects.toThrow("stale_version");
    await schedule(admin, id, null, 1, second);
    expect((await db.query("select status, approved_version, scheduled_at, scheduled_by from public.articles where id = $1", [id])).rows[0])
      .toEqual({ status: "approved", approved_version: 1, scheduled_at: null, scheduled_by: null });
    expect(await runSchedule()).toEqual({ published: 0, rejected: 0 });
  });
  it("treats an identical schedule request as a no-op and blocks the generic scheduling RPC bypass", async () => {
    const id = await approvedArticle(); const time = futureTime();
    await expect(state(admin, id, "scheduled")).rejects.toThrow("forbidden");
    await schedule(admin, id, time); await schedule(admin, id, time, 1, time);
    expect((await db.query("select * from public.audit_logs where action = 'article.schedule.set'")).rows).toHaveLength(1);
  });
  it("publishes due articles exactly once with a revision, audit and actual publication time", async () => {
    const id = await approvedArticle(); await schedule(admin, id, futureTime()); await makeDue(id);
    expect((await visible("articles")).rows).toEqual([]);
    expect(await runSchedule()).toEqual({ published: 1, rejected: 0 });
    const row = (await db.query<Record<string, unknown>>("select status, scheduled_at, scheduled_by, published_at, first_published_at from public.articles where id = $1", [id])).rows[0];
    expect(row).toMatchObject({ status: "published", scheduled_at: null, scheduled_by: null });
    expect(row.published_at).toBeTruthy(); expect(row.first_published_at).toEqual(row.published_at);
    expect((await visible("articles")).rows).toHaveLength(1);
    expect((await visible("article_translations")).rows).toHaveLength(2);
    const revisions = (await db.query("select created_by, is_system, snapshot from public.article_revisions where article_id = $1 and reason = 'publish'", [id])).rows;
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ created_by: null, is_system: true,
      snapshot: { ru: { title: translation.title }, kk: { title: translation.title } } });
    expect((await db.query("select user_id, old_data, new_data from public.audit_logs where action = 'article.schedule.publish'")).rows)
      .toMatchObject([{ user_id: null, old_data: { scheduledBy: admin, version: 1 }, new_data: { status: "published" } }]);
    expect(await runSchedule()).toEqual({ published: 0, rejected: 0 });
    expect((await db.query("select status, scheduled_at, scheduled_by, published_at, first_published_at from public.articles where id = $1", [id])).rows[0]).toEqual(row);
    expect((await db.query("select * from public.audit_logs where action = 'article.schedule.publish'")).rows).toHaveLength(1);
  });
  it.each(["edit", "restore", "delete", "cancel", "draft", "publish"])("removes the schedule atomically on %s", async operation => {
    const id = await approvedArticle(); const time = futureTime();
    const revisionId = await createRevision(admin, id);
    await schedule(admin, id, time);
    if (operation === "edit") await save(editor, input, id);
    if (operation === "restore") await restoreRevision(admin, id, revisionId, 1);
    if (operation === "delete") await state(admin, id, null, true);
    if (operation === "cancel") await schedule(admin, id, null, 1, time);
    if (operation === "draft") await state(admin, id, "draft");
    if (operation === "publish") await state(admin, id, "published");
    expect((await db.query("select scheduled_at, scheduled_by from public.articles where id = $1", [id])).rows[0])
      .toEqual({ scheduled_at: null, scheduled_by: null });
    expect(await runSchedule()).toEqual({ published: 0, rejected: 0 });
  });
  it("rechecks mandatory scientific review during scheduling", async () => {
    const id = await save(); await configureReview(admin, id, true, reviewer);
    await state(author, id, "in_review"); await review(reviewer, id, "approved");
    await db.query("update public.article_reviews set reviewer_id = $2 where article_id = $1", [id, otherReviewer]);
    await expect(schedule(admin, id, futureTime())).rejects.toThrow("invalid_transition");
  });
  it.each(["approval", "translation", "review"])("rejects a due article with invalid %s and continues processing valid articles", async invalid => {
    const broken = await approvedArticle();
    const valid = await approvedArticle({ ...input, ru: { ...translation, slug: "valid-ru" }, kk: { ...translation, slug: "valid-kk" } });
    await schedule(admin, broken, futureTime()); await schedule(admin, valid, futureTime());
    await makeDue(broken); await makeDue(valid);
    if (invalid === "approval") await db.query("update public.articles set approved_version = null where id = $1", [broken]);
    if (invalid === "translation") await db.query("delete from public.article_translations where article_id = $1 and locale = 'kk'", [broken]);
    if (invalid === "review") await db.query("update public.articles set requires_scientific_review = true, scientific_reviewer_id = $2 where id = $1", [broken, reviewer]);
    expect(await runSchedule()).toEqual({ published: 1, rejected: 1 });
    expect((await db.query("select status, approved_version, scheduled_at from public.articles where id = $1", [broken])).rows[0])
      .toEqual({ status: "draft", approved_version: null, scheduled_at: null });
    expect((await db.query("select new_data from public.audit_logs where entity_id = $1 and action = 'article.schedule.reject'", [broken])).rows[0])
      .toMatchObject({ new_data: { reason: "invalid_approval" } });
  });
  it("rechecks the scheduler's publishing permissions at execution time", async () => {
    const id = await approvedArticle(); await schedule(admin, id, futureTime()); await makeDue(id);
    await db.query("delete from public.user_roles where user_id = $1", [admin]);
    try {
      expect(await runSchedule()).toEqual({ published: 0, rejected: 1 });
      expect((await db.query("select new_data from public.audit_logs where action = 'article.schedule.reject'")).rows[0])
        .toMatchObject({ new_data: { reason: "publisher_permissions" } });
    } finally {
      await db.query("insert into public.user_roles(user_id, role_id) select $1, id from public.roles where code = 'admin'", [admin]);
    }
  });
  it("preserves the first publication date when a republished article is scheduled", async () => {
    const id = await save(); await publish(id);
    const first = (await db.query("select first_published_at from public.articles where id = $1", [id])).rows[0];
    await state(admin, id, "draft"); await save(editor, input, id);
    await state(editor, id, "in_review"); await review(admin, id, "approved");
    await schedule(admin, id, futureTime(), 2); await makeDue(id); await runSchedule();
    expect((await db.query("select first_published_at from public.articles where id = $1", [id])).rows[0]).toEqual(first);
  });
  it("bounds batches and leaves remaining due articles for the next run", async () => {
    for (let index = 0; index < 3; index++) {
      const id = await approvedArticle({ ...input, ru: { ...translation, slug: `batch-ru-${index}` }, kk: { ...translation, slug: `batch-kk-${index}` } });
      await schedule(admin, id, futureTime()); await makeDue(id);
    }
    await expect(runSchedule(0)).rejects.toThrow("invalid_input");
    await expect(runSchedule(101)).rejects.toThrow("invalid_input");
    expect(await runSchedule(2)).toEqual({ published: 2, rejected: 0 });
    expect(await runSchedule(2)).toEqual({ published: 1, rejected: 0 });
  });
  it("rolls back publishing, revisions and audit together if the final audit write fails", async () => {
    const id = await approvedArticle(); await schedule(admin, id, futureTime()); await makeDue(id);
    await db.exec(`create function public.reject_schedule_audit() returns trigger language plpgsql as $$
      begin if new.action = 'article.schedule.publish' then raise exception 'audit_failure'; end if; return new; end; $$;
      create trigger reject_schedule_audit before insert on public.audit_logs for each row execute function public.reject_schedule_audit();`);
    try {
      await expect(runSchedule()).rejects.toThrow("audit_failure");
      expect((await db.query("select status, published_at from public.articles where id = $1", [id])).rows[0])
        .toEqual({ status: "scheduled", published_at: null });
      expect((await db.query("select * from public.article_revisions where article_id = $1 and reason = 'publish'", [id])).rows).toEqual([]);
      expect((await db.query("select * from public.audit_logs where action = 'article.schedule.publish'")).rows).toEqual([]);
    } finally { await db.exec("drop trigger reject_schedule_audit on public.audit_logs; drop function public.reject_schedule_audit();"); }
    expect(await runSchedule()).toEqual({ published: 1, rejected: 0 });
  });
  it("limits the cron RPC to service_role and prevents calls to private helpers", async () => {
    const id = await approvedArticle();
    for (const role of ["anon", "authenticated"]) {
      await expect(asUser(role === "anon" ? null : admin, () => db.query("select public.publish_scheduled_articles(100)"), role)).rejects.toThrow("permission denied");
    }
    for (const role of ["anon", "service_role"]) {
      await expect(asUser(null, () => db.query("select public.schedule_article($1, 1, now() + interval '1 hour', null)", [id]), role)).rejects.toThrow("permission denied");
    }
    await expect(asUser(admin, () => db.query("select public.change_article_state_before_scheduling($1, 'published', false, 1)", [id]))).rejects.toThrow("permission denied");
    await expect(asUser(admin, () => db.query("select public.article_version_publishable($1)", [id]))).rejects.toThrow("permission denied");
  });
});

describe("editorial relationships and scientific publications", () => {
  it("upgrades old articles and snapshots without changing their workflow or inventing links", () => {
    expect(relationsUpgrade).toEqual({ status: "published", content_type: "article", content_version: 1, approved_version: 1, relations: [], link_count: 0 });
  });
  it.each(["scientist", "project", "research", "event", "publication"])("rejects unavailable %s targets and filters public links in an editorial session", async kind => {
    const { links } = await relationFixtures();
    const link = links.find(item => item.kind === kind)!;
    const id = await save(author, { ...input, relations: [link] }); await publish(id);
    const table = kind === "scientist" ? "scientist_profiles" : kind === "project" || kind === "research" ? "science_works" : kind === "event" ? "events" : "publications";
    for (const patch of ["status = 'draft'", "deleted_at = now()", ...(kind === "scientist" ? [] : ["published_at = now() + interval '1 day'"])]) {
      await db.query(`update public.${table} set status = '${kind === "scientist" ? "verified" : "published"}', deleted_at = null${kind === "scientist" ? ", verified_at = now()" : ", published_at = now() - interval '1 day'"} where id = $1`, [link.entityId]);
      await db.query(`update public.${table} set ${patch} where id = $1`, [link.entityId]);
      expect((await publicLinks(id, "ru", admin)).rows).toEqual([]);
      expect((await reverseLinks(link, "kk", admin)).rows).toEqual([]);
      await expect(save(editor, { ...input, relations: [link] }, id)).rejects.toThrow("invalid_reference");
    }
  });
  it("saves all five FK-backed kinds and roles in order with content and audit", async () => {
    const { links } = await relationFixtures();
    const id = await save(author, { ...input, relations: links });
    const rows = (await db.query("select kind, entity_id, relation_type, sort_order from public.smu_article_links where article_id = $1 order by sort_order", [id])).rows;
    expect(rows).toEqual(links.map((link, sort_order) => ({ kind: link.kind, entity_id: link.entityId, relation_type: link.relationType, sort_order })));
    expect((await db.query<{ new_data: unknown }>("select new_data from public.audit_logs where entity_id = $1 and action = 'article.relations.save'", [id])).rows[0].new_data).toEqual({ relations: links });
    expect((await publicLinks(id)).rows).toEqual([]);
    await publish(id);
    expect((await publicLinks(id, "kk")).rows.map(row => row.kind)).toEqual(links.map(link => link.kind));
    for (const link of links) expect((await reverseLinks(link, "kk")).rows).toMatchObject([{ id, href: "/journal/kk/article-kk", relation_type: link.relationType }]);
  });
  it("omitted links are preserved and an explicit empty array clears them", async () => {
    const { links } = await relationFixtures();
    const id = await save(author, { ...input, relations: links });
    await save(author, input, id);
    expect((await db.query("select * from public.smu_article_links where article_id = $1", [id])).rows).toHaveLength(5);
    await save(author, { ...input, relations: [] }, id);
    expect((await db.query("select * from public.smu_article_links where article_id = $1", [id])).rows).toEqual([]);
  });
  it("rolls back content, versions, approval and audit for unavailable and wrong-kind targets", async () => {
    const { links, research } = await relationFixtures();
    const id = await save(author, { ...input, relations: links }); await publish(id);
    const before = (await db.query("select * from public.articles where id = $1", [id])).rows[0];
    const audit = (await db.query("select * from public.audit_logs")).rows.length;
    for (const relation of [{ ...links[0], entityId: otherAuthor }, { ...links[1], entityId: research }]) {
      await expect(save(editor, { ...input, relations: [relation] }, id)).rejects.toThrow("invalid_reference");
    }
    expect((await db.query("select * from public.articles where id = $1", [id])).rows[0]).toEqual(before);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(audit);
    expect((await publicLinks(id)).rows).toHaveLength(5);
  });
  it("rejects duplicates, invalid roles, null links and oversized arrays atomically", async () => {
    const { links } = await relationFixtures();
    for (const relations of [[links[0], links[0]], [{ ...links[0], relationType: "owner" }], null, Array(51).fill(links[0])]) {
      await expect(save(author, { ...input, relations })).rejects.toThrow("invalid_input");
    }
    expect((await db.query("select * from public.articles")).rows).toEqual([]);
    expect((await db.query("select * from public.audit_logs where entity_type = 'article'")).rows).toEqual([]);
  });
  it("linked scientists and reviewer roles do not grant article ownership or review rights", async () => {
    const { links } = await relationFixtures();
    const id = await save(author, { ...input, relations: [{ ...links[0], relationType: "reviewer" }] });
    await expect(save(otherAuthor, { ...input, relations: [] }, id)).rejects.toThrow("forbidden");
    await state(author, id, "in_review");
    await expect(state(reviewer, id, "approved")).rejects.toThrow("forbidden");
    expect((await asUser(otherAuthor, () => db.query("select * from public.article_scientists"))).rows).toEqual([]);
    await assign(admin, id, reviewer);
    expect((await asUser(reviewer, () => db.query("select * from public.article_scientists"))).rows).toHaveLength(1);
    expect((await asUser(otherReviewer, () => db.query("select * from public.article_scientists"))).rows).toEqual([]);
  });
  it("cannot write link tables or call private helpers and views directly", async () => {
    const { links } = await relationFixtures();
    const id = await save(author, { ...input, relations: links });
    await expect(asUser(author, () => db.query("delete from public.article_scientists where article_id = $1", [id]))).rejects.toThrow("permission denied");
    await expect(asUser(admin, () => db.query("select public.save_article_content(null, $1::jsonb)", [JSON.stringify(input)]))).rejects.toThrow("permission denied");
    await expect(asUser(admin, () => db.query("select * from public.smu_public_relation_targets"))).rejects.toThrow("permission denied");
    await expect(asUser(null, () => db.query("select * from public.article_scientists"), "anon")).rejects.toThrow("permission denied");
    await expect(asUser(null, () => db.query("select * from public.search_article_relation_targets('scientist')"), "anon")).rejects.toThrow("permission denied");
  });
  it("searches both languages, resolves selected IDs and refuses non-editorial callers", async () => {
    const { project } = await relationFixtures();
    const search = (user: string, kind: string, query: string, ids: string[] | null = null) => asUser(user, () => db.query("select * from public.search_article_relation_targets($1, $2, $3::uuid[])", [kind, query, ids]));
    expect((await search(author, "project", "project kk")).rows).toMatchObject([{ entity_id: project, title_ru: "project ru", title_kk: "project kk" }]);
    expect((await search(author, "project", "", [otherAuthor])).rows).toEqual([]);
    await expect(search(author, "editorial-article", "")).rejects.toThrow("invalid_input");
    await expect(search(scientistManager, "scientist", "")).resolves.toBeDefined();
    await db.query("insert into auth.users(id, email) values('00000000-0000-4000-a000-000000000080', 'ordinary@example.kz') on conflict do nothing");
    await expect(search("00000000-0000-4000-a000-000000000080", "scientist", "")).rejects.toThrow("forbidden");
  });
  it("hides draft, future and soft-deleted articles from reverse links even for administrators", async () => {
    const { links } = await relationFixtures();
    const id = await save(author, { ...input, relations: links });
    for (const user of [null, admin]) expect((await reverseLinks(links[0], "ru", user)).rows).toEqual([]);
    await publish(id);
    await db.query("update public.articles set published_at = now() + interval '1 day' where id = $1", [id]);
    expect((await reverseLinks(links[0], "ru", admin)).rows).toEqual([]);
    expect((await publicLinks(id, "ru", admin)).rows).toEqual([]);
    await db.query("update public.articles set published_at = now() - interval '1 day', deleted_at = now() where id = $1", [id]);
    expect((await reverseLinks(links[0], "ru", admin)).rows).toEqual([]);
  });
  it("hides depublished targets on both sides and invalidates scientific publications when their scientist becomes private", async () => {
    const { links, scientist, project, event, publication } = await relationFixtures();
    const id = await save(author, { ...input, relations: links }); await publish(id);
    await db.query("update public.scientist_profiles set status = 'draft' where id = $1", [scientist]);
    await db.query("update public.science_works set deleted_at = now() where id = $1", [project]);
    await db.query("update public.events set published_at = now() + interval '1 day' where id = $1", [event]);
    for (const user of [null, admin]) {
      expect((await publicLinks(id, "ru", user)).rows.map(row => row.kind)).toEqual(["research"]);
      for (const link of links.filter(item => item.kind !== "research")) expect((await reverseLinks(link, "ru", user)).rows).toEqual([]);
      expect((await asUser(user, () => db.query("select * from public.list_public_publications('ru', $1)", [publication]), user ? "authenticated" : "anon")).rows).toEqual([]);
    }
    await expect(save(editor, { ...input, relations: links }, id)).rejects.toThrow("invalid_reference");
  });
  it("allows cancelled public events but refuses archived ones", async () => {
    const { links, event } = await relationFixtures();
    await db.query("update public.events set status = 'cancelled' where id = $1", [event]);
    const id = await save(author, { ...input, relations: [links[3]] }); await publish(id);
    expect((await publicLinks(id)).rows).toHaveLength(1);
    await db.query("update public.events set status = 'archived' where id = $1", [event]);
    expect((await publicLinks(id, "ru", admin)).rows).toEqual([]);
  });
  it("includes relations in manual and workflow snapshots and restores order and roles", async () => {
    const { links } = await relationFixtures();
    const id = await save(author, { ...input, relations: links });
    const revision = await createRevision(author, id);
    await save(author, { ...input, relations: [{ ...links[4], relationType: "mentioned" }] }, id);
    await restoreRevision(author, id, revision, 2);
    const snapshot = (await db.query<{ snapshot: { relations: EditorialLink[] } }>("select snapshot from public.article_revisions where id = $1", [revision])).rows[0].snapshot;
    expect(snapshot.relations).toEqual(links);
    await publish(id);
    const snapshots = (await db.query<{ snapshot: { relations: EditorialLink[] } }>("select snapshot from public.article_revisions where article_id = $1 and reason in ('review','publish')", [id])).rows;
    expect(snapshots).toHaveLength(2);
    expect(snapshots.every(row => JSON.stringify(row.snapshot.relations) === JSON.stringify(links))).toBe(true);
    expect((await publicLinks(id)).rows.map(row => row.relation_type)).toEqual(links.map(link => link.relationType));
  });
  it("rolls back the restore checkpoint and audit when an old linked target is unavailable", async () => {
    const { links, scientist } = await relationFixtures();
    const id = await save(author, { ...input, relations: [links[0]] });
    const revision = await createRevision(author, id);
    await save(author, { ...input, relations: [] }, id);
    await db.query("update public.scientist_profiles set deleted_at = now() where id = $1", [scientist]);
    const auditCount = (await db.query("select * from public.audit_logs")).rows.length;
    await expect(restoreRevision(author, id, revision, 2)).rejects.toThrow("invalid_reference");
    expect((await db.query("select * from public.article_revisions where article_id = $1", [id])).rows).toHaveLength(1);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(auditCount);
    expect((await db.query("select content_version from public.articles where id = $1", [id])).rows[0]).toEqual({ content_version: 2 });
  });
  it("keeps scientific publication management separate and checks session, references, stale writes and URLs", async () => {
    const scientist = await saveScientist(); await verify(scientist);
    await expect(savePublicationRecord(scientist, author)).rejects.toThrow("forbidden");
    await expect(savePublicationRecord(scientist, scientistManager, { url: "javascript:alert(1)" })).rejects.toThrow();
    const id = await savePublicationRecord(scientist);
    await expect(savePublicationRecord(scientist, scientistManager, {}, id)).rejects.toThrow("stale_version");
    const updatedAt = (await db.query<{ updated_at: Date }>("select updated_at from public.publications where id = $1", [id])).rows[0].updated_at;
    await savePublicationRecord(scientist, scientistManager, { expectedUpdatedAt: updatedAt, status: "archived" }, id);
    expect((await asUser(admin, () => db.query("select * from public.list_public_publications('ru', $1)", [id]))).rows).toEqual([]);
    await expect(asUser(scientistManager, () => db.query("update public.publications set title = 'Direct write' where id = $1", [id]))).rejects.toThrow("permission denied");
    expect((await db.query("select * from public.articles")).rows).toEqual([]);
  });
});
async function directoryAuthor(user = editor, value: unknown = authorInput, id: string | null = null) {
  return asUser(user, async () => (await db.query<{ id: string }>("select public.save_article_author($1, $2::jsonb) as id", [id, JSON.stringify(value)])).rows[0].id);
}
async function directoryType(user = editor) {
  return asUser(user, async () => (await db.query<{ id: string }>("select public.create_article_taxonomy($1::jsonb) as id", [JSON.stringify({ kind: "type", slug: "report", nameRu: "Отчёт", nameKk: "Есеп" })])).rows[0].id);
}
describe("article credits and managed taxonomy", () => {
  it("backfills owners, primary categories and old revisions without changing workflow", () => {
    expect(creditsUpgrade).toMatchObject({ status: "published", content_type: "article", content_version: 1, approved_version: 1, author_count: 1, category_count: 1 });
    expect(creditsUpgrade.snapshot).toMatchObject({ categoryIds: ["00000000-0000-4000-a000-000000000098"], authors: [{ role: "author" }] });
  });
  it("saves ordered external/internal credits and multiple categories with a custom type", async () => {
    await directoryType();
    const external = await directoryAuthor();
    const internal = await directoryAuthor(editor, { ...authorInput, profileId: otherAuthor });
    const categories = [category, "00000000-0000-4000-a000-000000000098"];
    const authors = [{ authorId: external, role: "translator" }, { authorId: internal, role: "coauthor" }];
    const id = await save(author, { ...input, contentType: "report", categoryIds: categories, authors });
    expect((await db.query<Record<string, unknown>>("select author_id, content_type, category_id from public.articles where id = $1", [id])).rows[0]).toEqual({ author_id: author, content_type: "report", category_id: category });
    expect((await db.query<Record<string, unknown>>("select author_id, role, sort_order from public.article_authors where article_id = $1 order by sort_order", [id])).rows).toEqual([{ author_id: external, role: "translator", sort_order: 0 }, { author_id: internal, role: "coauthor", sort_order: 1 }]);
    expect((await db.query<Record<string, unknown>>("select category_id from public.article_category_links where article_id = $1 order by sort_order", [id])).rows.map(row => row.category_id)).toEqual(categories);
    await expect(save(otherAuthor, { ...input, authors }, id)).rejects.toThrow("forbidden");
    expect((await visible("article_authors", otherAuthor)).rows).toHaveLength(0);
  });
  it("preserves credits on old-client saves and clears explicit empty arrays", async () => {
    const external = await directoryAuthor();
    const id = await save(author, { ...input, categoryIds: [category], authors: [{ authorId: external, role: "author" }] });
    await save(author, { ...input, categoryId: category }, id);
    expect((await db.query<Record<string, unknown>>("select author_id from public.article_authors where article_id = $1", [id])).rows).toEqual([{ author_id: external }]);
    await save(author, { ...input, categoryIds: [], authors: [] }, id);
    expect((await db.query<Record<string, unknown>>("select * from public.article_authors where article_id = $1", [id])).rows).toHaveLength(0);
    expect((await db.query<Record<string, unknown>>("select * from public.article_category_links where article_id = $1", [id])).rows).toHaveLength(0);
    expect((await db.query<Record<string, unknown>>("select category_id from public.articles where id = $1", [id])).rows[0]).toEqual({ category_id: null });
  });
  it("allows only editors to manage directories and select profile identities", async () => {
    for (const user of [author, reviewer, scientistManager]) {
      await expect(directoryAuthor(user)).rejects.toThrow("forbidden");
      await expect(directoryType(user)).rejects.toThrow("forbidden");
      await expect(asUser(user, () => db.query<Record<string, unknown>>("select * from public.list_article_author_profiles()"))).rejects.toThrow("forbidden");
    }
    const profiles = await asUser(editor, () => db.query<Record<string, unknown>>("select * from public.list_article_author_profiles()"));
    expect(profiles.rows.some(row => row.id === otherAuthor)).toBe(true);
    const external = await directoryAuthor();
    expect((await db.query<Record<string, unknown>>("select profile_id from public.authors where id = $1", [external])).rows[0]).toEqual({ profile_id: null });
  });
  it("denies direct writes and anonymous/service-role management calls", async () => {
    for (const table of ["authors", "article_authors", "article_category_links", "article_types"]) {
      await expect(asUser(editor, () => db.exec(`delete from public.${table}`))).rejects.toThrow(/permission denied/);
    }
    for (const role of ["anon", "service_role"]) {
      await expect(asUser(null, () => db.query<Record<string, unknown>>("select public.save_article_author(null, $1::jsonb)", [JSON.stringify(authorInput)]), role)).rejects.toThrow(/permission denied/);
      await expect(asUser(null, () => db.query<Record<string, unknown>>("select public.save_article_taxonomy(null, '{}'::jsonb)"), role)).rejects.toThrow(/permission denied/);
      await expect(asUser(null, () => db.query<Record<string, unknown>>("select * from public.list_article_author_profiles()"), role)).rejects.toThrow(/permission denied/);
    }
  });
  it("rolls back content, approvals, relations and audit on invalid credit/category/type input", async () => {
    const external = await directoryAuthor();
    const id = await save(author, { ...input, categoryIds: [category], authors: [{ authorId: external, role: "author" }] }); await publish(id);
    const before = (await db.query<Record<string, unknown>>("select * from public.articles where id = $1", [id])).rows[0];
    const audits = (await db.query<Record<string, unknown>>("select * from public.audit_logs")).rows.length;
    const bad = [
      { authors: [{ authorId: external, role: "owner" }] }, { authors: [{ authorId: external, role: "author" }, { authorId: external, role: "coauthor" }] },
      { authors: [{ authorId: cover, role: "author" }] }, { authors: null },
      { categoryIds: [category, category] }, { categoryIds: [cover] }, { categoryIds: null }, { contentType: "unknown-type" },
    ];
    for (const patch of bad) await expect(save(editor, { ...input, ...patch }, id)).rejects.toThrow(/invalid_input|invalid_reference/);
    expect((await db.query<Record<string, unknown>>("select * from public.articles where id = $1", [id])).rows[0]).toEqual(before);
    expect((await db.query<Record<string, unknown>>("select * from public.audit_logs")).rows).toHaveLength(audits);
    expect((await db.query<Record<string, unknown>>("select author_id from public.article_authors where article_id = $1", [id])).rows).toEqual([{ author_id: external }]);
    expect((await db.query<Record<string, unknown>>("select category_id from public.article_category_links where article_id = $1", [id])).rows).toEqual([{ category_id: category }]);
  });
  it("hides draft credits and unpublished directory people from anonymous readers", async () => {
    const external = await directoryAuthor(); const unattached = await directoryAuthor();
    const id = await save(author, { ...input, categoryIds: [category], authors: [{ authorId: external, role: "author" }] });
    const read = () => asUser(null, () => db.query<Record<string, unknown>>("select id, name_ru from public.authors"), "anon");
    expect((await read()).rows).toHaveLength(0); expect((await visible("article_authors")).rows).toHaveLength(0);
    await publish(id);
    expect((await read()).rows).toEqual([{ id: external, name_ru: authorInput.nameRu }]);
    expect((await read()).rows.some(row => row.id === unattached)).toBe(false);
    expect((await visible("article_category_links")).rows).toHaveLength(1);
    await expect(asUser(null, () => db.query<Record<string, unknown>>("select profile_id from public.authors"), "anon")).rejects.toThrow(/permission denied/);
    await state(admin, id, null, true);
    expect((await read()).rows).toHaveLength(0); expect((await visible("article_authors")).rows).toHaveLength(0);
  });
  it("keeps inactive attached credits/categories/types visible while denying new attachment", async () => {
    const type = await directoryType(); const external = await directoryAuthor();
    const value = { ...input, contentType: "report", categoryIds: [category], authors: [{ authorId: external, role: "author" }] };
    const id = await save(author, value); await publish(id);
    await directoryAuthor(editor, { ...authorInput, isActive: false }, external);
    for (const [kind, taxonomyId, slug] of [["type", type, "report"], ["category", category, "research"]]) {
      await asUser(editor, () => db.query<Record<string, unknown>>("select public.save_article_taxonomy($1, $2::jsonb)", [taxonomyId, JSON.stringify({ kind, slug, nameRu: "Inactive RU", nameKk: "Inactive KK", isActive: false })]));
    }
    expect((await asUser(null, () => db.query<Record<string, unknown>>("select id from public.authors"), "anon")).rows).toEqual([{ id: external }]);
    expect((await visible("article_types")).rows.some(row => row.slug === "report")).toBe(true);
    expect((await visible("article_categories")).rows.some(row => row.id === category)).toBe(true);
    await save(editor, value, id);
    for (const patch of [{ authors: value.authors }, { categoryIds: [category] }, { contentType: "report" }]) {
      await expect(save(author, { ...input, ...patch })).rejects.toThrow("invalid_reference");
    }
    await directoryAuthor(editor, { ...authorInput, isActive: true }, external);
    await save(author, { ...input, authors: value.authors, ru: { ...translation, slug: "active-again" }, kk: { ...input.kk, slug: "active-again" } });
  });
  it("restores ordered credits, roles, categories and custom types with fresh approval", async () => {
    await directoryType(); const first = await directoryAuthor(); const second = await directoryAuthor();
    const authors = [{ authorId: second, role: "editor" }, { authorId: first, role: "author" }];
    const categories = ["00000000-0000-4000-a000-000000000098", category];
    const id = await save(author, { ...input, contentType: "report", categoryIds: categories, authors });
    const revision = await createRevision(author, id);
    await save(author, { ...input, categoryIds: [category], authors: [{ authorId: first, role: "translator" }] }, id);
    await publish(id);
    const version = (await db.query<{ content_version: number }>("select content_version from public.articles where id = $1", [id])).rows[0].content_version;
    await restoreRevision(editor, id, revision, version);
    expect((await db.query<Record<string, unknown>>("select snapshot from public.article_revisions where id = $1", [revision])).rows[0].snapshot).toMatchObject({ authors, categoryIds: categories, contentType: "report" });
    expect((await db.query<Record<string, unknown>>("select author_id, role from public.article_authors where article_id = $1 order by sort_order", [id])).rows).toEqual([{ author_id: second, role: "editor" }, { author_id: first, role: "author" }]);
    expect((await db.query<Record<string, unknown>>("select category_id from public.article_category_links where article_id = $1 order by sort_order", [id])).rows.map(row => row.category_id)).toEqual(categories);
    expect((await db.query<Record<string, unknown>>("select status, approved_version, content_type, author_id from public.articles where id = $1", [id])).rows[0]).toEqual({ status: "draft", approved_version: null, content_type: "report", author_id: author });
  });
  it("rolls back restoration and checkpoint when a removed credit becomes inactive", async () => {
    const external = await directoryAuthor();
    const id = await save(author, { ...input, authors: [{ authorId: external, role: "author" }] });
    const revision = await createRevision(author, id);
    await save(author, { ...input, authors: [] }, id); await directoryAuthor(editor, { ...authorInput, isActive: false }, external);
    const audits = (await db.query<Record<string, unknown>>("select * from public.audit_logs")).rows.length;
    await expect(restoreRevision(author, id, revision, 2)).rejects.toThrow("invalid_reference");
    expect((await db.query<Record<string, unknown>>("select * from public.article_revisions where article_id = $1", [id])).rows).toHaveLength(1);
    expect((await db.query<Record<string, unknown>>("select * from public.audit_logs")).rows).toHaveLength(audits);
    expect((await db.query<Record<string, unknown>>("select content_version from public.articles where id = $1", [id])).rows[0]).toEqual({ content_version: 2 });
  });
  it("rejects unsafe author URLs, invalid profile references and mutable taxonomy codes", async () => {
    await expect(directoryAuthor(editor, { ...authorInput, websiteUrl: "javascript:alert(1)" })).rejects.toThrow("invalid_input");
    await expect(directoryAuthor(editor, { ...authorInput, profileId: cover })).rejects.toThrow("invalid_reference");
    const type = await directoryType();
    await expect(asUser(editor, () => db.query<Record<string, unknown>>("select public.save_article_taxonomy($1, $2::jsonb)", [type, JSON.stringify({ kind: "type", slug: "renamed", nameRu: "Name", nameKk: "Name", isActive: true })]))).rejects.toThrow("invalid_input");
  });
});

describe("session-authorized editorial transactions", () => {
  it("preserves published legacy content and permissions when adding editor blocks", async () => {
    expect(blocksUpgrade).toMatchObject({ status: "published", content_version: 1, approved_version: 1, body: legacyBody, recovered: legacyBody });
    expect(blocksUpgrade.content_json).toEqual(upgradedContent.content_json);
    for (const role of ["anon", "authenticated", "service_role"]) await expect(asUser(null, () => db.query("select public.validate_smu_rich_text($1::jsonb)", [JSON.stringify(editorBlocksDocument)]), role)).rejects.toThrow("permission denied");
  });
  it("round-trips all new blocks through save, publication, revision and restoration", async () => {
    const id = await save(author, { ...input, ru: { ...translation, contentJson: editorBlocksDocument }, kk: { ...input.kk, contentJson: editorBlocksDocument } });
    const saved = (await db.query("select body, content_json from public.article_translations where article_id = $1 order by locale", [id])).rows;
    expect(saved).toEqual(Array.from({ length: 2 }, () => ({ body: richTextToPlainText(editorBlocksDocument), content_json: editorBlocksDocument })));
    await publish(id);
    const revisionId = (await db.query<{ id: string }>("select id from public.article_revisions where article_id = $1 and reason = 'publish'", [id])).rows[0].id;
    expect((await visible("article_translations")).rows).toHaveLength(2);
    await save(editor, input, id);
    await restoreRevision(editor, id, revisionId, 2);
    expect((await db.query("select content_json from public.article_translations where article_id = $1 and locale = 'ru'", [id])).rows[0]).toEqual({ content_json: editorBlocksDocument });
    expect((await db.query("select status, approved_version, content_version from public.articles where id = $1", [id])).rows[0]).toEqual({ status: "draft", approved_version: null, content_version: 3 });
  });
  it.each(invalidEditorBlocks)("rolls back direct RPC edits for %s", async (_name, block) => {
    const id = await save(); await publish(id);
    const before = (await db.query("select * from public.articles where id = $1", [id])).rows[0];
    const audits = (await db.query("select count(*)::int count from public.audit_logs")).rows[0];
    await expect(save(editor, { ...input, ru: { ...translation, title: "Attempted partial change" }, kk: { ...input.kk, contentJson: { type: "doc", content: [paragraph(translation.body), block] } } }, id)).rejects.toThrow("invalid_input");
    expect((await db.query("select * from public.articles where id = $1", [id])).rows[0]).toEqual(before);
    expect((await db.query("select title from public.article_translations where article_id = $1 and locale = 'ru'", [id])).rows[0]).toEqual({ title: translation.title });
    expect((await db.query("select count(*)::int count from public.audit_logs")).rows[0]).toEqual(audits);
  });
  it("tracks and restores library images nested in tables and callouts", async () => {
    const image = { type: "image", attrs: { mediaId: cover } };
    const document = { type: "doc", content: [paragraph(translation.body), { type: "callout", attrs: { kind: "info" }, content: [image] }, { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [image] }] }] }] };
    const id = await save(author, { ...input, ru: { ...translation, contentJson: document } });
    expect((await db.query("select media_asset_id, field_name from public.media_usages where entity_id = $1", [id])).rows).toEqual([{ media_asset_id: cover, field_name: "content_ru" }]);
    await state(admin, id, null, true);
    await restoreDeletedArticle(id, await deletionToken("articles", id));
    expect((await db.query("select content_json from public.article_translations where article_id = $1 and locale = 'ru'", [id])).rows[0]).toEqual({ content_json: document });
    expect((await db.query("select media_asset_id, field_name from public.media_usages where entity_id = $1", [id])).rows).toEqual([{ media_asset_id: cover, field_name: "content_ru" }]);
  });
  it("migrates legacy text without losing blank lines, whitespace or literal HTML", () => {
    expect(upgradedContent.body).toBe(legacyBody);
    expect(upgradedContent.recovered).toBe(legacyBody);
    expect(upgradedContent.content_json).toMatchObject({ type: "doc" });
  });
  it("stores JSON as the source of truth and derives searchable body", async () => {
    const document = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Scientific results" }] }, { type: "paragraph", content: [{ type: "text", text: translation.body, marks: [{ type: "bold" }] }] }] };
    const id = await save(author, { ...input, ru: { ...translation, body: "Forged plain text", contentJson: document } });
    expect((await db.query("select body, content_json from public.article_translations where article_id = $1 and locale = 'ru'", [id])).rows[0]).toEqual({ body: "Scientific results\n" + translation.body, content_json: document });
  });
  it("rejects stale and missing edit versions without changing content or audit", async () => {
    const id = await save();
    await save(author, { ...input, expectedVersion: 1, ru: { ...translation, title: "Newer title" } }, id);
    const audits = (await db.query("select * from public.audit_logs")).rows.length;
    await expect(save(author, { ...input, expectedVersion: 1 }, id)).rejects.toThrow("stale_version");
    await expect(asUser(author, () => db.query("select public.save_article($1, $2::jsonb)", [id, JSON.stringify(input)]))).rejects.toThrow("stale_version");
    expect((await db.query("select content_version from public.articles where id = $1", [id])).rows[0]).toEqual({ content_version: 2 });
    expect((await db.query("select title from public.article_translations where article_id = $1 and locale = 'ru'", [id])).rows[0]).toEqual({ title: "Newer title" });
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(audits);
  });
  it("rolls back unsafe structured content including direct RPC calls", async () => {
    const id = await save(); await publish(id);
    const invalid = [
      { type: "doc", content: [{ type: "script", text: "alert(1)" }] },
      { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: translation.body, marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] },
      { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: translation.body }] }] },
      { type: "doc", content: [{ type: "image", attrs: { mediaId: cover, src: "data:image/svg+xml,bad" } }] },
    ];
    const before = (await db.query("select * from public.articles where id = $1", [id])).rows[0];
    const audits = (await db.query("select * from public.audit_logs")).rows.length;
    for (const document of invalid) await expect(save(editor, { ...input, kk: { ...input.kk, contentJson: document } }, id)).rejects.toThrow("invalid_input");
    expect((await db.query("select * from public.articles where id = $1", [id])).rows[0]).toEqual(before);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(audits);
  });
  it("tracks inline media usages atomically and rejects unavailable assets", async () => {
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: translation.body }] }, { type: "image", attrs: { mediaId: cover, src: "https://example.kz/image.jpg", caption: "A caption" } }] };
    const id = await save(author, { ...input, ru: { ...translation, contentJson: document } });
    expect((await db.query("select media_asset_id, field_name from public.media_usages where entity_id = $1", [id])).rows).toEqual([{ media_asset_id: cover, field_name: "content_ru" }]);
    await db.query("update public.media_assets set deleted_at = now() where id = $1", [cover]);
    try { await expect(save(author, { ...input, ru: { ...translation, contentJson: document } }, id)).rejects.toThrow("invalid_reference"); }
    finally { await db.query("update public.media_assets set deleted_at = null where id = $1", [cover]); }
    await save(author, input, id);
    expect((await db.query("select * from public.media_usages where entity_id = $1", [id])).rows).toHaveLength(0);
  });
  it("cleans inline media usages on soft and hard deletion", async () => {
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: translation.body }] }, { type: "image", attrs: { mediaId: cover, src: "https://example.kz/image.jpg" } }] };
    const id = await save(author, { ...input, ru: { ...translation, contentJson: document } });
    await state(admin, id, null, true);
    expect((await db.query("select * from public.media_usages where entity_id = $1", [id])).rows).toHaveLength(0);
    await db.query("delete from public.articles where id = $1", [id]);
    const nextId = await save(author, { ...input, ru: { ...translation, contentJson: document } });
    await db.query("delete from public.articles where id = $1", [nextId]);
    expect((await db.query("select * from public.media_usages where entity_id = $1", [nextId])).rows).toHaveLength(0);
  });
  it("preserves existing publications and verification when upgrading", () => {
    expect(upgradedArticle).toEqual({ status: "published", content_version: 1, approved_version: 1, preserved: true });
    expect(upgradedScientist).toEqual({ status: "verified", preserved: true });
  });
  it("creates both translations and audit without platform default grants", async () => {
    const id = await save();
    expect((await visible("articles", author)).rows).toHaveLength(1);
    expect((await visible("article_translations", author)).rows).toHaveLength(2);
    expect((await visible("articles")).rows).toHaveLength(0);
    expect((await db.query("select user_id from public.audit_logs where entity_id = $1", [id])).rows[0]).toEqual({ user_id: author });
    expect((await visible("user_roles", author)).rows).toHaveLength(1);
  });
  it("denies anonymous/service-role RPCs and callers without a session", async () => {
    for (const role of ["anon", "service_role"]) {
      await expect(asUser(null, () => db.query("select public.save_article(null, $1::jsonb)", [JSON.stringify(input)]), role)).rejects.toThrow(/permission denied/);
    }
    await expect(asUser(null, () => db.query("select public.save_article(null, $1::jsonb)", [JSON.stringify(input)]))).rejects.toThrow("forbidden");
    await expect(save(scientistManager)).rejects.toThrow("forbidden");
  });
  it("does not trust a forged actor in the payload", async () => {
    const id = await save(author, { ...input, authorId: admin, createdBy: admin });
    expect((await db.query("select author_id from public.articles where id = $1", [id])).rows[0]).toEqual({ author_id: author });
  });
  it("denies direct writes and execution of internal helpers", async () => {
    const id = await save();
    await expect(asUser(admin, () => db.query("update public.articles set status = 'approved' where id = $1", [id]))).rejects.toThrow(/permission denied/);
    await expect(asUser(admin, () => db.query("delete from public.article_translations where article_id = $1", [id]))).rejects.toThrow(/permission denied/);
    await expect(asUser(admin, () => db.query("select public.require_smu_session()"))).rejects.toThrow(/permission denied/);
  });
  it("denies another author's reads, edits and workflow operations", async () => {
    const id = await save();
    expect((await visible("articles", otherAuthor)).rows).toHaveLength(0);
    await expect(save(otherAuthor, input, id)).rejects.toThrow("forbidden");
    await expect(state(otherAuthor, id, "in_review")).rejects.toThrow("forbidden");
    await expect(state(author, id, "approved")).rejects.toThrow("forbidden");
  });
  it("rolls back creation when the second locale slug conflicts", async () => {
    await save();
    await expect(save(author, { ...input, ru: { ...translation, slug: "unused-ru" } })).rejects.toThrow(/unique constraint/);
    expect((await db.query("select * from public.articles")).rows).toHaveLength(1);
    expect((await db.query("select * from public.article_translations")).rows).toHaveLength(2);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(1);
  });
  it("rolls back metadata, public status, history, translations, media usage and audit on edit failure", async () => {
    const id = await save(); await publish(id);
    await save(otherAuthor, { ...input, ru: { ...translation, slug: "other-ru" }, kk: { ...translation, slug: "other-kk" } });
    const before = (await db.query("select * from public.articles where id = $1", [id])).rows[0];
    const auditCount = (await db.query("select * from public.audit_logs")).rows.length;
    await expect(save(admin, { ...input, categoryId: category, coverMediaId: cover,
      ru: { ...translation, slug: "changed-ru" }, kk: { ...translation, slug: "other-kk" } }, id)).rejects.toThrow(/unique constraint/);
    expect((await db.query("select * from public.articles where id = $1", [id])).rows[0]).toEqual(before);
    expect((await db.query("select * from public.slug_redirects")).rows).toHaveLength(0);
    expect((await db.query("select * from public.media_usages where entity_id = $1", [id])).rows).toHaveLength(0);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(auditCount);
  });
  it("limits reviewer reads and approval to an assigned article", async () => {
    const id = await save();
    expect((await visible("articles", reviewer)).rows).toHaveLength(0);
    await assign(editor, id, reviewer);
    await state(author, id, "in_review");
    expect((await visible("articles", reviewer)).rows).toHaveLength(1);
    expect((await visible("article_translations", reviewer)).rows).toHaveLength(2);
    expect((await visible("articles", otherReviewer)).rows).toHaveLength(0);
    await expect(state(otherReviewer, id, "approved")).rejects.toThrow("forbidden");
    await review(reviewer, id, "approved");
    expect((await db.query("select approved_version, content_version from public.articles where id = $1", [id])).rows[0]).toEqual({ approved_version: 1, content_version: 1 });
  });
  it("validates reviewer assignment and locks it after approval", async () => {
    const id = await save();
    await expect(assign(author, id, reviewer)).rejects.toThrow("forbidden");
    await expect(assign(editor, id, author)).rejects.toThrow("invalid_reference");
    await assign(editor, id, reviewer);
    await state(author, id, "in_review"); await review(reviewer, id, "approved");
    await expect(assign(editor, id, otherReviewer)).rejects.toThrow("invalid_transition");
  });
  it("rejects repeated published status without changing timestamps or audit", async () => {
    const id = await save(); await publish(id);
    const before = (await db.query("select * from public.articles where id = $1", [id])).rows[0];
    const auditCount = (await db.query("select * from public.audit_logs")).rows.length;
    for (const user of [scientistManager, admin]) await expect(state(user, id, "published")).rejects.toThrow("invalid_transition");
    expect((await db.query("select * from public.articles where id = $1", [id])).rows[0]).toEqual(before);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(auditCount);
  });
  it("resets published edits to draft and requires approval of the new content version", async () => {
    const id = await save(); await publish(id);
    await expect(save(author, input, id)).rejects.toThrow("forbidden");
    await save(editor, { ...input, ru: { ...translation, body: "An updated explanation of the region's research and scientific results." } }, id);
    expect((await db.query("select status, approved_version, content_version from public.articles where id = $1", [id])).rows[0]).toEqual({ status: "draft", approved_version: null, content_version: 2 });
    expect((await visible("articles")).rows).toHaveLength(0);
    await expect(state(admin, id, "published")).rejects.toThrow("forbidden");
    await publish(id);
    expect((await visible("articles")).rows).toHaveLength(1);
  });
  it("denies publication when approval is for an older version", async () => {
    const id = await save();
    await state(author, id, "in_review"); await review(admin, id, "approved");
    await db.query("update public.articles set content_version = 2 where id = $1", [id]);
    await expect(state(admin, id, "published")).rejects.toThrow("invalid_transition");
  });
  it("rejects approval from a stale review page or an RPC without a version", async () => {
    const id = await save();
    await assign(editor, id, reviewer);
    await state(author, id, "in_review");
    await save(editor, { ...input, ru: { ...translation, title: "An updated scientific article" } }, id);
    await state(author, id, "in_review");
    await expect(review(reviewer, id, "approved", "Stale decision.", 1)).rejects.toThrow("stale_version");
    await expect(asUser(reviewer, () => db.query("select public.submit_article_review($1, null, 'approved', 'Missing version')", [id]))).rejects.toThrow("stale_version");
    await review(reviewer, id, "approved");
  });
  it("supports unpublish and atomically audits soft delete", async () => {
    const id = await save(); await publish(id);
    await state(admin, id, "draft");
    expect((await visible("articles")).rows).toHaveLength(0);
    await state(admin, id, null, true);
    expect((await visible("articles", admin)).rows).toHaveLength(0);
    expect((await db.query("select * from public.audit_logs where action = 'article.soft_delete'")).rows).toHaveLength(1);
  });
  it("validates RPC input and references without relying on Zod", async () => {
    await expect(save(author, { ...input, kk: { ...input.kk, body: "short" } })).rejects.toThrow("invalid_input");
    await expect(save(author, { ...input, coverMediaId: otherAuthor })).rejects.toThrow("invalid_reference");
    expect((await db.query("select * from public.articles")).rows).toHaveLength(0);
  });
});

describe("versioned scientific review", () => {
  it("requires a reviewer before mandatory review and records an assigned decision", async () => {
    const id = await save();
    await expect(configureReview(author, id, true, reviewer)).rejects.toThrow("forbidden");
    await expect(configureReview(editor, id, true, null)).rejects.toThrow("invalid_input");
    await configureReview(editor, id, true, reviewer);
    await state(author, id, "in_review");
    await expect(review(editor, id, "approved", "Editorial approval." )).rejects.toThrow("forbidden");
    await expect(state(reviewer, id, "approved")).rejects.toThrow("forbidden");
    await review(reviewer, id, "changes_requested", "Please clarify the research method.");
    expect((await db.query<Record<string, unknown>>("select status, approved_version from public.articles where id = $1", [id])).rows[0])
      .toEqual({ status: "changes_requested", approved_version: null });
    expect((await db.query<Record<string, unknown>>("select content_version, reviewer_id, decision, comment from public.article_reviews where article_id = $1", [id])).rows)
      .toEqual([{ content_version: 1, reviewer_id: reviewer, decision: "changes_requested", comment: "Please clarify the research method." }]);
  });

  it("keeps old feedback as history and requires a fresh decision after changes", async () => {
    const id = await save();
    await configureReview(editor, id, true, reviewer);
    await state(author, id, "in_review");
    await review(reviewer, id, "changes_requested", "Add supporting evidence.");
    await state(author, id, "draft");
    await expect(state(author, id, "in_review")).rejects.toThrow("invalid_transition");
    await save(author, { ...input, ru: { ...translation, body: "A revised explanation with supporting evidence and scientific results." } }, id);
    await state(author, id, "in_review");
    await expect(review(reviewer, id, "approved", "Stale approval.", 1)).rejects.toThrow("stale_version");
    await review(reviewer, id, "approved", "The revised evidence is sufficient.");
    expect((await db.query<Record<string, unknown>>("select content_version, decision from public.article_reviews where article_id = $1 order by content_version", [id])).rows)
      .toEqual([{ content_version: 1, decision: "changes_requested" }, { content_version: 2, decision: "approved" }]);
    await state(admin, id, "published");
  });

  it("supports optional editorial review and protects review writes", async () => {
    const id = await save();
    await state(author, id, "in_review");
    await review(editor, id, "approved", "Editorial review passed.");
    const listed = await asUser(author, () => db.query<Record<string, unknown>>("select * from public.list_article_reviews($1)", [id]));
    expect(listed.rows).toMatchObject([{ content_version: 1, reviewer_id: editor, decision: "approved", comment: "Editorial review passed." }]);
    await expect(asUser(editor, () => db.query("delete from public.article_reviews"))).rejects.toThrow(/permission denied/);
    for (const role of ["anon", "service_role"]) {
      await expect(asUser(null, () => db.query("select public.submit_article_review($1, 1, 'approved', 'Bypass')", [id]), role)).rejects.toThrow(/permission denied/);
    }
  });
});

describe("scientist atomic verification", () => {
  it("writes translations, fields and audit together, then resets verification on edit", async () => {
    const id = await saveScientist(); await verify(id);
    expect((await visible("scientist_profiles")).rows).toHaveLength(1);
    await saveScientist({ ...scientistInput, publicEmail: "updated@example.kz" }, id);
    expect((await db.query("select status, verified_at, verified_by from public.scientist_profiles where id = $1", [id])).rows[0]).toEqual({ status: "draft", verified_at: null, verified_by: null });
    expect((await visible("scientist_profiles")).rows).toHaveLength(0);
    expect((await db.query("select * from public.scientist_field_links")).rows).toHaveLength(1);
    expect((await db.query("select * from public.audit_logs where action = 'scientist.update'")).rows).toHaveLength(1);
  });
  it("keeps a verified profile unchanged when a translated slug conflicts", async () => {
    const id = await saveScientist(); await verify(id);
    await saveScientist({ ...scientistInput, ru: { ...scientistTranslation, slug: "other-scientist-ru" }, kk: { ...scientistTranslation, slug: "other-scientist-kk" } });
    const before = (await db.query("select * from public.scientist_profiles where id = $1", [id])).rows[0];
    await expect(saveScientist({ ...scientistInput, publicEmail: "changed@example.kz", fieldIds: [],
      ru: { ...scientistTranslation, slug: "renamed-scientist" }, kk: { ...scientistTranslation, slug: "other-scientist-kk" } }, id)).rejects.toThrow(/unique constraint/);
    expect((await db.query("select * from public.scientist_profiles where id = $1", [id])).rows[0]).toEqual(before);
    expect((await db.query("select * from public.scientist_field_links where scientist_profile_id = $1", [id])).rows).toHaveLength(1);
    expect((await db.query("select * from public.audit_logs where action = 'scientist.update'")).rows).toHaveLength(0);
    expect((await db.query("select * from public.slug_redirects")).rows).toHaveLength(0);
  });
  it("denies editing/verification to editorial roles and denies direct writes", async () => {
    const id = await saveScientist();
    await expect(saveScientist(scientistInput, id, author)).rejects.toThrow("forbidden");
    await expect(asUser(author, () => db.query("select public.change_scientist_state($1, 'verified', false)", [id]))).rejects.toThrow("forbidden");
    await expect(asUser(scientistManager, () => db.query("update public.scientist_profiles set status = 'verified', verified_at = now() where id = $1", [id]))).rejects.toThrow(/permission denied/);
    await verify(id);
    await expect(verify(id)).rejects.toThrow("invalid_transition");
  });
});

describe("permanent slug reservations", () => {
  it("reserves old article slugs after publication and exposes history only for public records", async () => {
    const id = await save(); await publish(id);
    await save(editor, { ...input, ru: { ...translation, slug: "article-renamed" } }, id);
    expect((await db.query("select entity_id, old_slug from public.slug_redirects")).rows).toEqual([{ entity_id: id, old_slug: "article-ru" }]);
    expect((await visible("slug_redirects")).rows).toHaveLength(0);
    expect((await visible("slug_redirects", admin)).rows).toHaveLength(0);
    await expect(save(otherAuthor, { ...input, kk: { ...input.kk, slug: "another-kk" } })).rejects.toThrow("slug_reserved");
    await publish(id);
    expect((await visible("slug_redirects")).rows).toHaveLength(1);
    await save(editor, { ...input, ru: { ...translation, slug: "article-final" } }, id);
    await publish(id);
    expect((await visible("slug_redirects")).rows).toHaveLength(2);
  });
  it("reserves old verified scientist slugs and permits reverting within the same entity", async () => {
    const id = await saveScientist(); await verify(id);
    await saveScientist({ ...scientistInput, ru: { ...scientistTranslation, slug: "scientist-renamed" } }, id);
    await expect(saveScientist({ ...scientistInput, kk: { ...scientistTranslation, slug: "another-scientist-kk" } })).rejects.toThrow("slug_reserved");
    await verify(id);
    expect((await visible("slug_redirects")).rows).toHaveLength(1);
    await saveScientist(scientistInput, id); await verify(id);
    expect((await visible("slug_redirects")).rows).toHaveLength(2);
  });
  it("does not reserve unpublished draft addresses", async () => {
    const id = await save();
    await save(author, { ...input, ru: { ...translation, slug: "draft-renamed" } }, id);
    expect((await db.query("select * from public.slug_redirects")).rows).toHaveLength(0);
  });
});

describe("article revision history", () => {
  it("upgrades existing publications without changing their approval or inventing history", () => {
    expect(revisionUpgrade).toEqual({ status: "published", content_version: 1, approved_version: 1, revision_count: 0 });
  });
  it("snapshots manual/review/publish with sequential numbers, but never ordinary saves or approval", async () => {
    const id = await save();
    await save(author, { ...input, ru: { ...translation, title: "Updated Russian title" } }, id);
    expect((await db.query("select * from public.article_revisions")).rows).toHaveLength(0);
    const revisionId = await createRevision(author, id, 2);
    await state(author, id, "in_review");
    await review(admin, id, "approved");
    expect((await db.query("select * from public.article_revisions")).rows).toHaveLength(2);
    await state(admin, id, "published");
    expect((await db.query("select revision_number, content_version, reason, created_by from public.article_revisions order by revision_number")).rows).toEqual([
      { revision_number: 1, content_version: 2, reason: "manual", created_by: author },
      { revision_number: 2, content_version: 2, reason: "review", created_by: author },
      { revision_number: 3, content_version: 2, reason: "publish", created_by: admin },
    ]);
    const snapshot = (await db.query<{ snapshot: Record<string, unknown> }>("select snapshot from public.article_revisions where id = $1", [revisionId])).rows[0].snapshot;
    expect(snapshot).toMatchObject({ ...input, ru: { ...translation, title: "Updated Russian title" } });
    expect(snapshot).not.toHaveProperty("authorId");
    expect(snapshot).not.toHaveProperty("status");
    expect((await db.query("select * from public.audit_logs where action = 'article.revision.create'")).rows).toHaveLength(3);
  });

  it("keeps history private even when the article is published, and rechecks reviewer assignment", async () => {
    const id = await save(); await createRevision(author, id);
    await assign(editor, id, reviewer); await publish(id);
    expect((await visible("article_revisions", author)).rows).toHaveLength(3);
    expect((await visible("article_revisions", admin)).rows).toHaveLength(3);
    expect((await visible("article_revisions", reviewer)).rows).toHaveLength(3);
    expect((await visible("article_revisions", otherAuthor)).rows).toHaveLength(0);
    expect((await visible("article_revisions", otherReviewer)).rows).toHaveLength(0);
    expect((await visible("article_revisions", scientistManager)).rows).toHaveLength(0);
    await expect(visible("article_revisions")).rejects.toThrow(/permission denied/);
    await state(admin, id, "draft"); await assign(editor, id, otherReviewer);
    expect((await visible("article_revisions", reviewer)).rows).toHaveLength(0);
    expect((await visible("article_revisions", otherReviewer)).rows).toHaveLength(3);
  });

  it("denies direct revision writes, internal helper execution and non-session RPCs", async () => {
    const id = await save(); const revisionId = await createRevision(author, id);
    for (const command of ["delete from public.article_revisions", "update public.article_revisions set snapshot = '{}'::jsonb"]) {
      await expect(asUser(admin, () => db.exec(command))).rejects.toThrow(/permission denied/);
    }
    await expect(asUser(admin, () => db.query("insert into public.article_revisions select * from public.article_revisions"))).rejects.toThrow(/permission denied/);
    await expect(asUser(admin, () => db.query("select public.capture_article_revision($1, 'manual')", [id]))).rejects.toThrow(/permission denied/);
    for (const role of ["anon", "service_role"]) {
      await expect(asUser(null, () => db.query("select public.create_article_revision($1, 1)", [id]), role)).rejects.toThrow(/permission denied/);
      await expect(asUser(null, () => db.query("select public.restore_article_revision($1, $2, 1)", [id, revisionId]), role)).rejects.toThrow(/permission denied/);
    }
    await expect(asUser(null, () => db.query("select public.create_article_revision($1, 1)", [id]))).rejects.toThrow("forbidden");
  });

  it("requires editorial write permissions for checkpoints and restore, beyond history read access", async () => {
    const id = await save(); const revisionId = await createRevision(author, id);
    await assign(editor, id, reviewer);
    for (const user of [otherAuthor, reviewer, scientistManager]) {
      await expect(createRevision(user, id)).rejects.toThrow("forbidden");
      await expect(restoreRevision(user, id, revisionId, 1)).rejects.toThrow("forbidden");
    }
    await publish(id);
    await expect(createRevision(author, id)).rejects.toThrow("forbidden");
    await expect(restoreRevision(author, id, revisionId, 1)).rejects.toThrow("forbidden");
    await state(admin, id, "archived");
    await expect(restoreRevision(editor, id, revisionId, 1)).rejects.toThrow("forbidden");
    await restoreRevision(admin, id, revisionId, 1);
  });

  it("rejects missing/stale versions without changing history or audit", async () => {
    const id = await save(); const revisionId = await createRevision(author, id);
    await save(author, input, id);
    const auditCount = (await db.query("select * from public.audit_logs")).rows.length;
    for (const version of [null, 1, 3]) {
      await expect(createRevision(author, id, version)).rejects.toThrow("stale_version");
      await expect(restoreRevision(author, id, revisionId, version)).rejects.toThrow("stale_version");
    }
    expect((await db.query("select * from public.article_revisions")).rows).toHaveLength(1);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(auditCount);
  });

  it("restores both languages, rich text, SEO and metadata as a new draft with a recovery checkpoint", async () => {
    const tag = "00000000-0000-4000-a000-000000000012";
    await db.query("insert into public.article_tags(id, slug, name_ru, name_kk) values ($1, 'revision-tag', 'Тег', 'Тег')", [tag]);
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: translation.body, marks: [{ type: "bold" }] }] }, { type: "image", attrs: { mediaId: cover, caption: "Historical caption" } }] };
    const original = { ...input, contentType: "news", categoryId: category, coverMediaId: cover, tagIds: [tag],
      ru: { ...translation, contentJson: document, seoTitle: "Historical SEO", seoDescription: "Historical description" },
      kk: { ...input.kk, title: "Қазақша тарихи тақырып" } };
    try {
      const id = await save(author, original); const revisionId = await createRevision(author, id);
      await save(author, { ...input, ru: { ...translation, title: "Newer Russian title", slug: "newer-ru" }, kk: { ...input.kk, title: "Newer Kazakh title" } }, id);
      await assign(editor, id, reviewer); await publish(id);
      const restored = await restoreRevision(editor, id, revisionId, 2);
      expect(restored.rows[0]).toEqual({ version: 3 });
      expect((await db.query("select status, approved_version, content_version, scientific_reviewer_id, content_type, category_id, cover_media_id from public.articles where id = $1", [id])).rows[0]).toEqual({
        status: "draft", approved_version: null, content_version: 3, scientific_reviewer_id: reviewer,
        content_type: "news", category_id: category, cover_media_id: cover,
      });
      expect((await db.query("select locale, title, slug, seo_title from public.article_translations where article_id = $1 order by locale", [id])).rows).toEqual([
        { locale: "kk", title: original.kk.title, slug: original.kk.slug, seo_title: null },
        { locale: "ru", title: translation.title, slug: translation.slug, seo_title: "Historical SEO" },
      ]);
      expect((await db.query("select content_json from public.article_translations where article_id = $1 and locale = 'ru'", [id])).rows[0]).toEqual({ content_json: document });
      expect((await db.query("select tag_id from public.article_tag_links where article_id = $1", [id])).rows).toEqual([{ tag_id: tag }]);
      expect((await db.query("select * from public.media_usages where entity_type = 'article' and entity_id = $1", [id])).rows).toHaveLength(2);
      const checkpoint = (await db.query<{ snapshot: { ru: { title: string }; kk: { title: string } } }>("select snapshot from public.article_revisions where article_id = $1 and reason = 'before_restore'", [id])).rows[0];
      expect(checkpoint.snapshot.ru.title).toBe("Newer Russian title");
      expect(checkpoint.snapshot.kk.title).toBe("Newer Kazakh title");
      expect((await visible("articles")).rows).toHaveLength(0);
      expect((await db.query("select user_id, new_data from public.audit_logs where action = 'article.revision.restore'")).rows[0]).toMatchObject({ user_id: editor, new_data: { revisionId, version: 3, status: "draft" } });
      expect((await db.query("select old_slug from public.slug_redirects where entity_id = $1", [id])).rows).toEqual([{ old_slug: "newer-ru" }]);
      await expect(state(admin, id, "published")).rejects.toThrow("forbidden");
    } finally {
      await db.query("delete from public.article_tag_links where tag_id = $1", [tag]);
      await db.query("delete from public.article_tags where id = $1", [tag]);
    }
  });

  it("rejects another article's revision even for editors", async () => {
    const id = await save(); const revisionId = await createRevision(author, id);
    const other = await save(otherAuthor, { ...input, ru: { ...translation, slug: "second-ru" }, kk: { ...input.kk, slug: "second-kk" } });
    await expect(restoreRevision(admin, other, revisionId, 1)).rejects.toThrow("not_found");
    expect((await db.query("select * from public.article_revisions")).rows).toHaveLength(1);
  });

  it("rolls back a conflicting historical slug including checkpoint, state, media, translations and audit", async () => {
    const id = await save(); const revisionId = await createRevision(author, id);
    await save(author, { ...input, ru: { ...translation, slug: "changed-ru" }, kk: { ...input.kk, slug: "changed-kk" } }, id);
    await save(otherAuthor, { ...input, ru: { ...translation, slug: "free-ru" } });
    await publish(id);
    const before = (await db.query("select * from public.articles where id = $1", [id])).rows[0];
    const translations = (await db.query("select * from public.article_translations where article_id = $1 order by locale", [id])).rows;
    const audits = (await db.query("select * from public.audit_logs")).rows.length;
    await expect(restoreRevision(editor, id, revisionId, 2)).rejects.toThrow(/unique constraint/);
    expect((await db.query("select * from public.articles where id = $1", [id])).rows[0]).toEqual(before);
    expect((await db.query("select * from public.article_translations where article_id = $1 order by locale", [id])).rows).toEqual(translations);
    expect((await db.query("select * from public.article_revisions where reason = 'before_restore'")).rows).toHaveLength(0);
    expect((await db.query("select * from public.slug_redirects")).rows).toHaveLength(0);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(audits);
  });

  it.each(["cover", "inline", "category"])("rolls back restoration when historical %s is unavailable", async reference => {
    const document = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: translation.body }] }, { type: "image", attrs: { mediaId: cover } }] };
    const value = { ...input, coverMediaId: reference === "cover" ? cover : null, categoryId: reference === "category" ? category : null,
      ru: { ...translation, contentJson: reference === "inline" ? document : undefined } };
    const id = await save(author, value); const revisionId = await createRevision(author, id);
    await save(author, input, id);
    const audits = (await db.query("select * from public.audit_logs")).rows.length;
    if (reference === "category") await db.query("update public.article_categories set is_active = false where id = $1", [category]);
    else await db.query("update public.media_assets set deleted_at = now() where id = $1", [cover]);
    try {
      await expect(restoreRevision(author, id, revisionId, 2)).rejects.toThrow("invalid_reference");
      expect((await db.query("select content_version from public.articles where id = $1", [id])).rows[0]).toEqual({ content_version: 2 });
      expect((await db.query("select * from public.article_revisions")).rows).toHaveLength(1);
      expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(audits);
    } finally {
      await db.query("update public.article_categories set is_active = true where id = $1", [category]);
      await db.query("update public.media_assets set deleted_at = null where id = $1", [cover]);
    }
  });

  it("keeps historical media references after edits and soft deletion and cleans them on hard deletion", async () => {
    const id = await save(author, { ...input, coverMediaId: cover }); const revisionId = await createRevision(author, id);
    await save(author, input, id);
    expect((await db.query("select entity_type, entity_id from public.media_usages where media_asset_id = $1", [cover])).rows).toEqual([{ entity_type: "article_revision", entity_id: revisionId }]);
    await state(admin, id, null, true);
    expect((await visible("article_revisions", admin)).rows).toHaveLength(0);
    await expect(restoreRevision(admin, id, revisionId, 2)).rejects.toThrow("not_found");
    expect((await db.query("select * from public.media_usages where entity_id = $1", [revisionId])).rows).toHaveLength(1);
    await db.query("delete from public.articles where id = $1", [id]);
    expect((await db.query("select * from public.article_revisions")).rows).toHaveLength(0);
    expect((await db.query("select * from public.media_usages where entity_id = $1", [revisionId])).rows).toHaveLength(0);
  });

  it("does not create a revision or audit entry when the workflow transaction fails", async () => {
    const id = await save();
    await db.query("delete from public.article_translations where article_id = $1 and locale = 'kk'", [id]);
    await expect(state(author, id, "in_review")).rejects.toThrow("invalid_input");
    expect((await db.query("select status from public.articles where id = $1", [id])).rows[0]).toEqual({ status: "draft" });
    expect((await db.query("select * from public.article_revisions")).rows).toHaveLength(0);
    expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(1);
  });
});
