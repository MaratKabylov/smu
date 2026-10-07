import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import { generateDatabaseTypes } from "../scripts/generate-database-types.mjs";

let db: PGlite;
let generated: string;

beforeAll(async () => {
  db = await createMigrationDatabase();
  generated = await generateDatabaseTypes(db);
}, 30000);
afterAll(async () => { await db?.close(); });

async function withSchema(sql: string, check: (types: string) => void) {
  await db.exec("begin");
  try {
    await db.exec(sql);
    check(await generateDatabaseTypes(db));
  } finally { await db.exec("rollback"); }
}

describe("migration-derived database types", () => {
  it("matches the committed contract and is deterministic", async () => {
    const committed = await readFile(new URL("../src/types/database.types.ts", import.meta.url), "utf8");
    expect(generated).toBe(committed.replaceAll("\r\n", "\n"));
    expect(await generateDatabaseTypes(db)).toBe(generated);
  });

  it("includes every public table, view and non-trigger function", async () => {
    const { rows: relations } = await db.query<{ name: string }>("select c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m')");
    const { rows: functions } = await db.query<{ name: string }>("select p.proname as name from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prorettype <> 'trigger'::regtype");
    for (const { name } of [...relations, ...functions]) expect(generated).toContain(`"${name}": {`);
    expect(generated).not.toContain('"handle_new_user":');
    expect(generated).not.toContain('"users":');
    expect(generated).not.toContain('"buckets":');
  });

  it("reflects added, removed and nullable columns", async () => {
    await withSchema("create table public.type_fixture(required text not null, optional integer, defaulted boolean not null default false); alter table public.type_fixture add column added text; alter table public.type_fixture drop column optional", types => {
      const table = types.slice(types.indexOf('"type_fixture": {'), types.indexOf('"user_roles": {'));
      expect(table).toContain('"required": string;');
      expect(table).toContain('"required"?: string;');
      expect(table).toContain('"defaulted"?: boolean;');
      expect(table).toContain('"added": string | null;');
      expect(table).toContain('"added"?: string | null;');
      expect(table).not.toContain('"optional"');
      expect(types).not.toBe(generated);
    });
  });

  it("preserves enums, arrays, JSON and generated/identity column rules", async () => {
    await withSchema(`
      create type public.type_fixture_enum as enum ('one', 'two');
      create table public.type_fixture (
        id bigint generated always as identity, options public.type_fixture_enum[] not null,
        payload jsonb, calculated integer generated always as (1 + 1) stored
      )
    `, types => {
      expect(types).toContain('"options": ("one" | "two")[];');
      expect(types).toContain('"payload": Json | null;');
      expect(types).toContain('"id"?: never;');
      expect(types).toContain('"calculated"?: never;');
      expect(types).toContain('"type_fixture_enum": "one" | "two";');
    });
  });

  it("narrows exact membership checks without narrowing general expressions", async () => {
    await withSchema(`create table public.type_fixture (
      locale text not null check(locale in ('ru', 'kk', 'en')),
      escaped text check(escaped in ('it''s', 'valid')),
      expression text check(expression in ('one', 'two') or length(expression) > 5)
    )`, types => {
      expect(types).toContain('"locale": "ru" | "kk" | "en";');
      expect(types).toContain('"escaped": "it\'s" | "valid" | null;');
      expect(types).toContain('"expression": string | null;');
    });
  });

  it("derives foreign keys and one-to-one relationships from constraints", async () => {
    await withSchema("create table public.type_fixture(id uuid primary key references public.articles(id), other uuid references public.articles(id))", types => {
      expect(types).toContain('{ foreignKeyName: "type_fixture_id_fkey"; columns: ["id"]; isOneToOne: true; referencedRelation: "articles"; referencedColumns: ["id"] }');
      expect(types).toContain('{ foreignKeyName: "type_fixture_other_fkey"; columns: ["other"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] }');
    });
  });

  it("derives RPC argument order, nullable values, defaults and table outputs", async () => {
    await withSchema(`create function public.type_fixture_rpc(p_id uuid, p_limit integer default 10)
      returns table(id uuid, total bigint) language sql as $$ select p_id, p_limit::bigint $$`, types => {
      expect(types).toContain('"p_id": string | null;');
      expect(types).toContain('"p_limit"?: number | null;');
      expect(types).toContain('Returns: ({ "id": string | null; "total": number | null })[];');
    });
  });

  it("includes views as nullable read projections and rejects unsupported SQL types", async () => {
    await withSchema("create view public.type_fixture_view as select id, content_version from public.articles", types => {
      expect(types).toContain('"type_fixture_view": {\n        Row: {\n          "id": string | null;\n          "content_version": number | null;');
    });
    await db.exec("begin");
    try {
      await db.exec("create table public.type_fixture(value point)");
      await expect(generateDatabaseTypes(db)).rejects.toThrow("Unsupported PostgreSQL type pg_catalog.point");
    } finally { await db.exec("rollback"); }
  });

  it("fails explicitly for overloaded RPCs instead of silently dropping a signature", async () => {
    await db.exec("begin");
    try {
      await db.exec("create function public.type_fixture_rpc(p_id uuid) returns uuid language sql as $$ select p_id $$; create function public.type_fixture_rpc(p_id text) returns text language sql as $$ select p_id $$");
      await expect(generateDatabaseTypes(db)).rejects.toThrow("Overloaded RPC type_fixture_rpc");
    } finally { await db.exec("rollback"); }
  });
});
