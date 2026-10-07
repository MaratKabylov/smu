import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Functions, Json } from "@/types/database.types";

export type DatabaseClient = SupabaseClient<Database>;

const jsonSchema: z.ZodType<Json> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonSchema),
  // Supabase's JSON serialization omits optional undefined object properties.
  z.record(z.string(), jsonSchema.optional()),
]));

// PostgreSQL JSONB does not describe the payload's domain schema. Validate it
// at the service boundary, then convert it to the wire type without an any cast.
export function databaseJson(value: unknown): Json {
  return jsonSchema.parse(value);
}

export async function callDatabaseRpc<Name extends keyof Functions>(
  client: DatabaseClient,
  name: Name,
  args: Functions[Name]["Args"],
): Promise<Functions[Name]["Returns"]> {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  // Supabase's conditional filter-builder type cannot resolve a generic RPC.
  // The name, arguments and result all come from the same generated signature.
  return data as Functions[Name]["Returns"];
}

export function requiredFields<Row, Key extends keyof Row>(row: Row, ...keys: Key[]): Row & { [Field in Key]-?: NonNullable<Row[Field]> } {
  for (const key of keys) {
    if (row[key] === null || row[key] === undefined) throw new Error(`Missing database field: ${String(key)}`);
  }
  return row as Row & { [Field in Key]-?: NonNullable<Row[Field]> };
}
