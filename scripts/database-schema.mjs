import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Minimal platform objects used by the application migrations. Public types
// come from executed migrations, never from these Auth/Storage stand-ins.
export async function createMigrationDatabase() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key, bucket_id text);
      alter table storage.objects enable row level security;
      grant usage on schema public, auth, storage to anon, authenticated, service_role;
    `);
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const files = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), "utf8");
      // PGlite provides gen_random_uuid() but does not bundle pgcrypto.
      await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}
