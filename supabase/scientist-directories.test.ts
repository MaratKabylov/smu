import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";

let db: PGlite;
const manager = "00000000-0000-4000-a000-000000000031";
const user = "00000000-0000-4000-a000-000000000032";

async function asRole<T>(actor: string | null, action: () => Promise<T>, role = actor ? "authenticated" : "anon") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return await action(); }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}

const fieldInput = (slug: string, patch: Record<string, unknown> = {}) => ({
  slug, nameRu: "Науки о Земле", nameKk: "Жер туралы ғылымдар", nameEn: "Earth sciences",
  parentId: null, isActive: true, ...patch,
});
const organizationInput = (slug: string, patch: Record<string, unknown> = {}) => ({
  slug, nameRu: "Региональный университет", nameKk: "Өңірлік университет", nameEn: "Regional University",
  cityRu: "Актобе", cityKk: "Ақтөбе", cityEn: "Aktobe", websiteUrl: "https://example.kz",
  organizationType: "university", isActive: true, ...patch,
});

async function save(kind: "field" | "organization", input: Record<string, unknown>, id: string | null = null, expected: string | null = null, actor = manager) {
  return asRole(actor, async () => (await db.query<{ id: string }>(
    "select public.save_scientist_taxonomy($1,$2,$3,$4) id",
    [kind, id, expected, JSON.stringify({ kind, ...input })],
  )).rows[0].id);
}

async function updatedAt(table: "scientific_fields" | "scientific_organizations", id: string) {
  return (await db.query<{ value: string }>(`select updated_at::text value from public.${table} where id=$1`, [id])).rows[0].value;
}

beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const [id, role, email] of [[manager, "scientist_manager", "manager@example.kz"], [user, "user", "user@example.kz"]]) {
    await db.query("insert into auth.users values($1,$2,'{}')", [id, email]);
    await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code=$2", [id, role]);
  }
}, 30_000);
beforeEach(async () => { await db.exec("truncate public.scientific_fields, public.scientific_organizations, public.audit_logs cascade"); });
afterAll(async () => { await db?.close(); });

describe("translated scientist directory management", () => {
  it("creates canonical translations, hierarchy and typed organizations atomically", async () => {
    const root = await save("field", fieldInput("earth-sciences"));
    const child = await save("field", fieldInput("hydrogeology", { nameRu: "Гидрогеология", nameKk: "Гидрогеология", parentId: root }));
    const organization = await save("organization", organizationInput("regional-university"));
    expect((await db.query("select parent_id from public.scientific_fields where id=$1", [child])).rows).toEqual([{ parent_id: root }]);
    expect((await db.query("select locale,name from public.scientific_field_translations where field_id=$1 order by locale", [root])).rows)
      .toEqual([{ locale: "en", name: "Earth sciences" }, { locale: "kk", name: "Жер туралы ғылымдар" }, { locale: "ru", name: "Науки о Земле" }]);
    expect((await db.query("select type,name_ru,city_ru from public.scientific_organizations where id=$1", [organization])).rows)
      .toEqual([{ type: "university", name_ru: "Региональный университет", city_ru: "Актобе" }]);
    expect((await db.query("select count(*)::int count from public.audit_logs")).rows).toEqual([{ count: 3 }]);
  });

  it("updates translations with optimistic locking and removes optional English", async () => {
    const id = await save("field", fieldInput("earth-sciences"));
    const expected = await updatedAt("scientific_fields", id);
    await save("field", fieldInput("geosciences", { nameRu: "Геонауки", nameKk: "Геоғылымдар", nameEn: null }), id, expected);
    expect((await db.query("select slug,name_ru,name_kk from public.scientific_fields where id=$1", [id])).rows)
      .toEqual([{ slug: "geosciences", name_ru: "Геонауки", name_kk: "Геоғылымдар" }]);
    expect((await db.query("select locale,name from public.scientific_field_translations where field_id=$1 order by locale", [id])).rows)
      .toEqual([{ locale: "kk", name: "Геоғылымдар" }, { locale: "ru", name: "Геонауки" }]);
    await expect(save("field", fieldInput("stale"), id, expected)).rejects.toThrow("stale_version");
  });

  it("rejects cycles and prevents an active child from becoming orphaned behind an inactive parent", async () => {
    const root = await save("field", fieldInput("root"));
    const child = await save("field", fieldInput("child", { parentId: root }));
    await expect(save("field", fieldInput("root", { parentId: child }), root, await updatedAt("scientific_fields", root))).rejects.toThrow("invalid_reference");
    await expect(save("field", fieldInput("root", { isActive: false }), root, await updatedAt("scientific_fields", root))).rejects.toThrow("invalid_transition");
    expect((await db.query("select parent_id,is_active from public.scientific_fields where id=$1", [root])).rows).toEqual([{ parent_id: null, is_active: true }]);
    const scientist = (await db.query<{ id: string }>("insert into public.scientist_profiles(created_by,status,verification_status,is_public,verified_at) values($1,'verified','verified',true,now()) returning id", [manager])).rows[0].id;
    await db.query("insert into public.scientist_profile_translations(scientist_profile_id,locale,full_name,slug,position,short_bio,biography) values($1,'ru','Иерархический исследователь','hierarchy-scientist','Исследователь','Исследования природных систем региона.','Подробное описание исследований природных систем и научных проектов региона.')", [scientist]);
    await db.query("insert into public.scientist_field_links values($1,$2,now())", [scientist, child]);
    const result = await asRole(null, async () => (await db.query<{ result: { total: number } }>("select public.search_public('ru','','scientists',$1) result", [JSON.stringify({ field: "root" })])).rows[0].result);
    expect(result.total).toBe(1);
  });

  it("enforces permissions, types and RLS visibility for inactive directory entries", async () => {
    const active = await save("organization", organizationInput("active"));
    const inactive = await save("organization", organizationInput("inactive", { isActive: false, organizationType: "ngo" }));
    await expect(save("organization", organizationInput("denied"), null, null, user)).rejects.toThrow("forbidden");
    await expect(save("organization", organizationInput("invalid", { organizationType: "laboratory" }))).rejects.toThrow("invalid_input");
    await expect(save("organization", organizationInput("extra", { internalNote: "must not enter audit" }))).rejects.toThrow("invalid_input");
    await expect(save("field", fieldInput("typed", { isActive: "true" }))).rejects.toThrow("invalid_input");
    await expect(asRole(manager, () => db.query("select public.create_scientist_taxonomy('{}')"))).rejects.toThrow("permission denied");
    for (const actor of [null, user]) {
      const rows = await asRole(actor, () => db.query<{ id: string }>("select id from public.scientific_organizations order by id"));
      expect(rows.rows.map(row => row.id)).toEqual([active]);
      expect((await asRole(actor, () => db.query<{ organization_id: string }>("select organization_id from public.scientific_organization_translations order by organization_id"))).rows.every(row => row.organization_id === active)).toBe(true);
    }
    const managed = await asRole(manager, () => db.query<{ id: string }>("select id from public.scientific_organizations order by id"));
    expect(new Set(managed.rows.map(row => row.id))).toEqual(new Set([active, inactive]));
  });
});
