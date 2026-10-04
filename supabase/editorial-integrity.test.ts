import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
async function publish(id: string) {
  await state(author, id, "in_review");
  await state(admin, id, "approved");
  await state(admin, id, "published");
}
async function saveScientist(value: unknown = scientistInput, id: string | null = null, user = scientistManager) {
  return asUser(user, async () => (await db.query<{ id: string }>(
    "select public.save_scientist($1, $2::jsonb) as id", [id, JSON.stringify(value)],
  )).rows[0].id);
}
const verify = (id: string) => asUser(scientistManager, () => db.query("select public.change_scientist_state($1, 'verified', false)", [id]));
const visible = (table: string, user: string | null = null) => asUser(user, () => db.query("select * from public." + table), user ? "authenticated" : "anon");
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
  await db.exec("delete from public.articles; delete from public.scientist_profiles; delete from public.slug_redirects; delete from public.audit_logs;");
});

describe("session-authorized editorial transactions", () => {
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
    await state(reviewer, id, "approved");
    expect((await db.query("select approved_version, content_version from public.articles where id = $1", [id])).rows[0]).toEqual({ approved_version: 1, content_version: 1 });
  });
  it("validates reviewer assignment and locks it after approval", async () => {
    const id = await save();
    await expect(assign(author, id, reviewer)).rejects.toThrow("forbidden");
    await expect(assign(editor, id, author)).rejects.toThrow("invalid_reference");
    await assign(editor, id, reviewer);
    await state(author, id, "in_review"); await state(reviewer, id, "approved");
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
    await state(author, id, "in_review"); await state(admin, id, "approved");
    await db.query("update public.articles set content_version = 2 where id = $1", [id]);
    await expect(state(admin, id, "published")).rejects.toThrow("invalid_transition");
  });
  it("rejects approval from a stale review page or an RPC without a version", async () => {
    const id = await save();
    await assign(editor, id, reviewer);
    await state(author, id, "in_review");
    await save(editor, { ...input, ru: { ...translation, title: "An updated scientific article" } }, id);
    await state(author, id, "in_review");
    await expect(asUser(reviewer, () => db.query("select public.change_article_state($1, 'approved', false, 1)", [id]))).rejects.toThrow("stale_version");
    await expect(asUser(reviewer, () => db.query("select public.change_article_state($1, 'approved', false)", [id]))).rejects.toThrow("stale_version");
    await state(reviewer, id, "approved");
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
    await state(admin, id, "approved");
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
