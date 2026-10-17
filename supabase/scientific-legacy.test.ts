import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import type { LegacyInput, LegacyOwnerItem } from "../src/lib/validation/scientific-legacy";
let db: PGlite;
const own = "00000000-0000-4000-a000-000000000091", other = "00000000-0000-4000-a000-000000000092", admin = "00000000-0000-4000-a000-000000000093", unconfirmed = "00000000-0000-4000-a000-000000000094", anonymous = "00000000-0000-4000-a000-000000000095";
const input = (extra: Partial<LegacyInput> = {}): LegacyInput => ({ id: null, version: null, kind: "archive", status: "published", translations: ["ru", "kk"].map(locale => ({ locale: locale as "ru" | "kk", title: "Research archive", description: "Public description of a research archive." })), sourceText: "SECRET UNPUBLISHED DATA", sourceUrl: "https://archive.example/private?token=SECRET", rightsConfirmed: true, ...extra });
async function run<T = Record<string, unknown>>(actor: string | null, sql: string, params: unknown[] = [], role = actor ? "authenticated" : "anon") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return (await db.query<T>(sql, params)).rows; }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}
async function save(data: unknown = input(), actor = own) { return (await run<{ id: string }>(actor, "select public.save_scientific_legacy($1) id", [JSON.stringify(data)]))[0].id; }
async function list(actor: string | null = null, id: string | null = null, ownView = false, locale = "ru", page = 1, kind = "all") {
  return (await run<{ data: { total: number; items: LegacyOwnerItem[] } }>(actor, "select public.list_scientific_legacy($1,$2,$3,$4,$5) data", [locale, page, id, ownView, kind]))[0].data;
}
const consent = (id: string, version: number, granted: boolean | null = true, actor = own) => run(actor, "select public.set_scientific_legacy_consent($1,$2,$3)", [id, version, granted]);
beforeAll(async () => {
  db = await createMigrationDatabase({ through: 33 });
  await db.exec("alter table auth.users add column email_confirmed_at timestamptz; alter table auth.users add column is_anonymous boolean default false");
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const id of [own, other, admin, unconfirmed, anonymous]) await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values($1,$2,$3,$4,'{\"role\":\"super_admin\"}')", [id, `${id}@example.org`, id === unconfirmed ? null : "2026-10-17", id === anonymous]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='super_admin'", [admin]);
  await db.exec(await readFile(new URL("./migrations/034_scientific_legacy.sql", import.meta.url), "utf8"));
}, 30000);
beforeEach(async () => { await db.exec("truncate public.scientific_legacy,public.audit_logs"); });
afterAll(async () => { await db?.close(); });

