import type { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import { publicSiteContentSchema, siteContentCatalogSchema } from "../src/lib/validation/site-content";

let db: PGlite;
const owner = "00000000-0000-4000-a000-000000000301";
const manager = "00000000-0000-4000-a000-000000000302";
const member = "00000000-0000-4000-a000-000000000303";
const admin = "00000000-0000-4000-a000-000000000304";
const translation = (locale: string, body = "First paragraph.\n\nSecond paragraph.") => ({ locale, title: `Title ${locale}`, summary: "Summary", body, cta_label: "Apply", cta_href: "/ru/support" });
const pageData = (status = "draft") => ({ status, translations: [translation("ru"), translation("kk")] });
const sectionData = (enabled = true, order = 5) => ({ enabled, sort_order: order, display_limit: 4, titles: { ru: "Наука", kk: "Ғылым", en: "Science" } });
async function run(actor: string | null, sql: string, params: unknown[] = [], role = "authenticated") {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  try { return await db.query<Record<string, unknown>>(sql, params); }
  finally { await db.exec("reset role; reset request.jwt.claim.sub"); }
}
async function save(kind: string, key: string, version: number, data: unknown, actor = manager) {
  return (await run(actor, "select public.save_site_content($1,$2,$3,$4) version", [kind, key, version, JSON.stringify(data)])).rows[0].version;
}
async function publicContent(locale = "ru", key = "about", actor: string | null = null) {
  return publicSiteContentSchema.parse((await run(actor, "select public.read_public_site_content($1,$2) data", [locale, key], actor ? "authenticated" : "anon")).rows[0].data);
}
beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const id of [owner, manager, member, admin]) await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${id}@example.org`]);
  for (const [id, role] of [[owner, "super_admin"], [manager, "content_manager"], [admin, "admin"]])
    await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2", [id, role]);
}, 30000);
beforeEach(async () => {
  await db.exec("delete from public.content_page_translations; update public.content_pages set version=0,status='draft'; update public.homepage_sections set enabled=false,version=0; delete from public.audit_logs");
  await db.exec(`update public.app_settings set version=0,value=case key when 'site_name' then '"СМУ"'::jsonb when 'contact_email' then '""'::jsonb else '[]'::jsonb end`);
});
afterAll(async () => { await db?.close(); });

it("keeps raw configuration and translations closed even to service role", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) for (const table of ["content_pages", "content_page_translations", "homepage_sections", "app_settings"]) {
    await expect(run(owner, `select * from public.${table}`, [], role)).rejects.toThrow("permission denied");
    await expect(run(owner, `delete from public.${table}`, [], role)).rejects.toThrow("permission denied");
  }
  for (const role of ["anon", "service_role"]) {
    await expect(run(owner, "select public.list_site_content()", [], role)).rejects.toThrow("permission denied");
    await expect(run(owner, "select public.save_site_content('page','about',0,'{}')", [], role)).rejects.toThrow("permission denied");
  }
});
it("gives content staff fixed templates and slots but reserves settings for super admins", async () => {
  const catalog = siteContentCatalogSchema.parse((await run(manager, "select public.list_site_content() data")).rows[0].data);
  expect(catalog.pages).toHaveLength(9); expect(catalog.sections).toHaveLength(11); expect(catalog.settings).toEqual([]);
  expect(catalog.pages.find(p => p.key === "it_support")?.template).toBe("support");
  expect(siteContentCatalogSchema.parse((await run(owner, "select public.list_site_content() data")).rows[0].data).settings).toHaveLength(3);
  await expect(run(member, "select public.list_site_content()")).rejects.toThrow("forbidden");
  await expect(run(null, "select public.list_site_content()")).rejects.toThrow("forbidden");
  for (const actor of [admin, manager, member]) await expect(save("setting", "site_name", 0, { value: "New" }, actor)).rejects.toThrow("forbidden");
  expect(await save("page", "about", 0, pageData(), admin)).toBe(1);
});
it("saves all translations atomically and exposes only published translations regardless of session", async () => {
  expect(await save("page", "about", 0, pageData())).toBe(1);
  expect((await run(null, "select * from public.list_public_content_paths()", [], "anon")).rows).toEqual([]);
  for (const actor of [null, owner]) expect((await publicContent("ru", "about", actor)).page).toBeNull();
  expect(await save("page", "about", 1, pageData("published"))).toBe(2);
  expect((await publicContent()).page).toMatchObject({ title: "Title ru", locales: ["kk", "ru"], template: "standard" });
  expect((await publicContent("kk")).page?.title).toBe("Title kk");
  expect((await run(owner, "select locale from public.list_public_content_paths()")).rows).toEqual([{ locale: "kk" }, { locale: "ru" }]);
  expect((await publicContent("en")).page).toBeNull();
  expect((await publicContent("ru", "unknown")).page).toBeNull();
  await save("page", "about", 2, { status: "published", translations: [...pageData().translations, translation("en")] });
  expect((await publicContent("en")).page?.title).toBe("Title en");
  await save("page", "about", 3, pageData());
  expect((await publicContent("ru", "about", owner)).page).toBeNull();
  expect((await run(owner, "select * from public.list_public_content_paths()")).rows).toEqual([]);
});
it("rejects stale saves and malformed/duplicate/incomplete translations without partial state or audit", async () => {
  await save("page", "about", 0, pageData("published"));
  await expect(save("page", "about", 0, pageData())).rejects.toThrow("stale_version");
  for (const data of [
    { ...pageData(), template: "arbitrary" }, { status: "unknown", translations: [] }, { status: "published", translations: [translation("ru")] },
    { status: "draft", translations: [translation("ru"), translation("ru")] }, { status: "draft", translations: [translation("de")] },
    { status: "draft", translations: [{ ...translation("ru"), body: " " }] },
    { status: "draft", translations: [{ ...translation("ru"), title: 55 }] },
    { status: "draft", translations: [{ ...translation("ru"), cta_href: "javascript:alert(1)" }] },
    { status: "draft", translations: [{ ...translation("ru"), cta_label: "" }] },
    { status: "draft", translations: [null] },
  ]) await expect(save("page", "about", 1, data)).rejects.toThrow("invalid_input");
  expect((await publicContent()).page?.title).toBe("Title ru");
  expect((await db.query<{ count: number }>("select count(*)::int count from public.audit_logs")).rows[0].count).toBe(1);
});
it("filters disabled slots, applies language overrides, bounds limits, and orders ties by key", async () => {
  expect(await save("section", "events", 0, sectionData())).toBe(1);
  await save("section", "latest_articles", 0, sectionData());
  await save("section", "hero", 0, sectionData(false, 0));
  const content = await publicContent("kk");
  expect(content.sections.map(s => s.key)).toEqual(["events", "latest_articles"]);
  expect(content.sections[0]).toMatchObject({ display_limit: 4, title: "Ғылым" });
  expect(JSON.stringify(content)).not.toContain("updated_by");
  for (const data of [{ ...sectionData(), display_limit: 13 }, { ...sectionData(), enabled: "true" }, { ...sectionData(), sort_order: -1 },
    { ...sectionData(), titles: { de: "Unknown" } }, { ...sectionData(), titles: { ru: {} } }, { ...sectionData(), html: "<script>" }])
    await expect(save("section", "hero", 1, data)).rejects.toThrow("invalid_input");
  await expect(save("section", "arbitrary", 0, sectionData())).rejects.toThrow("not_found");
});
it("validates allowlisted public settings and never accepts secrets or unsafe links", async () => {
  await save("setting", "site_name", 0, { value: "Scientific platform" }, owner);
  await save("setting", "contact_email", 0, { value: "science@example.org" }, owner);
  await save("setting", "social_links", 0, { value: [{ label: "Science", href: "https://example.org/path?q=1" }] }, owner);
  expect((await publicContent()).settings).toEqual({ site_name: "Scientific platform", contact_email: "science@example.org", social_links: [{ label: "Science", href: "https://example.org/path?q=1" }] });
  await expect(save("setting", "RESEND_API_KEY", 0, { value: "secret" }, owner)).rejects.toThrow("not_found");
  for (const value of ["bad\r\nBcc:x@example.org", "bad", 10, {}]) await expect(save("setting", "contact_email", 1, { value }, owner)).rejects.toThrow("invalid_input");
  for (const href of ["//evil.org", "/\\evil.org", "javascript:alert(1)", "http://example.org", "https://user:pass@example.org", "https://example.org/\npath"]) {
    await expect(save("setting", "social_links", 1, { value: [{ label: "Bad", href }] }, owner)).rejects.toThrow("invalid_input");
  }
  await expect(save("setting", "social_links", 1, { value: [{ label: "No href" }] }, owner)).rejects.toThrow("invalid_input");
});
it("rolls translations, settings, slots and version back on audit failure", async () => {
  await save("page", "about", 0, pageData("published"));
  await db.exec(`create function public.fail_content_audit() returns trigger language plpgsql as $$begin raise exception 'audit_failed'; end$$;
    create trigger fail_content_audit before insert on public.audit_logs for each row execute function public.fail_content_audit()`);
  try {
    await expect(save("page", "about", 1, { status: "published", translations: [translation("ru", "Changed"), translation("kk")] })).rejects.toThrow("audit_failed");
    await expect(save("section", "hero", 0, sectionData())).rejects.toThrow("audit_failed");
    await expect(save("setting", "site_name", 0, { value: "Changed" }, owner)).rejects.toThrow("audit_failed");
    expect((await publicContent()).page?.body).toContain("First paragraph");
    expect((await publicContent()).sections).toEqual([]);
    expect((await publicContent()).settings.site_name).toBe("СМУ");
  } finally { await db.exec("drop trigger fail_content_audit on public.audit_logs; drop function public.fail_content_audit()"); }
});
it("audits only key and version, without page text, contacts or social values", async () => {
  await save("page", "about", 0, pageData());
  await save("setting", "contact_email", 0, { value: "private@example.org" }, owner);
  const records = (await db.query("select entity_type,action,new_data from public.audit_logs order by created_at")).rows;
  expect(records).toEqual([
    { entity_type: "content_page", action: "saved", new_data: { key: "about", version: 1 } },
    { entity_type: "app_setting", action: "saved", new_data: { key: "contact_email", version: 1 } },
  ]);
});
it("upgrades populated 040 without rewriting existing articles or role grants", async () => {
  const old = await createMigrationDatabase({ through: 40 });
  try {
    await old.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
    await old.exec("delete from public.role_permissions where permission_id in (select id from public.permissions where code='content.manage'); delete from public.permissions where code='content.manage'");
    await old.query("insert into auth.users(id,email) values($1,'existing@example.org')", [owner]);
    await old.query("insert into public.articles(author_id) values($1)", [owner]);
    const before = (await old.query("select to_jsonb(a) data from public.articles a")).rows;
    await old.exec("insert into public.audit_logs(entity_type,action) values('existing','preserved')");
    await old.exec(await readFile(new URL("./migrations/041_site_content.sql", import.meta.url), "utf8"));
    expect((await old.query("select action from public.audit_logs")).rows).toEqual([{ action: "preserved" }]);
    expect((await old.query("select to_jsonb(a) data from public.articles a")).rows).toEqual(before);
    expect((await old.query<{ count: number }>("select count(*)::int count from public.content_pages")).rows[0].count).toBe(9);
    expect((await old.query("select r.code from public.role_permissions rp join public.roles r on r.id=rp.role_id join public.permissions p on p.id=rp.permission_id where p.code='content.manage' order by r.code")).rows).toEqual([{ code: "admin" }, { code: "content_manager" }, { code: "super_admin" }]);
  } finally { await old.close(); }
}, 30000);
