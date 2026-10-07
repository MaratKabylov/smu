import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createMigrationDatabase } from "./database-schema.mjs";

const quote = value => JSON.stringify(value);

export async function generateDatabaseTypes(db) {
  const { rows: types } = await db.query(`
    select t.oid, t.typname, t.typtype, t.typcategory, t.typelem, t.typbasetype, n.nspname,
      (select c.relkind from pg_class c where c.oid = t.typrelid) as relation_kind,
      coalesce((select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid), '[]') as labels
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
  `);
  const byOid = new Map(types.map(type => [type.oid, type]));
  const typeName = oid => {
    const type = byOid.get(oid);
    if (!type) throw new Error(`Unknown PostgreSQL type OID ${oid}`);
    if (type.typcategory === "A" && type.typelem) return `(${typeName(type.typelem)})[]`;
    if (type.typtype === "d") return typeName(type.typbasetype);
    if (type.typtype === "e") return type.labels.map(quote).join(" | ");
    if (type.typtype === "c" && type.nspname === "public" && ["r", "p", "v", "m"].includes(type.relation_kind)) return `Database["public"]["${["v", "m"].includes(type.relation_kind) ? "Views" : "Tables"}"][${quote(type.typname)}]["Row"]`;
    if (["json", "jsonb"].includes(type.typname)) return "Json";
    if (["bool"].includes(type.typname)) return "boolean";
    if (["int2", "int4", "int8", "float4", "float8", "numeric", "oid"].includes(type.typname)) return "number";
    if (type.typname === "void") return "undefined";
    if (["text", "varchar", "bpchar", "name", "uuid", "date", "timestamp", "timestamptz", "time", "timetz", "interval", "bytea", "inet", "citext", "tsvector"].includes(type.typname)) return "string";
    throw new Error(`Unsupported PostgreSQL type ${type.nspname}.${type.typname}`);
  };
  const { rows: columns } = await db.query(`
    select c.relname as table_name, c.relkind as kind, a.attname as name, a.attnum, a.atttypid as type_oid,
      a.attnotnull as not_null, a.atthasdef as has_default, a.attidentity as identity, a.attgenerated as generated
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm') and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum
  `);
  const { rows: relationships } = await db.query(`
    select c.relname as table_name, con.conname as name, target.relname as target,
      (select json_agg(a.attname order by k.ordinality) from unnest(con.conkey) with ordinality k(num, ordinality)
        join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.num) as columns,
      (select json_agg(a.attname order by k.ordinality) from unnest(con.confkey) with ordinality k(num, ordinality)
        join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.num) as target_columns,
      exists(select 1 from pg_constraint u where u.conrelid = con.conrelid and u.contype in ('p', 'u') and u.conkey @> con.conkey and u.conkey <@ con.conkey) as one_to_one
    from pg_constraint con join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace join pg_class target on target.oid = con.confrelid
    join pg_namespace tn on tn.oid = target.relnamespace
    where n.nspname = 'public' and tn.nspname = 'public' and con.contype = 'f'
    order by c.relname, con.conname
  `);
  const { rows: checks } = await db.query(`
    select c.relname as table_name, a.attname as name, pg_get_constraintdef(con.oid) as definition
    from pg_constraint con join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where n.nspname = 'public' and con.contype = 'c' and array_length(con.conkey, 1) = 1
    order by c.relname, con.conname
  `);
  const checkedType = field => {
    const possible = checks.filter(check => check.table_name === field.table_name && check.name === field.name);
    for (const check of possible) {
      // Only exact, single-column text membership checks are narrowed. Other
      // CHECK expressions (including OR/NULL branches) retain their SQL type.
      const match = /^CHECK \(\((\w+) = ANY \(ARRAY\[(.*)\]\)\)\)$/.exec(check.definition);
      if (!match || match[1] !== field.name || typeName(field.type_oid) !== "string") continue;
      const literals = match[2].match(/'(?:[^']|'')*'::text/g);
      if (!literals?.length || literals.join(", ") !== match[2]) continue;
      return literals.map(literal => quote(literal.slice(1, -7).replaceAll("''", "'"))).join(" | ");
    }
    return typeName(field.type_oid);
  };
  const { rows: functions } = await db.query(`
    select p.proname as name, p.proargnames as names, p.proargtypes::oid[] as input_types,
      p.proallargtypes as all_types, p.proargmodes as modes, p.pronargdefaults as defaults,
      p.prorettype as return_type, p.proretset as returns_set
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prorettype <> 'trigger'::regtype
    order by p.proname, p.oid
  `);
  const lines = [
    "// Generated from executed supabase/migrations by npm run db:types. Do not edit.",
    "// JSON payloads and general CHECK expressions require application validation.",
    'export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];',
    "", "export type Database = {", "  public: {", "    Tables: {",
  ];
  for (const table of [...new Set(columns.filter(column => ["r", "p"].includes(column.kind)).map(column => column.table_name))]) {
    const fields = columns.filter(column => column.table_name === table);
    lines.push(`      ${quote(table)}: {`);
    for (const operation of ["Row", "Insert", "Update"]) {
      lines.push(`        ${operation}: {`);
      for (const field of fields) {
        const optional = operation === "Update" || operation === "Insert" && (!field.not_null || field.has_default || field.identity || field.generated);
        const tsType = operation !== "Row" && (field.generated || field.identity === "a") ? "never" : checkedType(field) + (field.not_null ? "" : " | null");
        lines.push(`          ${quote(field.name)}${optional ? "?" : ""}: ${tsType};`);
      }
      lines.push("        };");
    }
    lines.push("        Relationships: [");
    for (const relation of relationships.filter(relation => relation.table_name === table)) {
      lines.push(`          { foreignKeyName: ${quote(relation.name)}; columns: ${quote(relation.columns)}; isOneToOne: ${relation.one_to_one}; referencedRelation: ${quote(relation.target)}; referencedColumns: ${quote(relation.target_columns)} },`);
    }
    lines.push("        ];", "      };");
  }
  lines.push("    };", "    Views: {");
  for (const view of [...new Set(columns.filter(column => ["v", "m"].includes(column.kind)).map(column => column.table_name))]) {
    lines.push(`      ${quote(view)}: {`, "        Row: {");
    for (const field of columns.filter(column => column.table_name === view)) lines.push(`          ${quote(field.name)}: ${typeName(field.type_oid)} | null;`);
    lines.push("        };", "        Relationships: [];", "      };");
  }
  lines.push("    };", "    Functions: {");
  const seen = new Set();
  for (const fn of functions) {
    if (seen.has(fn.name)) throw new Error(`Overloaded RPC ${fn.name} requires explicit generator support`);
    seen.add(fn.name);
    const inputTypes = fn.input_types ?? [];
    const allTypes = fn.all_types ?? inputTypes;
    const modes = fn.modes ?? allTypes.map(() => "i");
    const args = allTypes.flatMap((oid, index) => ["i", "b", "v"].includes(modes[index]) ? [{ oid, name: fn.names?.[index] }] : []);
    if (args.some(arg => !arg.name)) throw new Error(`Unnamed RPC argument in ${fn.name}`);
    lines.push(`      ${quote(fn.name)}: {`, args.length ? "        Args: {" : "        Args: Record<string, never>;");
    for (const [index, arg] of args.entries()) {
      // SQL arguments are nullable; defaults also allow omission. RPC validators
      // decide which nulls are valid, rather than an inaccurate non-null cast.
      lines.push(`          ${quote(arg.name)}${index >= args.length - fn.defaults ? "?" : ""}: ${typeName(arg.oid)} | null;`);
    }
    if (args.length) lines.push("        };");
    const output = allTypes.flatMap((oid, index) => ["o", "b", "t"].includes(modes[index]) ? [`${quote(fn.names[index])}: ${typeName(oid)} | null`] : []);
    const returns = output.length ? `{ ${output.join("; ")} }` : typeName(fn.return_type);
    lines.push(`        Returns: ${fn.returns_set ? `(${returns})[]` : returns};`, "      };");
  }
  lines.push("    };", "    Enums: {");
  for (const type of types.filter(type => type.nspname === "public" && type.typtype === "e").sort((a, b) => a.typname.localeCompare(b.typname))) {
    lines.push(`      ${quote(type.typname)}: ${type.labels.map(quote).join(" | ")};`);
  }
  lines.push("    };", "    CompositeTypes: { [_ in never]: never };", "  };", "};", "", 'export type Tables<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];', 'export type Functions = Database["public"]["Functions"];', "");
  return lines.join("\n");
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--check")) throw new Error("Usage: node scripts/generate-database-types.mjs [--check]");
  const db = await createMigrationDatabase();
  try {
    const generated = await generateDatabaseTypes(db);
    const target = new URL("../src/types/database.types.ts", import.meta.url);
    if (process.argv.includes("--check")) {
      const committed = await readFile(target, "utf8");
      if (committed.replaceAll("\r\n", "\n") !== generated) throw new Error("Database types are stale. Run npm run db:types and commit the result.");
      console.log("Database types match all local migrations.");
    } else {
      const temporary = new URL(`${target.href}.${process.pid}.tmp`);
      try {
        await writeFile(temporary, generated, "utf8");
        await rename(temporary, target);
      } finally { await rm(temporary, { force: true }); }
      console.log("Generated src/types/database.types.ts from all local migrations.");
    }
  } finally { await db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
