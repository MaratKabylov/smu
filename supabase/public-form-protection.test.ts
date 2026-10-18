import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
let db: PGlite;
const network = "a".repeat(64), email = "b".repeat(64);
const key = (n: number) => n.toString(16).padStart(64, "0");
async function consume(net = network, contact = email) {
  await db.exec("set role service_role");
  try { return (await db.query<{ allowed: boolean }>("select public.consume_public_form_limit($1,$2) allowed", [net,contact])).rows[0].allowed; }
  finally { await db.exec("reset role"); }
}
beforeAll(async () => {
  db = await createMigrationDatabase({ through: 36 });
  await db.exec("insert into public.support_requests(id,kind,locale,title,description,contact_name,email,details) values('00000000-0000-4000-a000-000000000001','it_request','ru','Existing request','Existing description','Existing contact','existing@example.org','{}')");
  await db.exec(await readFile(new URL("./migrations/037_public_form_protection.sql", import.meta.url), "utf8"));
}, 30000);
beforeEach(async () => { await db.exec("truncate public.public_form_limits"); });
afterAll(async () => { await db?.close(); });
it("is also present on a clean install", async () => {
  const fresh = await createMigrationDatabase();
  try { expect((await fresh.query("select count(*)::integer n from public.public_form_limits")).rows[0]).toEqual({ n: 0 }); }
  finally { await fresh.close(); }
}, 30000);
it("blocks direct table access and public RPC calls", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec("set role " + role);
    try {
      for (const sql of ["select * from public.public_form_limits", "delete from public.public_form_limits", "insert into public.public_form_limits values ('email_day:"+email+"',1,now())"]) await expect(db.query(sql)).rejects.toThrow("permission denied");
      if (role !== "service_role") await expect(db.query("select public.consume_public_form_limit($1,$2)", [network,email])).rejects.toThrow("permission denied");
    } finally { await db.exec("reset role"); }
  }
  expect((await db.query("select relrowsecurity enabled from pg_class where oid='public.public_form_limits'::regclass")).rows[0]).toEqual({ enabled: true });
});
it("allows three email attempts across different networks and leaves counters untouched on denial", async () => {
  for (let n=1;n<=3;n++) expect(await consume(key(n))).toBe(true);
  const before = (await db.query("select * from public.public_form_limits order by key")).rows;
  expect(await consume(key(4))).toBe(false);
  expect((await db.query("select * from public.public_form_limits order by key")).rows).toEqual(before);
});
it("blocks the sixth network attempt despite rotating email, form, language or target", async () => {
  for (let n=1;n<=5;n++) expect(await consume(network,key(n))).toBe(true);
  expect(await consume(network,key(6))).toBe(false);
  expect((await db.query("select attempts from public.public_form_limits where key=$1", ["network_short:"+network])).rows[0]).toEqual({ attempts: 5 });
});
it("retains the daily network limit after short windows expire", async () => {
  for (let n=1;n<=20;n++) {
    await db.query("update public.public_form_limits set expires_at=clock_timestamp() where key=$1", ["network_short:"+network]);
    expect(await consume(network,key(n))).toBe(true);
  }
  expect(await consume(network,key(21))).toBe(false);
});
it("resets expired buckets at the boundary without extending active expiry dates", async () => {
  expect(await consume()).toBe(true);
  const before = (await db.query("select key,expires_at from public.public_form_limits order by key")).rows;
  expect(await consume()).toBe(true);
  expect((await db.query("select key,expires_at from public.public_form_limits order by key")).rows).toEqual(before);
  await db.exec("update public.public_form_limits set expires_at=clock_timestamp(),attempts=100");
  expect(await consume()).toBe(true);
  expect((await db.query("select attempts from public.public_form_limits")).rows).toEqual([{ attempts: 1 }, { attempts: 1 }, { attempts: 1 }]);
});
it("enforces the quota for queued attempts at the boundary", async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => consume()));
  expect(results.filter(Boolean)).toHaveLength(3);
  expect((await db.query("select attempts from public.public_form_limits where key=$1", ["email_day:"+email])).rows[0]).toEqual({ attempts: 3 });
});
it("preserves existing requests, consent and service-only submission grants on upgrade", async () => {
  expect((await db.query("select title,consent_policy from public.support_requests where id='00000000-0000-4000-a000-000000000001'")).rows[0]).toEqual({ title: "Existing request", consent_policy: "support-v1" });
  for (const signature of ["public.submit_support_request(uuid,jsonb,jsonb,uuid)", "public.submit_mentorship_application(uuid,jsonb)", "public.submit_research_program_application(uuid,jsonb)"]) {
    for (const role of ["anon", "authenticated", "service_role"]) expect((await db.query<{ allowed: boolean }>("select has_function_privilege($1,$2,'execute') allowed", [role,signature])).rows[0].allowed).toBe(role === "service_role");
  }
});
it("cleans expired unrelated buckets in bounded batches and keeps live keys", async () => {
  await db.query("insert into public.public_form_limits select 'email_day:'||lpad(to_hex(n),64,'0'),1,now()-interval '2 days' from generate_series(1,1002) n");
  expect(await consume()).toBe(true);
  expect((await db.query("select count(*)::integer n from public.public_form_limits")).rows[0]).toEqual({ n: 5 });
  expect(await consume()).toBe(true);
  expect((await db.query("select count(*)::integer n from public.public_form_limits")).rows[0]).toEqual({ n: 3 });
});
it.each([null, "", "raw@example.org", "192.0.2.1", "A".repeat(64), "x".repeat(1000)])("rejects invalid keys without retaining them: %s", async invalid => {
  for (const args of [[invalid,email], [network,invalid]]) {
    await expect(db.query("select public.consume_public_form_limit($1,$2)", args)).rejects.toThrow("invalid_input");
  }
  expect((await db.query("select count(*)::integer n from public.public_form_limits")).rows[0]).toEqual({ n: 0 });
});
