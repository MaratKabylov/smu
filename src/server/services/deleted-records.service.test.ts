import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/server/repositories/deleted-records.repository", () => ({ DeletedRecordsRepository: class { list = mocks.list; } }));
import { DeletedRecordsService } from "./deleted-records.service";
import type { AccessContext, PermissionCode } from "@/types/domain/auth";
const access = (permissions: PermissionCode[]): AccessContext => ({ userId: "user", roles: new Set(), permissions: new Set(permissions) });
const filters = { kind: "all" as const, query: "", page: 1 };
beforeEach(() => vi.clearAllMocks());
describe("deleted records listing", () => {
  it("requires admin access and restore permission before constructing a client", async () => {
    for (const permissions of [[], ["articles.delete"], ["admin.access", "articles.edit_any"], ["admin.access", "articles.review"], ["admin.access", "scientists.verify"]] as PermissionCode[][])
      await expect(new DeletedRecordsService().list(access(permissions), filters)).rejects.toThrow("forbidden");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("allows mixed permission-filtered lists but denies an unauthorized explicit type", async () => {
    const manager = access(["admin.access", "scientists.edit"]);
    await new DeletedRecordsService().list(manager, filters);
    expect(mocks.list).toHaveBeenCalledWith(filters);
    await expect(new DeletedRecordsService().list(manager, { ...filters, kind: "article" })).rejects.toThrow("forbidden");
    await expect(new DeletedRecordsService().list(access(["admin.access", "articles.delete"]), { ...filters, kind: "scientist" })).rejects.toThrow("forbidden");
    expect(mocks.list).toHaveBeenCalledOnce();
  });
  it("validates search/page bounds before reaching the database", async () => {
    for (const invalid of [{ ...filters, page: 0 }, { ...filters, query: "x".repeat(121) }])
      await expect(new DeletedRecordsService().list(access(["admin.access", "articles.delete"]), invalid)).rejects.toThrow();
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
