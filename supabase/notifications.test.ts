import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";

let db: PGlite;
const applicant = "00000000-0000-4000-a000-000000000101";
const manager = "00000000-0000-4000-a000-000000000102";
const request = "00000000-0000-4000-a000-000000000103";

beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec("alter table auth.users add column email_confirmed_at timestamptz, add column is_anonymous boolean default false");
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("truncate public.notifications,public.support_request_files,public.support_requests restart identity cascade; delete from public.user_roles; delete from auth.users");
  await db.query("insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at,is_anonymous) values($1,'applicant@example.org','{}',now(),false),($2,'manager@example.org','{}',now(),false)", [applicant, manager]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='admin'", [manager]);
});
afterAll(async () => { await db?.close(); });

it("keeps the notification table private", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec(`set role ${role}`);
    try { await expect(db.query("select * from public.notifications")).rejects.toThrow("permission denied"); }
    finally { await db.exec("reset role"); }
  }
});

it("atomically creates localized applicant and manager notifications", async () => {
  await db.query(`insert into public.support_requests(id,kind,owner_id,locale,title,description,contact_name,email,details)
    values($1,'it_request',$2,'kk','Private title','Private description that is long enough','Applicant','applicant@example.org','{}')`, [request, applicant]);
  const notifications = await db.query<{ user_id: string; locale: string; type: string }>("select user_id,locale,type from public.notifications order by type,user_id");
  expect(notifications.rows).toEqual([
    { user_id: applicant, locale: "kk", type: "application_received" },
    { user_id: manager, locale: "ru", type: "manager_new_request" },
  ]);
});

it("deduplicates events and reads only the current user's inbox", async () => {
  await db.query(`insert into public.support_requests(id,kind,owner_id,locale,title,description,contact_name,email,details)
    values($1,'it_request',$2,'ru','Private title','Private description that is long enough','Applicant','applicant@example.org','{}')`, [request, applicant]);
  await db.query("update public.support_requests set status='in_review',assigned_to=$2,version=2 where id=$1", [request, manager]);
  await db.query("update public.support_requests set status='new' where id=$1", [request]);
  await db.query("update public.support_requests set status='in_review' where id=$1", [request]);
  expect((await db.query("select count(*)::integer n from public.notifications where event_key=$1", [`support:${request}:status:in_review`])).rows[0]).toEqual({ n: 1 });
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${applicant}'`);
  try {
    const inbox = (await db.query<{ result: { total: number; unread: number; items: unknown[] } }>("select public.list_account_notifications(1) result")).rows[0].result;
    expect(inbox.total).toBe(3); expect(inbox.unread).toBe(3); expect(inbox.items).toHaveLength(3);
    expect((await db.query("select public.mark_account_notification_read(null) changed")).rows[0]).toEqual({ changed: 3 });
    expect(((await db.query<{ result: { unread: number } }>("select public.list_account_notifications(1) result")).rows[0].result).unread).toBe(0);
  } finally { await db.exec("reset role; reset request.jwt.claim.sub"); }
});
