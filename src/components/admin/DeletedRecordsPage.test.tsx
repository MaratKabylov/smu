import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("not_found"); }, redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/deleted-records.service", async importOriginal => ({
  ...await importOriginal<object>(), DeletedRecordsService: class { list = mocks.list; },
}));
vi.mock("@/server/actions/deleted-records.actions", () => ({ restoreDeletedRecord: vi.fn() }));
vi.mock("@/components/science/SubmitButton", () => ({ SubmitButton: ({ label }: { label: string }) => <button>{label}</button> }));
import Page from "@/app/admin/(panel)/deleted/page";
const token = "2026-10-06T12:00:00.123456+00:00";
const record = { id: "id", kind: "article", titleRu: "Статья <script>", titleKk: "Қазақша мақала", status: "published", deletedAt: token };
const page = (params: Record<string, string | undefined> = {}) => Page({ searchParams: Promise.resolve(params) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed", access: { userId: "admin", permissions: new Set(["admin.access", "articles.delete", "scientists.edit"]) } });
  mocks.list.mockResolvedValue({ records: [record], hasNextPage: true });
});
describe("deleted records page", () => {
  it("shows safe bilingual titles, former status, exact deletion token and explicit draft confirmation", async () => {
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Статья &lt;script&gt;"); expect(html).not.toContain("Статья <script>");
    expect(html).toContain("Қазақша мақала"); expect(html).toContain("Опубликовано");
    expect(html).toContain(token); expect(html).toContain('name="expectedDeletedAt"');
    expect(html).toContain("Подтверждаю восстановление в черновики"); expect(html).toContain('name="confirm"');
    expect(html).toContain("Следующая страница"); expect(html).not.toContain("Предыдущая страница");
    expect(html).toContain("UTC+5");
  });
  it("requires login/restore rights before requesting deleted data", async () => {
    mocks.access.mockResolvedValueOnce({ state: "unauthenticated" });
    await expect(page()).rejects.toThrow("redirect:/admin/login");
    mocks.access.mockResolvedValueOnce({ state: "allowed", access: { userId: "editor", permissions: new Set(["admin.access", "articles.edit_any"]) } });
    await expect(page()).rejects.toThrow("not_found");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("hides forbidden type options and denies explicit unauthorized filters", async () => {
    mocks.access.mockResolvedValue({ state: "allowed", access: { userId: "manager", permissions: new Set(["admin.access", "scientists.edit"]) } });
    mocks.list.mockResolvedValue({ records: [], hasNextPage: false });
    const html = renderToStaticMarkup(await page());
    expect(html).not.toContain('<option value="article"'); expect(html).toContain('<option value="scientist"');
    mocks.list.mockClear(); await expect(page({ kind: "article" })).rejects.toThrow("not_found");
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("retains search/type filters in pagination, explains blocked links and handles an empty list", async () => {
    const html = renderToStaticMarkup(await page({ q: "Қазақша", kind: "article", page: "2", error: "invalid_reference" }));
    expect(html).toContain("Предыдущая страница"); expect(html).toContain("kind=article");
    expect(html).toContain("page=3"); expect(html).toContain("%D2%9A"); expect(html).toContain("Восстановление остановлено");
    mocks.list.mockResolvedValue({ records: [], hasNextPage: false });
    const empty = renderToStaticMarkup(await page({ restored: "1" }));
    expect(empty).toContain("Запись восстановлена в черновики"); expect(empty).toContain("Удалённых записей не найдено");
    expect(empty).not.toContain('name="confirm"'); expect(empty).not.toContain("Следующая страница");
  });
  it("rejects invalid query bounds and arbitrary entity kinds before accessing data", async () => {
    for (const params of [{ kind: "media" }, { page: "0" }, { q: "x".repeat(121) }]) await expect(page(params)).rejects.toThrow("not_found");
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.access).not.toHaveBeenCalled();
  });
});
