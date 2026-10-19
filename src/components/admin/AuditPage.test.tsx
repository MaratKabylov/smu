import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); }, redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/audit-records.service", async importOriginal => ({
  ...await importOriginal<object>(), AuditRecordsService: class { list = mocks.list; },
}));
import Page from "@/app/admin/(panel)/audit/page";
const id = "00000000-0000-4000-a000-000000000301";
const page = (params: Record<string, string | string[] | undefined> = {}) => Page({ searchParams: Promise.resolve(params) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ state: "allowed", access: { permissions: new Set(["admin.access", "audit.read"]) } });
  mocks.list.mockResolvedValue({ records: [{ id, user_id: id, entity_type: "<script>", entity_id: id, action: "changed", created_at: "2026-10-19T12:00:00Z", old_data: { email: "hidden@example.org" } }], hasNextPage: true });
});
it("renders escaped metadata, exact ID filters and preserves all pagination filters", async () => {
  const html = renderToStaticMarkup(await page({ type: "article", action: "changed", actor: id, entity: id, from: "2026-10-18", until: "2026-10-19", page: "2" }));
  expect(html).toContain("Журнал аудита"); expect(html).toContain("UTC");
  expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>"); expect(html).not.toContain("hidden@example.org");
  expect(html).toContain("Предыдущая страница"); expect(html).toContain("Следующая страница");
  for (const value of ["type=article", "action=changed", `actor=${id}`, `entity=${id}`, "from=2026-10-18", "until=2026-10-19", "page=3"])
    expect(html).toContain(value);
});
it("requires login and both permissions before reading events", async () => {
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" });
  await expect(page()).rejects.toThrow("redirect:/admin/login");
  for (const permissions of [[], ["admin.access"], ["audit.read"]]) {
    mocks.access.mockResolvedValueOnce({ state: "allowed", access: { permissions: new Set(permissions) } });
    await expect(page()).rejects.toThrow("not_found");
  }
  expect(mocks.list).not.toHaveBeenCalled();
});
it("rejects malformed filters before querying and handles empty/system events", async () => {
  for (const invalid of [{ page: "0" }, { actor: "invalid" }, { action: ["changed", "purged"] }, { from: "2026-10-20", until: "2026-10-19" }])
    await expect(page(invalid)).rejects.toThrow("not_found");
  expect(mocks.list).not.toHaveBeenCalled();
  mocks.list.mockResolvedValueOnce({ records: [], hasNextPage: false });
  const empty = renderToStaticMarkup(await page());
  expect(empty).toContain("События не найдены"); expect(empty).not.toContain("Следующая страница");
  mocks.list.mockResolvedValueOnce({ records: [{ id, user_id: null, entity_type: "system", entity_id: null, action: "scheduled", created_at: "2026-10-19T12:00:00Z" }], hasNextPage: false });
  expect(renderToStaticMarkup(await page())).toContain("Автоматический процесс / удалённый аккаунт");
});
