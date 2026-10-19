import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
import { AccessManagementService } from "./access-management.service";
import type { AccessContext } from "@/types/domain/auth";

const manager: AccessContext = {
  userId: "00000000-0000-4000-a000-000000000001",
  roles: new Set(["super_admin"]),
  permissions: new Set(["admin.access", "users.manage", "roles.manage"]),
};
const catalog = {
  page: 1, pageSize: 30, total: 1, superAdminCount: 1,
  users: [{ id: manager.userId, displayName: "Owner", email: "owner@example.org", createdAt: "2026-10-19T10:00:00+05:00", roles: ["user", "super_admin"] }],
  roles: [{ code: "user", name: "Пользователь", protected: true, permissions: [] }],
  permissions: [{ code: "admin.access", name: "Доступ" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: catalog, error: null });
});

it("requires admin and user-management permissions before opening a session client", async () => {
  const service = new AccessManagementService();
  for (const permissions of [new Set(["admin.access"]), new Set(["users.manage"]), new Set<string>()]) {
    await expect(service.list({ ...manager, permissions } as AccessContext, { query: "", page: 1 })).rejects.toThrow("forbidden");
  }
  expect(mocks.client).not.toHaveBeenCalled();
});

it("allows admin directory reads but requires roles.manage for both mutation types", async () => {
  const service = new AccessManagementService();
  const viewer = { ...manager, roles: new Set(["admin"]), permissions: new Set(["admin.access", "users.manage"]) } as AccessContext;
  await service.list(viewer, { query: "owner", page: 1 });
  expect(mocks.rpc).toHaveBeenCalledWith("list_access_management", { p_page: 1, p_query: "owner" });
  await expect(service.setUserRoles(viewer, { userId: manager.userId, roles: ["user"] })).rejects.toThrow("forbidden");
  await expect(service.setRolePermissions(viewer, { role: "editor", permissions: [] })).rejects.toThrow("forbidden");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});

it("uses session-bound validated RPCs and never accepts actor authority from input", async () => {
  const service = new AccessManagementService();
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  await service.setUserRoles(manager, { userId: manager.userId, roles: ["user", "editor"] });
  expect(mocks.rpc).toHaveBeenLastCalledWith("set_user_roles", { p_user_id: manager.userId, p_role_codes: ["user", "editor"] });
  await service.setRolePermissions(manager, { role: "editor", permissions: ["admin.access", "articles.create"] });
  expect(mocks.rpc).toHaveBeenLastCalledWith("set_role_permissions", { p_role_code: "editor", p_permission_codes: ["admin.access", "articles.create"] });
});

it("validates database DTOs and propagates RPC failures", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: { ...catalog, users: [{ id: "bad" }] }, error: null });
  await expect(new AccessManagementService().list(manager, { query: "", page: 1 })).rejects.toThrow();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "last_super_admin" } });
  await expect(new AccessManagementService().setUserRoles(manager, { userId: manager.userId, roles: ["user"] })).rejects.toEqual({ message: "last_super_admin" });
});
