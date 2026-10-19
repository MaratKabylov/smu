import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("not_found"); }, redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/access-management.service", async importOriginal => ({
  ...await importOriginal<object>(), AccessManagementService: class { list = mocks.list; },
}));
vi.mock("@/server/actions/access-management.actions", () => ({ updateUserRoles: vi.fn(), updateRolePermissions: vi.fn() }));
vi.mock("@/components/science/SubmitButton", () => ({ SubmitButton: ({ label }: { label: string }) => <button>{label}</button> }));
import Page from "@/app/admin/(panel)/system/access/page";

const id = "00000000-0000-4000-a000-000000000001";
const catalog = {
  page: 1, pageSize: 30, total: 31, superAdminCount: 1,
  users: [{ id, displayName: "Owner <script>", email: "owner@example.org", createdAt: "2026-10-19T10:00:00+05:00", roles: ["user", "super_admin"] }],
  roles: [
    { code: "user", name: "Пользователь", protected: true, permissions: [] },
    { code: "editor", name: "Редактор", protected: false, permissions: ["admin.access"] },
    { code: "admin", name: "Администратор", protected: true, permissions: ["admin.access", "users.manage"] },
    { code: "super_admin", name: "Суперадминистратор", protected: true, permissions: ["admin.access", "users.manage", "roles.manage"] },
  ],
  permissions: [
    { code: "admin.access", name: "Доступ" }, { code: "users.manage", name: "Пользователи" }, { code: "roles.manage", name: "Роли" },
  ],
};
const superAccess = { userId: id, roles: new Set(["super_admin"]), permissions: new Set(["admin.access", "users.manage", "roles.manage"]) };
const page = (params: Record<string, string | undefined> = {}) => Page({ searchParams: Promise.resolve(params) });

beforeEach(() => {
  vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: superAccess }); mocks.list.mockResolvedValue(catalog);
});

it("renders escaped private user data, editable assignments and last-super protection", async () => {
  const html = renderToStaticMarkup(await page({ q: "owner", saved: "roles" }));
  expect(html).toContain("Owner &lt;script&gt;"); expect(html).not.toContain("Owner <script>");
  expect(html).toContain("owner@example.org"); expect(html).toContain("Сохранить роли");
  expect(html).toContain('name="roles" value="user"'); expect(html).toContain('name="roles" value="super_admin"');
  expect(html).toContain("Последний super_admin защищён"); expect(html).toContain("Сохранить права");
  expect(html).toContain("Следующая страница"); expect(html).toContain("записаны в аудит");
});

it("gives admin a read-only directory and never renders mutation controls", async () => {
  mocks.access.mockResolvedValue({ state: "allowed", access: { userId: "admin", roles: new Set(["admin"]), permissions: new Set(["admin.access", "users.manage"]) } });
  const html = renderToStaticMarkup(await page());
  expect(html).toContain("Доступ только для просмотра"); expect(html).toContain("Суперадминистратор");
  expect(html).not.toContain("Сохранить роли"); expect(html).not.toContain("Сохранить права");
});

it("checks authentication and users.manage before requesting private data", async () => {
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" }); await expect(page()).rejects.toThrow("redirect:/admin/login");
  mocks.access.mockResolvedValueOnce({ state: "allowed", access: { userId: "editor", roles: new Set(), permissions: new Set(["admin.access"]) } });
  await expect(page()).rejects.toThrow("not_found"); expect(mocks.list).not.toHaveBeenCalled();
});

it("rejects invalid search bounds before auth or data access", async () => {
  for (const params of [{ page: "0" }, { q: "x".repeat(121) }]) await expect(page(params)).rejects.toThrow("not_found");
  expect(mocks.access).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled();
});
