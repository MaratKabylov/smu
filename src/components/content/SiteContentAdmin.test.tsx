import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
const mocks = vi.hoisted(() => ({ access: vi.fn(), list: vi.fn(), publicContent: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); }, redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/site-content.service", async original => ({ ...await original<object>(), SiteContentService: class { list = mocks.list; }, getPublicSiteContent: mocks.publicContent }));
vi.mock("@/server/actions/site-content.actions", () => ({ saveSiteContent: vi.fn() }));
vi.mock("./SiteContentForm", () => ({ SiteContentForm: ({ kind }: { kind: string }) => <form data-kind={kind} /> }));
import { SiteContentAdmin } from "./SiteContentAdmin";
import Page, { generateMetadata } from "@/app/[locale]/pages/[key]/page";

const access = { userId: "actor", permissions: new Set(["admin.access", "content.manage"]), roles: new Set(["content_manager"]) };
const publicContent = { page: { key: "about", template: "standard", title: "About", summary: "Science platform", body: "Body", cta_href: "", cta_label: "", locales: ["ru", "kk"] }, settings: { site_name: "SMU", contact_email: "", social_links: [] }, sections: [] };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example");
  mocks.access.mockResolvedValue({ state: "allowed", access });
  mocks.list.mockResolvedValue({ pages: [{ key: "about", status: "published", template: "standard", version: 1, updated_at: "now", translations: [{ locale: "ru" }] }], sections: [{ key: "hero" }], settings: [{ key: "site_name" }] });
  mocks.publicContent.mockResolvedValue(publicContent);
});
afterEach(() => vi.unstubAllEnvs());
it("authenticates every admin route and checks separate settings permission before data reads", async () => {
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" });
  await expect(SiteContentAdmin({ mode: "pages" })).rejects.toThrow("redirect:/admin/login");
  await expect(SiteContentAdmin({ mode: "settings" })).rejects.toThrow("not_found");
  mocks.access.mockResolvedValueOnce({ state: "allowed", access: { ...access, permissions: new Set(["admin.access"]) } });
  await expect(SiteContentAdmin({ mode: "homepage" })).rejects.toThrow("not_found");
  await expect(SiteContentAdmin({ mode: "pages", selected: "arbitrary" })).rejects.toThrow("not_found");
  expect(mocks.list).not.toHaveBeenCalled();
});
it("renders fixed page navigation, published links, slots and protected settings forms", async () => {
  expect(renderToStaticMarkup(await SiteContentAdmin({ mode: "pages" }))).toContain('href="/ru/pages/about"');
  expect(renderToStaticMarkup(await SiteContentAdmin({ mode: "homepage" }))).toContain('data-kind="section"');
  mocks.access.mockResolvedValueOnce({ state: "allowed", access: { ...access, permissions: new Set(["admin.access", "settings.manage"]) } });
  expect(renderToStaticMarkup(await SiteContentAdmin({ mode: "settings" }))).toContain('data-kind="setting"');
});
it("uses only existing public translations in canonical and hreflang metadata", async () => {
  const metadata = await generateMetadata({ params: Promise.resolve({ locale: "kk", key: "about" }) });
  expect(metadata).toMatchObject({ title: "About", alternates: { canonical: "https://smu.example/kk/pages/about", languages: { ru: "https://smu.example/ru/pages/about", kk: "https://smu.example/kk/pages/about" } } });
  expect(Object.keys(metadata.alternates!.languages!)).toEqual(["ru", "kk"]);
  expect(renderToStaticMarkup(await Page({ params: Promise.resolve({ locale: "ru", key: "about" }) }))).toContain("About");
});
it("returns 404 for unsupported keys/locales and unpublished or missing translations", async () => {
  for (const params of [{ locale: "de", key: "about" }, { locale: "ru", key: "arbitrary" }]) await expect(Page({ params: Promise.resolve(params) })).rejects.toThrow("not_found");
  expect(mocks.publicContent).not.toHaveBeenCalled();
  mocks.publicContent.mockResolvedValue({ ...publicContent, page: null });
  await expect(Page({ params: Promise.resolve({ locale: "en", key: "about" }) })).rejects.toThrow("not_found");
});
