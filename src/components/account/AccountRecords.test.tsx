import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), get: vi.fn(), progress: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); }, notFound: () => { throw new Error("not_found"); } }));
vi.mock("@/server/services/account.service", () => ({ getAccountAccess: mocks.access }));
vi.mock("@/server/services/account-records.service", () => ({ AccountRecordsService: class { list = mocks.list; get = mocks.get; mentorshipProgress = mocks.progress; }, AccountRecordsError: class extends Error { constructor(public code: string) { super(code); } } }));
vi.mock("./WithdrawMentorshipForm", () => ({ WithdrawMentorshipForm: ({ locale }: { locale: string }) => <form data-withdraw-locale={locale} /> }));
vi.mock("./ClaimApplicationsForm", () => ({ ClaimApplicationsForm: ({ locale }: { locale: string }) => <form data-claim-locale={locale} /> }));
import { AccountRecordsError } from "@/server/services/account-records.service";
import AccountListPage from "@/app/[locale]/account/[section]/page";
import AccountDetailPage from "@/app/[locale]/account/[section]/[id]/page";
import { AccountRecordDetail, AccountRecordsList } from "./AccountRecords";
import { accountRecordsCopy } from "@/lib/i18n/account-records";
import { mentorshipProgressCopy } from "@/lib/i18n/mentorship-progress";
import { accountPageNumber, type AccountRecord } from "@/lib/validation/account-records";
const id = "00000000-0000-4000-a000-000000000001";
const record: AccountRecord = { id, kind: "article", title: "<script>secret</script>", status: "draft", updatedAt: "2026-10-12", locale: "ru", summary: "Private summary", body: "<img src=x onerror=alert(1)>", content: null, relationship: "owner" };
const data = { total: 21, page: 1, pageSize: 20 as const, items: [record] };
const listProps = (locale = "ru", section = "articles", page?: string | string[]) => ({ params: Promise.resolve({ locale, section }), searchParams: Promise.resolve({ page }) });
const detailProps = (locale = "ru", section = "articles", recordId = id) => ({ params: Promise.resolve({ locale, section, id: recordId }) });
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed" }); mocks.list.mockResolvedValue(data); mocks.get.mockResolvedValue({ record, editor: null }); });

