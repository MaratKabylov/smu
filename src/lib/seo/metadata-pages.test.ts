import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ article: vi.fn(), scientist: vi.fn(), work: vi.fn(), event: vi.fn(), mentor: vi.fn(), program: vi.fn(), publication: vi.fn(), paths: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); } }));
vi.mock("@/server/services/public-article.service", () => ({ getPublishedArticleBySlug: mocks.article }));
vi.mock("@/server/services/scientist.service", () => ({ getPublicScientistBySlug: mocks.scientist }));
vi.mock("@/server/services/science-work.service", () => ({ getPublicScienceWork: mocks.work }));
vi.mock("@/server/services/event.service", () => ({ getPublicEvent: mocks.event }));
vi.mock("@/server/services/mentorship.service", () => ({ getPublicMentorship: mocks.mentor }));
vi.mock("@/server/services/research-program.service", () => ({ getPublicResearchProgram: mocks.program }));
vi.mock("@/server/services/publication.service", () => ({ PublicationService: class { listPublic = mocks.publication; } }));
vi.mock("@/server/services/seo.service", () => ({ SeoService: class { paths = mocks.paths; } }));
vi.mock("@/server/repositories/article-images.repository", () => ({}));
vi.mock("@/lib/supabase/server", () => ({}));
vi.mock("@/components/articles/PublicArticleRelations", () => ({}));
vi.mock("@/components/mentorship/ApplicationForm", () => ({}));
vi.mock("@/components/research-program/ApplicationForm", () => ({}));
import { generateMetadata as journal } from "@/app/[locale]/journal/page";
import { generateMetadata as scientists } from "@/app/[locale]/scientists/page";
import { generateMetadata as research } from "@/app/[locale]/research/page";
import { generateMetadata as projects } from "@/app/[locale]/projects/page";
import { generateMetadata as events } from "@/app/[locale]/events/page";
import { generateMetadata as mentorship } from "@/app/[locale]/mentorship/page";
import { generateMetadata as programs } from "@/app/[locale]/research-program/page";
import { generateMetadata as publications } from "@/app/[locale]/publications/page";
import { generateMetadata as articleDetail } from "@/app/[locale]/journal/[slug]/page";
import { generateMetadata as scientistDetail } from "@/app/[locale]/scientists/[slug]/page";
import { scienceDetailMetadata } from "@/components/science/PublicScienceWork";
import { eventDetailMetadata } from "@/components/events/PublicEvents";
import { mentorshipDetailMetadata } from "@/components/mentorship/PublicMentorship";
import { researchProgramDetailMetadata } from "@/components/research-program/PublicResearchProgram";
import { generateMetadata as publicationDetail } from "@/app/[locale]/publications/[id]/page";
const translations = [{ locale: "en", slug: "water-en", title: "Water", summary: "Summary" }, { locale: "ru", slug: "voda", title: "Вода", summary: "Вода" }, { locale: "kk", slug: "su", title: "Су", summary: "Су" }];
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://smu.example");
  mocks.article.mockResolvedValue({ translation: { ...translations[0], excerpt: "Excerpt", seoTitle: "SEO Water", seoDescription: "SEO Summary" }, alternateTranslations: translations.slice(1), publishedAt: "2026-10-01T00:00:00Z", cover: null });
  mocks.scientist.mockResolvedValue({ translation: { ...translations[0], fullName: "Scientist", shortBio: "Bio" }, alternateTranslations: translations.slice(1), avatarUrl: null });
  mocks.work.mockResolvedValue({ translations, coverUrl: null }); mocks.event.mockResolvedValue({ translations, coverUrl: null });
  mocks.mentor.mockResolvedValue({ translations, mentor: [{ locale: "en" }, { locale: "ru" }] }); mocks.program.mockResolvedValue({ translations, coordinator: [{ locale: "en" }, { locale: "ru" }] });
  mocks.publication.mockResolvedValue([{ id: "00000000-0000-4000-a000-000000000001", title: "Water publication", journal: "Journal", year: 2026 }]);
  mocks.paths.mockResolvedValue({ en: "/en/publications/00000000-0000-4000-a000-000000000001", ru: "/ru/publications/00000000-0000-4000-a000-000000000001" });
});
afterEach(() => vi.unstubAllEnvs());

describe("SEO metadata at public route boundaries", () => {
  it.each([
    ["journal", journal], ["scientists", scientists], ["research", research], ["projects", projects], ["events", events], ["mentorship", mentorship], ["research-program", programs], ["publications", publications],
  ] as const)("propagates query indexing policy through the %s page", async (section, generate) => {
    const result = await generate({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ q: "water", page: "2" }) });
    expect(result).toMatchObject({ alternates: { canonical: "https://smu.example/en/" + section }, robots: { index: false, follow: true } });
  });
  it("uses SEO fields and real translated article/scientist slugs", async () => {
    const props = { params: Promise.resolve({ locale: "en", slug: "water-en" }), searchParams: Promise.resolve({}) };
    expect(await articleDetail(props)).toMatchObject({ title: "SEO Water", description: "SEO Summary", alternates: { canonical: "https://smu.example/en/journal/water-en", languages: { ru: "https://smu.example/ru/journal/voda" } }, openGraph: { locale: "en_GB" } });
    expect(await scientistDetail(props)).toMatchObject({ alternates: { canonical: "https://smu.example/en/scientists/water-en" } });
    mocks.article.mockResolvedValue(null); mocks.scientist.mockResolvedValue(null);
    expect((await articleDetail(props)).robots).toEqual({ index: false, follow: false });
    expect((await scientistDetail(props)).robots).toEqual({ index: false, follow: false });
  });
  it("uses the same canonical and hreflang policy for works and events", async () => {
    const params = Promise.resolve({ locale: "en", slug: "water-en" });
    for (const kind of ["project", "research"] as const) expect(await scienceDetailMetadata(kind, params)).toMatchObject({ alternates: { canonical: "https://smu.example/en/" + (kind === "project" ? "projects" : "research") + "/water-en" }, openGraph: { locale: "en_GB" } });
    expect(await eventDetailMetadata(params)).toMatchObject({ alternates: { canonical: "https://smu.example/en/events/water-en" } });
  });
  it("supports English program details and excludes translations lacking the mentor/coordinator", async () => {
    const params = Promise.resolve({ locale: "en", slug: "water-en" });
    for (const [section, generate] of [["mentorship", mentorshipDetailMetadata], ["research-program", researchProgramDetailMetadata]] as const) {
      const result = await generate(params);
      expect(result.alternates?.canonical).toBe("https://smu.example/en/" + section + "/water-en");
      expect(result.alternates?.languages).not.toHaveProperty("kk");
      expect(result.openGraph).toMatchObject({ locale: "en_GB" });
    }
  });
  it("uses visible publication languages without inventing absent translations", async () => {
    const result = await publicationDetail({ params: Promise.resolve({ locale: "en", id: "00000000-0000-4000-a000-000000000001" }) });
    expect(result.alternates?.languages).not.toHaveProperty("kk");
    expect(result.alternates?.canonical).toBe("https://smu.example/en/publications/00000000-0000-4000-a000-000000000001");
  });
});