describe("scientific legacy ownership and explicit source consent", () => {
  it("publishes metadata while keeping all source fields private by default", async () => {
    const id = await save();
    const publicData = await list(null, id);
    expect(publicData.items[0]).toMatchObject({ id, sourceText: "", sourceUrl: "" });
    expect(JSON.stringify(publicData)).not.toMatch(/SECRET|owner|consent|version/);
    expect((await list(own, id, true)).items[0]).toMatchObject({ version: 1, sourceConsent: false, sourceText: "SECRET UNPUBLISHED DATA" });
    expect(JSON.stringify(await list(own, null, true))).not.toContain("SECRET");
  });
  it("opens only the saved version, omits source from catalogues and records minimal consent evidence", async () => {
    const id = await save(); await consent(id, 1);
    expect((await list(null, id)).items[0].sourceText).toBe("SECRET UNPUBLISHED DATA");
    expect(JSON.stringify(await list())).not.toContain("SECRET");
    const row = (await list(own, id, true)).items[0]; expect(row).toMatchObject({ version: 2, sourceConsent: true }); expect(row.consentAt).toBeTruthy();
    const audits = (await db.query<{ new_data: unknown }>("select new_data from public.audit_logs order by created_at,action")).rows;
    expect(audits).toContainEqual({ new_data: { version: 2, granted: true, policy: "legacy-source-v1" } });
    expect(JSON.stringify(audits)).not.toMatch(/SECRET|@|source_text|translations/);
  });
  it("revokes access immediately and rejects replay of previously confirmed permission", async () => {
    const id = await save(); await consent(id, 1); await consent(id, 2, false);
    expect((await list(null, id)).items[0].sourceText).toBe("");
    await expect(consent(id, 1)).rejects.toThrow("stale_version");
    expect((await list(own, id, true)).items[0]).toMatchObject({ version: 3, sourceConsent: false, consentAt: null });
    const count = (await db.query("select * from public.audit_logs")).rows.length;
    await consent(id, 3, false); expect((await db.query("select * from public.audit_logs")).rows).toHaveLength(count);
  });
  it("resets permission on content edits, retains first publication time and blocks stale editors", async () => {
    const id = await save(); const before = (await db.query<{ published_at: string }>("select published_at from public.scientific_legacy where id=$1", [id])).rows[0];
    await consent(id, 1);
    await expect(save(input({ id, version: 1 }))).rejects.toThrow("stale_version");
    await save(input({ id, version: 2, sourceText: "NEW SECRET" }));
    expect((await list(null, id)).items[0].sourceText).toBe("");
    expect((await list(own, id, true)).items[0]).toMatchObject({ version: 3, sourceConsent: false, consentAt: null });
    expect((await db.query("select published_at from public.scientific_legacy where id=$1", [id])).rows[0]).toEqual(before);
  });
  it("restricts private reads, saves and grants to the owner even for super_admin", async () => {
    const id = await save();
    for (const actor of [other, admin]) {
      expect((await list(actor, id, true)).items).toEqual([]);
      expect((await list(actor, id)).items[0].sourceText).toBe("");
      await expect(save(input({ id, version: 1 }), actor)).rejects.toThrow("not_found");
      await expect(consent(id, 1, true, actor)).rejects.toThrow("not_found");
    }
    // No owner/consent fields in the payload can change database ownership or publish sources.
    const forged = await save({ ...input(), owner_id: other, consent_version: 1, sourceConsent: true, translations: input().translations.map(t => ({ ...t, secret: "PRIVATE EXTRA" })) });
    expect((await list(other, forged, true)).items).toEqual([]);
    expect(JSON.stringify(await list(null, forged))).not.toMatch(/SECRET|PRIVATE EXTRA/);
  });
  it("requires a confirmed nonanonymous account and never trusts metadata", async () => {
    for (const actor of [unconfirmed, anonymous]) {
      await expect(save(input(), actor)).rejects.toThrow("forbidden");
      await expect(list(actor, null, true)).rejects.toThrow("forbidden");
    }
    await expect(run(null, "select public.save_scientific_legacy($1)", [JSON.stringify(input())])).rejects.toThrow("permission denied");
    await expect(list(null, null, true)).rejects.toThrow("forbidden");
  });
  it("denies direct table access and service-role mutation and RPC access", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      await expect(run(own, "select * from public.scientific_legacy", [], role)).rejects.toThrow("permission denied");
      await expect(run(own, "delete from public.scientific_legacy", [], role)).rejects.toThrow("permission denied");
      await expect(run(own, "update public.scientific_legacy set consent_version=version,consent_at=now()", [], role)).rejects.toThrow("permission denied");
    }
    await expect(run(own, "select public.save_scientific_legacy($1)", [JSON.stringify(input())], "service_role")).rejects.toThrow("permission denied");
  });
  it("hides drafts, archived and future records regardless of session and grants", async () => {
    const id = await save(); await consent(id, 1);
    for (const status of ["draft", "archived"] as const) {
      await save(input({ id, version: (await list(own, id, true)).items[0].version, status }));
      expect((await list(admin, id)).items).toEqual([]);
      await expect(consent(id, (await list(own, id, true)).items[0].version)).rejects.toThrow("invalid_input");
    }
    await db.query("update public.scientific_legacy set status='published',published_at=now()+interval '1 day' where id=$1", [id]);
    expect((await list()).items).toEqual([]);
  });
  it("requires real explicit permission and valid source content", async () => {
    await expect(save({ ...input(), rightsConfirmed: false })).rejects.toThrow("invalid_input");
    const id = await save(input({ sourceText: "", sourceUrl: "" }));
    await expect(consent(id, 1)).rejects.toThrow("invalid_input");
    await expect(consent(id, 1, null)).rejects.toThrow("invalid_input");
    for (const sourceUrl of ["javascript:alert(1)", "//example.org", "https://user:pass@example.org/", "https://example.org/\nsecret"]) await expect(save(input({ sourceUrl }))).rejects.toThrow("invalid_input");
  });
  it("validates translations, types, lengths, pagination and locale independently in SQL", async () => {
    for (const bad of [input({ translations: [input().translations[0], input().translations[0]] }), input({ translations: input().translations.slice(0, 1) }), input({ translations: input().translations.map(t => ({ ...t, title: "x" })) }), { ...input(), kind: "invalid" }, input({ sourceText: "x".repeat(100001) }), input({ id: crypto.randomUUID(), version: null })]) await expect(save(bad)).rejects.toThrow();
    await expect(list(null, null, false, "de")).rejects.toThrow("invalid_input");
    await expect(list(null, null, false, "ru", 0)).rejects.toThrow("invalid_input");
    await expect(list(null, null, false, "ru", 1, "invalid")).rejects.toThrow("invalid_input");
  });
  it("uses exact public translations, all owner translations and stable paginated type filters", async () => {
    const id = await save(); expect((await list(null, id, false, "en")).items).toEqual([]);
    expect((await list(own, id, true, "en")).items[0].translations).toHaveLength(2);
    await save(input({ translations: [...input().translations, { locale: "en", title: "English archive", description: "Public English archive description." }], kind: "methodology" }));
    expect((await list(null, null, false, "en")).total).toBe(1);
    expect((await list(null, null, false, "ru", 1, "methodology")).items).toHaveLength(1);
    for (let i = 0; i < 20; i++) await save();
    const first = await list(); const second = await list(null, null, false, "ru", 2);
    expect(first.total).toBe(22); expect(first.items).toHaveLength(20); expect(second.items).toHaveLength(2);
    expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(22);
  });
  it("rolls back saves and consent changes when audit fails", async () => {
    const id = await save();
    await db.exec("create function public.test_legacy_audit_failure() returns trigger language plpgsql as $$ begin raise exception 'audit_failed'; end $$; create trigger fail_legacy_audit before insert on public.audit_logs for each row execute function public.test_legacy_audit_failure()");
    try {
      await expect(consent(id, 1)).rejects.toThrow("audit_failed");
      expect((await list(own, id, true)).items[0]).toMatchObject({ version: 1, sourceConsent: false });
      await expect(save(input({ id, version: 1, sourceText: "Changed secret" }))).rejects.toThrow("audit_failed");
      expect((await list(own, id, true)).items[0].sourceText).toBe("SECRET UNPUBLISHED DATA");
      await expect(save()).rejects.toThrow("audit_failed"); expect((await list()).total).toBe(1);
    } finally { await db.exec("drop trigger fail_legacy_audit on public.audit_logs; drop function public.test_legacy_audit_failure()"); }
  });
});