it.each(["ru", "kk", "en"] as const)("renders localized %s lists, pagination and safe private content", async locale => {
  const html = renderToStaticMarkup(await AccountListPage(listProps(locale)));
  expect(html).toContain(accountRecordsCopy[locale].sections.articles);
  expect(html).toContain(`href="/${locale}/account/articles/${id}"`); expect(html).toContain(`href="/${locale}/account/articles?page=2"`);
  expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>secret"); expect(html).not.toContain("onerror");
  if (locale !== "ru") expect(html).toContain("RU");
});
it.each(["ru", "kk", "en"] as const)("shows %s mentorship history and withdrawal only for a current application", async locale => {
  mocks.get.mockResolvedValue({ record: { ...record, kind: "mentorship_application", status: "accepted" }, editor: null });
  const progress = { applicationStatus: "accepted", relation: { id, kind: "consultant", status: "paused", updatedAt: "2026-10-12" }, historyTotal: 1, history: [{ id, scope: "relation", fromStatus: "active", toStatus: "paused", baseline: false, createdAt: "2026-10-12" }] };
  mocks.progress.mockResolvedValue(progress);
  const html = renderToStaticMarkup(await AccountDetailPage(detailProps(locale, "applications")));
  expect(html).toContain(mentorshipProgressCopy[locale].kinds.consultant);
  expect(html).toContain(mentorshipProgressCopy[locale].statuses.paused);
  expect(html).toContain(`data-withdraw-locale="${locale}"`);
  mocks.progress.mockResolvedValue({ ...progress, applicationStatus: "completed", relation: { ...progress.relation, status: "completed" } });
  expect(renderToStaticMarkup(await AccountDetailPage(detailProps(locale, "applications")))).not.toContain("data-withdraw-locale");
});
it("keeps mentorship loading errors private and redirects expired progress sessions", async () => {
  mocks.get.mockResolvedValue({ record: { ...record, kind: "mentorship_application" }, editor: null });
  mocks.progress.mockRejectedValueOnce(new Error("private@email.org"));
  const html = renderToStaticMarkup(await AccountDetailPage(detailProps("ru", "applications")));
  expect(html).toContain(mentorshipProgressCopy.ru.unavailable); expect(html).not.toContain("private@email.org"); expect(html).not.toContain("data-withdraw-locale");
  mocks.progress.mockRejectedValueOnce(new AccountRecordsError("session"));
  await expect(AccountDetailPage(detailProps("kk", "applications"))).rejects.toThrow("redirect:/kk/account/login");
});
it("requires Auth in both pages independently of the account layout", async () => {
  mocks.access.mockResolvedValue({ state: "unauthenticated" });
  await expect(AccountListPage(listProps("kk"))).rejects.toThrow("redirect:/kk/account/login");
  await expect(AccountDetailPage(detailProps("en"))).rejects.toThrow("redirect:/en/account/login");
  mocks.access.mockResolvedValue({ state: "unconfirmed" }); await expect(AccountDetailPage(detailProps())).rejects.toThrow("?error=unconfirmed");
  expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.get).not.toHaveBeenCalled();
});
it("rejects unknown sections and malformed IDs and returns 404 for absent or foreign records", async () => {
  await expect(AccountListPage(listProps("ru", "audit"))).rejects.toThrow("not_found");
  await expect(AccountDetailPage(detailProps("ru", "projects", "malformed"))).rejects.toThrow("not_found");
  expect(mocks.access).not.toHaveBeenCalled(); mocks.get.mockResolvedValue(null);
  await expect(AccountDetailPage(detailProps())).rejects.toThrow("not_found");
});
it("reports loading failures without exposing DB errors and redirects expired sessions", async () => {
  mocks.list.mockRejectedValueOnce(new Error("DB private@email.org")); const html = renderToStaticMarkup(await AccountListPage(listProps()));
  expect(html).toContain(accountRecordsCopy.ru.unavailable); expect(html).not.toContain("private@email.org");
  mocks.get.mockRejectedValueOnce(new Error("DB secret")); expect(renderToStaticMarkup(await AccountDetailPage(detailProps()))).toContain(accountRecordsCopy.ru.unavailable);
  mocks.list.mockRejectedValueOnce(new AccountRecordsError("session")); await expect(AccountListPage(listProps())).rejects.toThrow("redirect:/ru/account/login");
});
it("shows explicit application claim only for an allowed account and handles setup and empty states", async () => {
  expect(renderToStaticMarkup(await AccountListPage(listProps("kk", "applications")))).toContain('data-claim-locale="kk"');
  mocks.list.mockResolvedValueOnce({ ...data, total: 0, items: [] }); expect(renderToStaticMarkup(await AccountListPage(listProps()))).toContain(accountRecordsCopy.ru.empty);
  mocks.access.mockResolvedValue({ state: "setup" }); const html = renderToStaticMarkup(await AccountListPage(listProps("ru", "applications"))); expect(html).not.toContain("<form"); expect(html).toContain(accountRecordsCopy.ru.unavailable);
});
it("reuses only the permitted editor, escapes details and makes backward pagination available", () => {
  const html = renderToStaticMarkup(<AccountRecordDetail locale="en" record={record} editor={`/admin/content/articles/${id}`} />);
  expect(html).toContain(`href="/admin/content/articles/${id}"`); expect(html).toContain("&lt;img"); expect(html).not.toContain("<img src=x");
  expect(renderToStaticMarkup(<AccountRecordDetail locale="ru" record={record} editor={null} />)).not.toContain('href="/admin');
  const list = renderToStaticMarkup(<AccountRecordsList locale="ru" section="articles" data={{ ...data, page: 2 }} />);
  expect(list).toContain('href="/ru/account/articles?page=1"'); expect(list).not.toContain('page=3');
});
it("bounds query pagination and discards arrays and injected text", async () => {
  for (const value of ["-1", "0", "1e5", "100001", "999999999999", "1&email=other", ["2", "3"], undefined]) expect(accountPageNumber(value)).toBe(1);
  expect(accountPageNumber("100000")).toBe(100000); await AccountListPage(listProps("ru", "projects", "2")); expect(mocks.list).toHaveBeenCalledWith("ru", "projects", 2);
});
