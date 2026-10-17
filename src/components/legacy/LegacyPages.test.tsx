import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ access: vi.fn(), own: vi.fn(), public: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("redirect:" + url); }, notFound: () => { throw new Error("not_found"); } }));
vi.mock("@/server/services/account.service", () => ({ getAccountAccess: mocks.access }));
vi.mock("@/server/services/scientific-legacy.service", () => ({ ScientificLegacyService: class { own = mocks.own; public = mocks.public; }, ScientificLegacyError: class extends Error { constructor(public code: string) { super(code); } } }));
vi.mock("./LegacyForm", () => ({ LegacyForm: () => <form data-editor="yes" />, LegacyConsentForm: () => <form data-consent="yes" /> }));
vi.mock("@/components/i18n/PublicHeader", () => ({ PublicHeader: () => <header /> }));
import { AccountLegacy } from "./AccountLegacy";
import { PublicLegacy, legacyMetadata } from "./PublicLegacy";
const id = "00000000-0000-4000-a000-000000000001";
const record = { id, kind: "archive", status: "published", translations: ["ru", "kk", "en"].map(locale => ({ locale, title: "<script>Archive</script>", description: "A public scientific archive description." })), sourceText: "", sourceUrl: "", version: 1, sourceConsent: false, consentAt: null };
const props = (locale = "ru", detail?: string) => ({ params: Promise.resolve({ locale, id: detail }), searchParams: Promise.resolve({}) });
beforeEach(() => { vi.clearAllMocks(); mocks.access.mockResolvedValue({ state: "allowed" }); mocks.own.mockResolvedValue({ total: 1, page: 1, pageSize: 20, items: [record] }); mocks.public.mockResolvedValue({ total: 1, page: 1, pageSize: 20, items: [record] }); });
it.each(["ru", "kk", "en"] as const)("protects every private legacy surface in %s", async locale => {
  mocks.access.mockResolvedValue({ state: "unauthenticated" });
  for (const mode of ["list", "new", "detail"] as const) await expect(AccountLegacy({ ...props(locale, id), mode })).rejects.toThrow(`redirect:/${locale}/account/login`);
  expect(mocks.own).not.toHaveBeenCalled();
});
it("returns 404 for invalid and foreign IDs and never renders someone else's editor", async () => {
  await expect(AccountLegacy({ ...props("ru", "invalid"), mode: "detail" })).rejects.toThrow("not_found"); expect(mocks.access).not.toHaveBeenCalled();
  mocks.own.mockResolvedValueOnce({ total: 0, items: [] }); await expect(AccountLegacy({ ...props("ru", id), mode: "detail" })).rejects.toThrow("not_found");
});
it("shows own list, separate consent/editor and unavailable states without source leakage", async () => {
  const html = renderToStaticMarkup(await AccountLegacy({ ...props(), mode: "list" })); expect(html).toContain(`/ru/account/legacy/${id}`); expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("data-consent");
  const detail = renderToStaticMarkup(await AccountLegacy({ ...props("kk", id), mode: "detail" })); expect(detail).toContain("data-editor"); expect(detail).toContain("data-consent");
  mocks.own.mockRejectedValueOnce(new Error("SECRET")); const failed = renderToStaticMarkup(await AccountLegacy({ ...props("en"), mode: "list" })); expect(failed).toContain("temporarily unavailable"); expect(failed).not.toContain("SECRET");
});
it.each(["ru", "kk", "en"] as const)("renders the public %s catalogue with localized links, filters and no source section", async locale => {
  const html = renderToStaticMarkup(await PublicLegacy(props(locale))); expect(html).toContain(`/${locale}/mentorship/legacy/${id}`); expect(html).toContain('name="kind"'); expect(html).not.toContain("<h3>"); expect(mocks.access).not.toHaveBeenCalled();
});
it("escapes text and exposes authorized source only in public details with safe external links", async () => {
  mocks.public.mockResolvedValueOnce({ total: 1, items: [{ ...record, sourceText: "<script>source</script>", sourceUrl: "https://archive.example/data.zip" }] });
  const html = renderToStaticMarkup(await PublicLegacy(props("en", id))); expect(html).toContain("&lt;script&gt;source&lt;/script&gt;"); expect(html).not.toContain("<script>source"); expect(html).toContain('rel="noopener noreferrer nofollow"'); expect(html).not.toContain("sourceConsent");
  const privateHtml = renderToStaticMarkup(await PublicLegacy(props("en", id))); expect(privateHtml).toContain("has not opened");
});
it("returns public 404 for unavailable records and rejects invalid language/IDs", async () => {
  mocks.public.mockResolvedValueOnce({ total: 0, items: [] }); await expect(PublicLegacy(props("ru", id))).rejects.toThrow("not_found");
  await expect(PublicLegacy(props("ru", "invalid"))).rejects.toThrow("not_found"); await expect(PublicLegacy(props("de"))).rejects.toThrow("not_found");
});
it("keeps source text and private fields out of metadata", async () => {
  const metadata = await legacyMetadata(props("en", id)); expect(JSON.stringify(metadata)).not.toContain("sourceText"); expect(mocks.public).not.toHaveBeenCalled();
  expect(metadata.alternates?.canonical).toContain(`/en/mentorship/legacy/${id}`);
});
it("marks the available language when an owner translation is missing", async () => {
  mocks.own.mockResolvedValueOnce({ total: 1, items: [{ ...record, translations: record.translations.filter(t => t.locale !== "en") }] });
  const html = renderToStaticMarkup(await AccountLegacy({ ...props("en"), mode: "list" })); expect(html).toContain("Available translation:"); expect(html).toContain('lang="ru"');
});
