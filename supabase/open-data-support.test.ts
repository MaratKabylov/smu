import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import { dashboardSchema } from "../src/lib/dashboard";
import type { SupportInput, SupportRecord } from "../src/lib/validation/support-request";

let db: PGlite;
const own = "00000000-0000-4000-a000-000000000601";
const admin = "00000000-0000-4000-a000-000000000602";
const superAdmin = "00000000-0000-4000-a000-000000000603";
const specialist = "00000000-0000-4000-a000-000000000604";

const openDataInput = (kind: "open_data_offer" | "open_data_request", extra: Record<string, unknown> = {}): SupportInput => ({
  kind,
  locale: "ru",
  title: "Open Data Aktobe inquiry",
  description: "SECRET description of an Open Data Aktobe inquiry with enough length.",
  contactName: "Secret Researcher",
  email: `${own}@example.org`,
  organization: "SECRET University",
  consent: true,
  details: kind === "open_data_offer"
    ? { category: "Ecology", dataFormat: "CSV 12MB", periodAndSource: "2020-2025 Regional Lab" }
    : { requestedData: "Air quality indicators", researchGoal: "Regional climate study", periodOrFormat: "2020-2025 CSV" },
  ...extra,
}) as SupportInput;

async function run<T = Record<string, unknown>>(actor: string | null, sql: string, args: unknown[] = [], role = actor ? "authenticated" : "anon") {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try { return (await db.query<T>(sql, args)).rows; }
  finally { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub','',false)"); }
}

async function submit(data: unknown, owner: string | null = own, files: unknown[] = [], id = crypto.randomUUID()) {
  return (await run<{ id: string }>(null, "select public.submit_support_request($1,$2,$3,$4) id", [id, JSON.stringify(data), JSON.stringify(files), owner], "service_role"))[0].id;
}

async function list(actor: string, kind: "open_data_offer" | "open_data_request", id: string | null = null, manage = false) {
  return (await run<{ data: { total: number; items: SupportRecord[] } }>(actor, "select public.list_support_requests($1,'all',1,$2,$3) data", [kind, id, manage]))[0].data;
}

beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec("alter table auth.users add column email_confirmed_at timestamptz; alter table auth.users add column is_anonymous boolean default false");
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const id of [own, admin, superAdmin, specialist]) {
    await db.query("insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values($1,$2,'2026-11-24',false,'{}')", [id, `${id}@example.org`]);
  }
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='admin'", [admin]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='super_admin'", [superAdmin]);
  await db.exec("insert into public.roles(code,name) values('data_curator','Data curator')");
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='data_curator'", [specialist]);
  await db.exec("insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='data_curator' and p.code in ('admin.access','open_data_offers.manage') on conflict do nothing");
}, 30000);

beforeEach(async () => {
  await db.exec("truncate public.notifications,public.support_request_files,public.support_requests,public.audit_logs");
});

afterAll(async () => { await db?.close(); });

it.each(["open_data_offer", "open_data_request"] as const)("accepts %s, isolates owner/manager projections, and creates grammatical notifications", async kind => {
  const id = await submit(openDataInput(kind));
  expect((await list(own, kind, id)).items[0]).toMatchObject({ id, kind, status: "new", files: [] });
  expect(JSON.stringify(await list(own, kind, id))).not.toMatch(/email|contactName|managerNote|assignedTo|version/);
  expect((await list(admin, kind, id, true)).items[0]).toMatchObject({ email: `${own}@example.org`, version: 1, priority: "normal", assignedTo: null });

  const expectedLabel = kind === "open_data_offer" ? "Заявка на передачу данных" : "Заявка на получение данных";
  const managerNotifs = (await db.query<{ title: string; message: string; url: string }>(
    "select title, message, url from public.notifications where user_id=$1 and type='manager_new_request'",
    [admin],
  )).rows;
  expect(managerNotifs).toEqual([{
    title: "Новая заявка",
    message: `${expectedLabel} поступила в рабочую очередь.`,
    url: `/admin/support/${kind}`,
  }]);

  await run(admin, "select public.update_support_request($1,1,'in_review','normal',$2,'Reviewed')", [id, admin]);
  const assignNotifs = (await db.query<{ message: string }>(
    "select message from public.notifications where user_id=$1 and type='assignment'",
    [admin],
  )).rows;
  expect(assignNotifs[0].message).toBe(`${expectedLabel} назначена вам.`);
});

it.each(["open_data_offer", "open_data_request"] as const)("rejects file attachments for %s at the database boundary", async kind => {
  const id = crypto.randomUUID(), fileId = crypto.randomUUID();
  const file = { id: fileId, path: `${id}/${fileId}`, name: "data.pdf", size: 128, mimeType: "application/pdf" };
  await expect(submit(openDataInput(kind), own, [file], id)).rejects.toThrow("invalid_file");
  expect((await db.query("select * from public.support_requests")).rows).toEqual([]);
  expect((await db.query("select * from public.audit_logs")).rows).toEqual([]);
});

it("keeps internal helpers revoked and exposes dashboard metrics strictly by permission", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await expect(run(own, "select public.smu_support_permission('open_data_offer')", [], role)).rejects.toThrow("permission denied");
    await expect(run(own, "select public.smu_can_manage_support($1,'open_data_offer')", [own], role)).rejects.toThrow("permission denied");
    await expect(run(own, "select public.smu_notification_copy('application_received','ru','new','open_data_offer')", [], role)).rejects.toThrow("permission denied");
  }
  for (const role of ["anon", "authenticated"]) {
    await expect(run(own, "select public.submit_support_request($1,$2,'[]',null)", [crypto.randomUUID(), JSON.stringify(openDataInput("open_data_offer"))], role)).rejects.toThrow("permission denied");
  }

  await submit(openDataInput("open_data_offer"));
  await submit(openDataInput("open_data_request"));

  const curatorDashboard = dashboardSchema.parse((await run<{ data: unknown }>(specialist, "select public.read_admin_dashboard() data"))[0].data);
  expect(curatorDashboard.metrics).toEqual({ open_data_offers: 1 });

  const adminDashboard = dashboardSchema.parse((await run<{ data: unknown }>(admin, "select public.read_admin_dashboard() data"))[0].data);
  expect(adminDashboard.metrics.open_data_offers).toBe(1);
  expect(adminDashboard.metrics.open_data_requests).toBe(1);
});

it("keeps super_admin authoritative for support queues even if role_permissions rows are missing", async () => {
  const id = await submit(openDataInput("open_data_request"));
  await db.exec("delete from public.role_permissions where role_id=(select id from public.roles where code='super_admin') and permission_id=(select id from public.permissions where code='open_data_requests.manage')");
  try {
    expect((await list(superAdmin, "open_data_request", id, true)).total).toBe(1);
  } finally {
    await db.exec("insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='super_admin' and p.code='open_data_requests.manage' on conflict do nothing");
  }
});
