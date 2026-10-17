import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), admin: vi.fn(), list: vi.fn(), assignees: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); }, notFound: () => { throw new Error("not_found"); } }));
vi.mock("@/server/services/account.service", () => ({ getAccountAccess: m.account }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: m.admin }));
vi.mock("@/server/services/support-request.service", () => ({ SupportRequestService: class { list = m.list; assignees = m.assignees; } }));
vi.mock("@/components/i18n/PublicHeader", () => ({ PublicHeader: () => <header /> }));
vi.mock("@/components/support/SupportForm", () => ({ SupportForm: () => <form data-public="yes" />, SupportManageForm: () => <form data-manage="yes" /> }));
import AccountPage from "@/app/[locale]/account/support/page";
import AdminPage from "@/app/admin/(panel)/support/[kind]/page";
import PublicPage from "@/app/[locale]/support/[kind]/page";
import { SupportDetail } from "./SupportRecords";
const id = "00000000-0000-4000-a000-000000000001";
const record = { id, kind: "it_request" as const, locale: "kk" as const, title: "<script>Request</script>", status: "new" as const, createdAt: "2026-10-17", updatedAt: "2026-10-17", description: "<script>Content</script>", details: { currentProcess: "Manual", desiredSolution: "Automation", dataDescription: "Research" }, files: [], version: 1 };
beforeEach(() => { vi.clearAllMocks(); m.account.mockResolvedValue({ state: "allowed" }); m.admin.mockResolvedValue({ state: "allowed", access: { permissions: new Set(["admin.access", "it_requests.manage"]) } }); m.list.mockResolvedValue({ total: 1, page: 1, pageSize: 20, items: [record] }); m.assignees.mockResolvedValue([]); });
it.each(["ru", "kk", "en"])("requires account authentication in %s before reading requests", async locale => {
  m.account.mockResolvedValue({ state: "unauthenticated" }); await expect(AccountPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) })).rejects.toThrow(`redirect:/${locale}/account/login`); expect(m.list).not.toHaveBeenCalled();
});
it("returns 404 for invalid routes and foreign account request IDs", async () => {
  await expect(AccountPage({ params: Promise.resolve({ locale: "ru" }), searchParams: Promise.resolve({ id: "invalid" }) })).rejects.toThrow("not_found");
  await expect(PublicPage({ params: Promise.resolve({ locale: "ru", kind: "invalid" }) })).rejects.toThrow("not_found");
  m.list.mockResolvedValueOnce({ total: 0, items: [] }); await expect(AccountPage({ params: Promise.resolve({ locale: "ru" }), searchParams: Promise.resolve({ kind: "it_request", id }) })).rejects.toThrow("not_found");
});
it("renders a localized account view without manager fields or an editor", async () => {
  const html = renderToStaticMarkup(await AccountPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ kind: "it_request", id }) }));
  expect(m.list).toHaveBeenCalledWith("it_request", false, 1, id); expect(html).toContain('lang="kk"'); expect(html).toContain("&lt;script&gt;Content"); expect(html).not.toContain("data-manage");
  const safe = renderToStaticMarkup(<SupportDetail locale="en" record={{ ...record, email: "SECRET@example.org", contactName: "SECRET", managerNote: "SECRET" }} />); expect(safe).not.toContain("SECRET");
});
it("blocks the admin queue without the correct permission before any data read", async () => {
  const props = { params: Promise.resolve({ kind: "research_proposal" }), searchParams: Promise.resolve({}) };
  expect(renderToStaticMarkup(await AdminPage(props))).toContain("Недостаточно прав"); expect(m.list).not.toHaveBeenCalled();
  m.admin.mockResolvedValue({ state: "unauthenticated" }); await expect(AdminPage(props)).rejects.toThrow("redirect:/admin/login");
});
it("uses a protected detail projection and fetches assignment options only on detail", async () => {
  const html = renderToStaticMarkup(await AdminPage({ params: Promise.resolve({ kind: "it_request" }), searchParams: Promise.resolve({ id, status: "completed" }) }));
  expect(m.list).toHaveBeenCalledWith("it_request", true, 1, id, "all"); expect(m.assignees).toHaveBeenCalledWith("it_request"); expect(html).toContain("data-manage");
});
it.each(["ru", "kk", "en"])("renders a public %s form without requiring a session or listing requests", async locale => {
  const html = renderToStaticMarkup(await PublicPage({ params: Promise.resolve({ locale, kind: "it_request" }) })); expect(html).toContain("data-public"); expect(m.account).not.toHaveBeenCalled(); expect(m.list).not.toHaveBeenCalled();
});
it("hides backend errors from page output", async () => {
  m.list.mockRejectedValue(new Error("SECRET private@example.org"));
  const html = renderToStaticMarkup(await AccountPage({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({}) })); expect(html).toContain("temporarily unavailable"); expect(html).not.toContain("SECRET");
});
