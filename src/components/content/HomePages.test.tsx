import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ home: vi.fn(), content: vi.fn(), access: vi.fn(), dashboard: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); }, redirect: (href: string) => { throw new Error(`redirect:${href}`); }, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/server/services/homepage.service", () => ({ getPublicHomepage: mocks.home }));
vi.mock("@/server/services/site-content.service", () => ({ getPublicSiteContent: mocks.content, getPublicContentPaths: vi.fn().mockResolvedValue([]) }));
vi.mock("@/server/services/access.service", () => ({ getAdminAccess: mocks.access }));
vi.mock("@/server/services/dashboard.service", () => ({ DashboardService: class { read = mocks.dashboard; } }));
import Home, { generateMetadata } from "@/app/[locale]/page";
import Admin from "@/app/admin/(panel)/page";
import { homeCopy } from "@/lib/homepage";
import { sectionKeys } from "@/lib/validation/site-content";
const settings = { site_name: "SMU <script>name</script>", contact_email: "contact@example.org", social_links: [{ label: "Community", href: "https://example.org" }] };
beforeEach(() => {
  vi.clearAllMocks(); mocks.home.mockResolvedValue({ settings, sections: [] }); mocks.content.mockResolvedValue({ settings });
  mocks.access.mockResolvedValue({ state: "allowed", access: { userId: "actor", roles: new Set(), permissions: new Set(["admin.access", "articles.edit_own"]) } });
  mocks.dashboard.mockResolvedValue({ metrics: { own_drafts: 0 }, ownDrafts: [], reviewQueue: [], recentActions: [] });
});
it.each(["ru", "kk", "en"] as const)("renders a %s home with localized navigation and empty states, without redirecting", async locale => {
  mocks.home.mockResolvedValue({ settings, sections: sectionKeys.map((key, i) => ({ key, title: i === 0 ? "Custom <script>title</script>" : "", display_limit: 1, sort_order: i, items: [] })) });
  const html = renderToStaticMarkup(await Home({ params: Promise.resolve({ locale }) }));
  expect(mocks.home).toHaveBeenCalledWith(locale);
  expect(html).toContain(homeCopy[locale].empty); expect(html).toContain(homeCopy[locale].sections.results);
  expect(html).toContain(`href="/${locale}/support/research_proposal"`); expect(html).toContain(`href="/${locale}/support/it_request"`);
  expect(html).toContain('href="/kk"'); expect(html).toContain('href="/en"');
  expect(html).toContain('>EN</a>');
  expect(html).toContain("Custom &lt;script&gt;title&lt;/script&gt;"); expect(html).not.toContain("<script>");
});
it("renders published cards safely and omits disabled sections", async () => {
  mocks.home.mockResolvedValue({ settings, sections: [{ key: "latest_articles", title: "", display_limit: 2, sort_order: 1,
    items: [{ id: "article", title: "<img onerror=alert(1)>", summary: "<iframe>body</iframe>", href: "/ru/journal/article" }] }] });
  const html = renderToStaticMarkup(await Home({ params: Promise.resolve({ locale: "ru" }) }));
  expect(html).toContain('href="/ru/journal/article"'); expect(html).toContain("&lt;img onerror=alert(1)&gt;");
  expect(html).not.toContain('<img onerror'); expect(html).not.toContain('id="home-events"'); expect(html).not.toContain('id="home-hero"');
});
it("rejects unknown locales before reads and gives home its canonical and all language alternates", async () => {
  const props = { params: Promise.resolve({ locale: "de" }) };
  await expect(Home(props)).rejects.toThrow("not_found"); await expect(generateMetadata(props)).rejects.toThrow("not_found");
  expect(mocks.home).not.toHaveBeenCalled(); expect(mocks.content).not.toHaveBeenCalled();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example");
  try { expect(await generateMetadata({ params: Promise.resolve({ locale: "kk" }) })).toMatchObject({ alternates: { canonical: "https://smu.example/kk", languages: { ru: "https://smu.example/ru", kk: "https://smu.example/kk", en: "https://smu.example/en" } } }); }
  finally { vi.unstubAllEnvs(); }
});
it("renders a real administrative summary with zero counts and role-specific empty states", async () => {
  const html = renderToStaticMarkup(await Admin());
  expect(html).toContain("Обзор работы"); expect(html).toContain("<strong>0</strong>"); expect(html).toContain("Материалов нет.");
  expect(html).not.toContain("Ожидают моей проверки"); expect(html).not.toContain("Последние действия");
});
it("does not load a dashboard for unauthenticated or unauthorized requests", async () => {
  mocks.access.mockResolvedValueOnce({ state: "unauthenticated" }); await expect(Admin()).rejects.toThrow("redirect:/admin/login");
  mocks.access.mockResolvedValueOnce({ state: "forbidden" }); await expect(Admin()).rejects.toThrow("not_found");
  expect(mocks.dashboard).not.toHaveBeenCalled();
});
