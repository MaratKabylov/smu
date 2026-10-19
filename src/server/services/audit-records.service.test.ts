import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/server/repositories/audit-records.repository", () => ({ AuditRecordsRepository: class { list = mocks.list; } }));
import { AuditRecordsService } from "./audit-records.service";
import { auditFiltersSchema } from "@/lib/validation/audit";
import type { AccessContext, PermissionCode } from "@/types/domain/auth";
const access = (permissions: PermissionCode[]): AccessContext => ({ userId: "user", roles: new Set(), permissions: new Set(permissions) });
beforeEach(() => vi.clearAllMocks());

it("denies missing admin/audit rights before opening a session client", async () => {
  for (const permissions of [[], ["admin.access"], ["audit.read"], ["admin.access", "audit.write"]] as PermissionCode[][])
    await expect(new AuditRecordsService().list(access(permissions), auditFiltersSchema.parse({}))).rejects.toThrow("forbidden");
  expect(mocks.client).not.toHaveBeenCalled();
});
it("validates bounds, UUIDs and real dates before issuing the query", async () => {
  const allowed = access(["admin.access", "audit.read"]);
  for (const invalid of [{ page: 0 }, { actor: "invalid" }, { entityId: "invalid" }, { from: "2026-02-30" },
    { from: "2026-10-20", until: "2026-10-19" }, { action: "x".repeat(121) }, { entityType: ["article", "scientist"] }])
    await expect(new AuditRecordsService().list(allowed, { ...auditFiltersSchema.parse({}), ...invalid } as never)).rejects.toThrow();
  expect(mocks.client).not.toHaveBeenCalled();
  const filters = auditFiltersSchema.parse({ entityType: " article ", from: "2026-10-19", until: "2026-10-19", page: "2" });
  await new AuditRecordsService().list(allowed, filters);
  expect(mocks.list).toHaveBeenCalledWith({ ...filters, entityType: "article", page: 2 });
});
