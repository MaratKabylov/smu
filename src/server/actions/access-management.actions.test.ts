import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), users: vi.fn(), permissions: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/access-management.service", () => ({
  AccessManagementService: class { setUserRoles = mocks.users; setRolePermissions = mocks.permissions; },
}));
import { updateRolePermissions, updateUserRoles } from "./access-management.actions";

const id = "00000000-0000-4000-a000-000000000001";
const access = { userId: id, roles: new Set(["super_admin"]), permissions: new Set(["admin.access", "users.manage", "roles.manage"]) };
function form(entries: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ state: "allowed", access });
  mocks.users.mockResolvedValue(true); mocks.permissions.mockResolvedValue(true);
});

it("rechecks current authentication before parsing or mutation", async () => {
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" });
  await expect(updateUserRoles(new FormData())).rejects.toThrow("redirect:/admin/login");
  mocks.access.mockResolvedValueOnce({ state: "forbidden" });
  await expect(updateRolePermissions(new FormData())).rejects.toThrow("redirect:/admin");
  expect(mocks.users).not.toHaveBeenCalled(); expect(mocks.permissions).not.toHaveBeenCalled();
});

it("validates role assignments, preserves safe filters and ignores forged actors", async () => {
  const data = form({ userId: id, roles: ["user", "editor"], query: "Owner & team", page: "2", actor: "forged" });
  await expect(updateUserRoles(data)).rejects.toThrow("redirect:/admin/system/access?q=Owner+%26+team&page=2&saved=roles");
  expect(mocks.users).toHaveBeenCalledWith(access, { userId: id, roles: ["user", "editor"] });
  expect(mocks.users.mock.calls[0][1]).not.toHaveProperty("actor");
  expect(mocks.revalidate).toHaveBeenCalledWith("/admin/system/access");
  for (const roles of [["editor"], ["user", "user"], ["user", "unknown"]]) {
    mocks.users.mockClear();
    await expect(updateUserRoles(form({ userId: id, roles }))).rejects.toThrow("error=validation");
    expect(mocks.users).not.toHaveBeenCalled();
  }
});

it("validates editable role permissions and accepts an intentionally empty set", async () => {
  await expect(updateRolePermissions(form({ role: "editor", permissions: [] }))).rejects.toThrow("saved=permissions");
  expect(mocks.permissions).toHaveBeenCalledWith(access, { role: "editor", permissions: [] });
  for (const role of ["admin", "super_admin", "unknown"]) {
    mocks.permissions.mockClear();
    await expect(updateRolePermissions(form({ role, permissions: ["admin.access"] }))).rejects.toThrow("error=validation");
    expect(mocks.permissions).not.toHaveBeenCalled();
  }
});

it("maps expected database failures without disclosing unexpected details or invalidating", async () => {
  for (const [error, code] of [[{ message: "last_super_admin" }, "last_super_admin"], [{ message: "private owner@example.org" }, "action_failed"]] as const) {
    vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access }); mocks.users.mockRejectedValue(error);
    await expect(updateUserRoles(form({ userId: id, roles: ["user"] }))).rejects.toThrow(`error=${code}`);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  }
});
