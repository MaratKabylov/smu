import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ articles: vi.fn(), scientists: vi.fn(), works: vi.fn(), events: vi.fn(), mentorship: vi.fn(), programs: vi.fn(), publications: vi.fn(), articleDetail: vi.fn(), scientistDetail: vi.fn(), articleRedirect: vi.fn(), scientistRedirect: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); }, redirect: (path: string) => { throw new Error(`redirect:${path}`); }, permanentRedirect: (path: string) => { throw new Error(`redirect:${path}`); }, useSearchParams: () => new URLSearchParams("q=science&field=physics&page=2") }));
vi.mock("@/server/services/public-article.service", () => ({ getPublishedArticleBySlug: mocks.articleDetail, PublicArticleService: class { list = mocks.articles; getSlugRedirect = mocks.articleRedirect; } }));
vi.mock("@/server/services/scientist.service", () => ({ getPublicScientistBySlug: mocks.scientistDetail, PublicScientistService: class { list = mocks.scientists; getSlugRedirect = mocks.scientistRedirect; } }));
vi.mock("@/server/services/science-work.service", () => ({ PublicScienceWorkService: class { list = mocks.works; } }));
vi.mock("@/server/services/event.service", () => ({ PublicEventService: class { list = mocks.events; } }));
vi.mock("@/server/services/mentorship.service", () => ({ PublicMentorshipService: class { list = mocks.mentorship; } }));
vi.mock("@/server/services/research-program.service", () => ({ PublicResearchProgramService: class { list = mocks.programs; } }));
vi.mock("@/server/services/publication.service", () => ({ PublicationService: class { listPublic = mocks.publications; } }));
vi.mock("@/components/mentorship/ApplicationForm", () => ({ ApplicationForm: () => null }));
vi.mock("@/components/research-program/ApplicationForm", () => ({ ApplicationForm: () => null }));
vi.mock("@/components/articles/PublicArticleRelations", () => ({ RelatedArticles: () => null, PublicArticleRelations: () => null }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/server/repositories/article-images.repository", () => ({ getArticleImages: vi.fn() }));
import Journal, { generateMetadata as journalMetadata } from "@/app/[locale]/journal/page";
import Scientists from "@/app/[locale]/scientists/page";
import Publications from "@/app/[locale]/publications/page";
import Home from "@/app/[locale]/page";
import PublicLayout from "@/app/[locale]/layout";
import AdminLayout from "@/app/admin/layout";
import { PublicScienceWorkCatalog } from "@/components/science/PublicScienceWork";
import { PublicEventCatalog } from "@/components/events/PublicEvents";
import { PublicMentorshipCatalog } from "@/components/mentorship/PublicMentorship";
import { PublicResearchProgramCatalog } from "@/components/research-program/PublicResearchProgram";
import { PublicHeader } from "./PublicHeader";
import ArticleDetail from "@/app/[locale]/journal/[slug]/page";
import ScientistDetail from "@/app/[locale]/scientists/[slug]/page";

const taxonomy = { categories: [], tags: [], fields: [], organizations: [] };
const props = (locale: string, q = "science") => ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({ lang: "ru", q }) });
const catalogs = [
  { section: "journal", render: Journal, list: mocks.articles },
  { section: "scientists", render: Scientists, list: mocks.scientists },
  { section: "research", render: (p: ReturnType<typeof props>) => PublicScienceWorkCatalog({ ...p, kind: "research" }), list: mocks.works },
  { section: "projects", render: (p: ReturnType<typeof props>) => PublicScienceWorkCatalog({ ...p, kind: "project" }), list: mocks.works },
  { section: "events", render: PublicEventCatalog, list: mocks.events },
  { section: "mentorship", render: PublicMentorshipCatalog, list: mocks.mentorship },
  { section: "research-program", render: PublicResearchProgramCatalog, list: mocks.programs },
];
describe("localized public pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.articles.mockResolvedValue({ articles: [], taxonomy }); mocks.scientists.mockResolvedValue({ scientists: [], taxonomy });
    mocks.works.mockResolvedValue({ works: [], taxonomy }); mocks.events.mockResolvedValue([]);
    mocks.mentorship.mockResolvedValue({ offers: [], taxonomy }); mocks.programs.mockResolvedValue({ programs: [], taxonomy }); mocks.publications.mockResolvedValue([]);
    mocks.articleDetail.mockResolvedValue(null); mocks.scientistDetail.mockResolvedValue(null);
    mocks.articleRedirect.mockResolvedValue(null); mocks.scientistRedirect.mockResolvedValue(null);
  });
  it.each(catalogs)("uses the route language for $section including invalid-filter fallback", async ({ section, render, list }) => {
    const html = renderToStaticMarkup(await render(props("kk")));
    expect(html).toContain(`action="/kk/${section}"`);
    expect(html).toContain('href="/kk/scientists"');
    expect(html).not.toContain('name="lang"');
    expect(list.mock.calls[0].at(-1)).toMatchObject({ locale: "kk", query: "science" });
    await render(props("kk", "x".repeat(1000)));
    expect(list.mock.calls[1].at(-1)).toMatchObject({ locale: "kk", query: "" });
  });
  it.each(catalogs)("rejects an unknown route locale before reading $section data", async ({ render, list }) => {
    await expect(render(props("de"))).rejects.toThrow("not_found"); expect(list).not.toHaveBeenCalled();
  });
  it("renders public html in its route language and admin html in Russian", async () => {
    for (const locale of ["ru", "kk", "en"]) expect(renderToStaticMarkup(await PublicLayout({ params: Promise.resolve({ locale }), children: "body" }))).toContain(`<html lang="${locale}">`);
    expect(renderToStaticMarkup(AdminLayout({ children: "admin" }))).toContain('<html lang="ru">');
    await expect(PublicLayout({ params: Promise.resolve({ locale: "constructor" }), children: "body" })).rejects.toThrow("not_found");
  });
  it("uses translated detail slugs and preserves catalog filters in the language links", () => {
    const html = renderToStaticMarkup(<PublicHeader locale="ru" section="journal" translations={[{ locale: "ru", slug: "science" }, { locale: "kk", slug: "gylym" }]} />);
    expect(html).toContain('href="/kk/journal/gylym?q=science&amp;field=physics&amp;page=2"');
    expect(html).not.toContain('/kk/journal/science?');
    expect(renderToStaticMarkup(<PublicHeader locale="kk" section="scientists" />)).toContain('href="/ru/scientists?q=science&amp;field=physics&amp;page=2"');
  });
  it("localizes metadata and scientific publications", async () => {
    expect(await journalMetadata(props("kk"))).toMatchObject({ title: "Жас ғалымдар журналы" });
    expect(renderToStaticMarkup(await Publications(props("kk")))).toContain("Ғылыми жарияланымдар");
    expect(mocks.publications).toHaveBeenCalledWith("kk");
  });
  it("preserves repeated query keys on locale home redirects", async () => {
    await expect(Home({ params: Promise.resolve({ locale: "kk" }), searchParams: Promise.resolve({ lang: "ru", q: "science", tag: ["one", "two"] }) })).rejects.toThrow("redirect:/kk/journal?q=science&tag=one&tag=two");
  });
  it.each([
    { section: "journal", render: ArticleDetail, lookup: mocks.articleDetail, redirect: mocks.articleRedirect },
    { section: "scientists", render: ScientistDetail, lookup: mocks.scientistDetail, redirect: mocks.scientistRedirect },
  ])("preserves queries on historic $section slugs and keeps unavailable records closed", async ({ section, render, lookup, redirect }) => {
    const detailProps = { params: Promise.resolve({ locale: "kk", slug: "old-name" }), searchParams: Promise.resolve({ tag: ["one", "two"], lang: "ru" }) };
    redirect.mockResolvedValueOnce("current-name");
    await expect(render(detailProps)).rejects.toThrow(`redirect:/kk/${section}/current-name?tag=one&tag=two`);
    expect(lookup).toHaveBeenCalledWith("kk", "old-name");
    await expect(render(detailProps)).rejects.toThrow("not_found");
    lookup.mockClear(); redirect.mockClear();
    await expect(render({ ...detailProps, params: Promise.resolve({ locale: "de", slug: "old-name" }) })).rejects.toThrow("not_found");
    expect(lookup).not.toHaveBeenCalled(); expect(redirect).not.toHaveBeenCalled();
  });
});
