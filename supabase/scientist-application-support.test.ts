import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createMigrationDatabase } from "../scripts/database-schema.mjs";
import { dashboardSchema } from "../src/lib/dashboard";
import type { SupportInput, SupportRecord } from "../src/lib/validation/support-request";

let db: PGlite;
const own = "00000000-0000-4000-a000-000000000701";
const admin = "00000000-0000-4000-a000-000000000702";
const superAdmin = "00000000-0000-4000-a000-000000000703";
const scientistManager = "00000000-0000-4000-a000-000000000704";

const scientistApplicationInput = (extra: Record<string, unknown> = {}): SupportInput => ({
  kind: "scientist_application",
  locale: "ru",
  title: "PhD, старший научный сотрудник",
  description: "SECRET biography and research experience in regional ecology and analytics.",
  contactName: "Secret Applicant",
  email: `${own}@example.org`,
  organization: "SECRET University",
  consent: true,
  details: {
    researchFields: "Ecology, GIS, environmental monitoring",
    scientificProfiles: "https://orcid.org/0000-0002-1825-0097",
    keyAchievements: "12 Scopus articles, open to joint regional projects",
  },
  ...extra,
}) as SupportInput;

async function run<T = Record<string, unknown>>(
  actor: string | null,
  sql: string,
  args: unknown[] = [],
  role = actor ? "authenticated" : "anon",
) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  await db.exec("set role " + role);
  try {
    return (await db.query<T>(sql, args)).rows;
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub','',false)");
  }
}

async function submit(data: unknown, owner: string | null = own, files: unknown[] = [], id = crypto.randomUUID()) {
  return (await run<{ id: string }>(
    null,
    "select public.submit_support_request($1,$2,$3,$4) id",
    [id, JSON.stringify(data), JSON.stringify(files), owner],
    "service_role",
  ))[0].id;
}

async function list(actor: string, id: string | null = null, manage = false) {
  return (await run<{ data: { total: number; items: SupportRecord[] } }>(
    actor,
    "select public.list_support_requests('scientist_application','all',1,$1,$2) data",
    [id, manage],
  ))[0].data;
}

beforeAll(async () => {
  db = await createMigrationDatabase();
  await db.exec("alter table auth.users add column email_confirmed_at timestamptz; alter table auth.users add column is_anonymous boolean default false");
  await db.exec(await readFile(new URL("./seed.sql", import.meta.url), "utf8"));
  for (const id of [own, admin, superAdmin, scientistManager]) {
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values($1,$2,'2026-11-25',false,'{}')",
      [id, `${id}@example.org`],
    );
  }
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='admin'", [admin]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='super_admin'", [superAdmin]);
  await db.query("insert into public.user_roles(user_id,role_id) select $1,id from public.roles where code='scientist_manager'", [scientistManager]);
}, 30000);

beforeEach(async () => {
  await db.exec("truncate public.notifications,public.support_request_files,public.support_requests,public.audit_logs");
});

afterAll(async () => {
  await db?.close();
});

it("accepts scientist_application with optional PDFs, isolates projections, and notifies scientist_manager", async () => {
  const id = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const file = { id: fileId, path: `${id}/${fileId}`, name: "cv.pdf", size: 256, mimeType: "application/pdf" };

  await submit(scientistApplicationInput(), own, [file], id);

  expect((await list(own, id)).items[0]).toMatchObject({
    id,
    kind: "scientist_application",
    status: "new",
    files: [{ id: fileId, name: "cv.pdf", size: 256 }],
  });
  expect(JSON.stringify(await list(own, id))).not.toMatch(/email|contactName|managerNote|assignedTo|version/);

  expect((await list(scientistManager, id, true)).items[0]).toMatchObject({
    email: `${own}@example.org`,
    version: 1,
    priority: "normal",
    assignedTo: null,
  });

  const managerNotifs = (await db.query<{ title: string; message: string; url: string }>(
    "select title, message, url from public.notifications where user_id=$1 and type='manager_new_request'",
    [scientistManager],
  )).rows;
  expect(managerNotifs).toEqual([{
    title: "Новая заявка",
    message: "Заявка на добавление в список учёных поступила в рабочую очередь.",
    url: "/admin/support/scientist_application",
  }]);

  await run(scientistManager, "select public.update_support_request($1,1,'in_review','normal',$2,'Checked profile')", [id, scientistManager]);
  const assignNotifs = (await db.query<{ message: string }>(
    "select message from public.notifications where user_id=$1 and type='assignment'",
    [scientistManager],
  )).rows;
  expect(assignNotifs[0].message).toBe("Заявка на добавление в список учёных назначена вам.");
});

it("keeps internal helpers revoked and exposes scientist_applications metric by permission", async () => {
  for (const role of ["anon", "authenticated", "service_role"]) {
    await expect(run(own, "select public.smu_support_permission('scientist_application')", [], role)).rejects.toThrow("permission denied");
    await expect(run(own, "select public.smu_notification_copy('application_received','kk','new','scientist_application')", [], role)).rejects.toThrow("permission denied");
  }
  for (const role of ["anon", "authenticated"]) {
    await expect(
      run(own, "select public.submit_support_request($1,$2,'[]',null)", [crypto.randomUUID(), JSON.stringify(scientistApplicationInput())], role),
    ).rejects.toThrow("permission denied");
  }

  await submit(scientistApplicationInput(), null);

  const managerDashboard = dashboardSchema.parse(
    (await run<{ data: unknown }>(scientistManager, "select public.read_admin_dashboard() data"))[0].data,
  );
  expect(managerDashboard.metrics.scientist_applications).toBe(1);

  const adminDashboard = dashboardSchema.parse(
    (await run<{ data: unknown }>(admin, "select public.read_admin_dashboard() data"))[0].data,
  );
  expect(adminDashboard.metrics.scientist_applications).toBe(1);
});

it("keeps super_admin authoritative for scientist_application even if role_permissions rows are missing", async () => {
  const id = await submit(scientistApplicationInput());
  await db.exec("delete from public.role_permissions where role_id=(select id from public.roles where code='super_admin') and permission_id=(select id from public.permissions where code='scientist_applications.manage')");
  try {
    expect((await list(superAdmin, id, true)).total).toBe(1);
  } finally {
    await db.exec("insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.code='super_admin' and p.code='scientist_applications.manage' on conflict do nothing");
  }
});
