import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  searchRelations: vi.fn(),
  save: vi.fn(),
  listPublicPage: vi.fn(),
  listPublic: vi.fn(),
  paths: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not_found");
  },
  redirect: (path: string) => {
    throw new Error("redirect:" + path);
  },
}));

vi.mock("@/server/services/seo.service", () => ({
  SeoService: class {
    paths = mocks.paths;
  },
}));

vi.mock("@/server/services/access.service", () => ({
  getAdminAccess: mocks.access,
}));

vi.mock("@/server/services/publication.service", () => ({
  PublicationService: class {
    list = mocks.list;
    getById = mocks.getById;
    save = mocks.save;
    listPublicPage = mocks.listPublicPage;
    listPublic = mocks.listPublic;
  },
}));

vi.mock("@/server/services/article-relations.service", () => ({
  ArticleRelationsService: class {
    search = mocks.searchRelations;
  },
}));

vi.mock("@/server/services/media.service", () => ({
  MediaService: class {
    list = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("@/server/actions/publication.actions", () => ({
  savePublication: mocks.save,
}));

vi.mock("@/components/i18n/PublicHeader", () => ({
  PublicHeader: () => <header data-testid="public-header" />,
}));

vi.mock("@/components/articles/PublicArticleRelations", () => ({
  RelatedArticles: () => <div data-testid="related-articles" />,
}));

import { PublicationAdminList, PublicationAdminEditor } from "./PublicationAdmin";
import PublicPublicationsPage from "@/app/[locale]/publications/page";
import PublicPublicationDetailPage from "@/app/[locale]/publications/[id]/page";
import type { Publication } from "@/types/domain/publication";

const publication: Publication = {
  id: "00000000-0000-4000-a000-000000000001",
  scientistId: "00000000-0000-4000-a000-000000000002",
  title: "Clinical and genetic markers in youth diabetes",
  year: 2026,
  journal: "Kazakhstan Medical Journal",
  doi: "10.1234/kmj.2026.01",
  url: "https://kmj.example.kz/article/1",
  publicationType: "article",
  status: "published",
  updatedAt: "2026-11-20T12:00:00Z",
  fileMediaId: null,
  translations: [],
  coauthors: [{ scientistId: null, name: "Dr. Smith", affiliation: "Oxford" }],
  workIds: ["00000000-0000-4000-a000-000000000003"],
};

const scientist = {
  kind: "scientist" as const,
  entityId: "00000000-0000-4000-a000-000000000002",
  titleRu: "Кабылов Марат",
  titleKk: "Қабылов Марат",
};

describe("PublicationAdmin and Public Publications Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.paths.mockResolvedValue({
      ru: "/ru/publications/00000000-0000-4000-a000-000000000001",
      kk: "/kk/publications/00000000-0000-4000-a000-000000000001",
      en: "/en/publications/00000000-0000-4000-a000-000000000001",
    });
    mocks.access.mockResolvedValue({
      state: "allowed",
      access: { roles: ["admin"], permissions: new Set(["publications.manage"]) },
    });
    mocks.list.mockResolvedValue([publication]);
    mocks.getById.mockResolvedValue(publication);
    mocks.searchRelations.mockResolvedValue([scientist]);
    mocks.listPublicPage.mockResolvedValue({
      publications: [
        {
          ...publication,
          scientistName: "Кабылов Марат",
          scientistHref: "/ru/scientists/kabylov-marat",
          authors: [
            {
              scientistId: scientist.entityId,
              name: "Кабылов Марат",
              affiliation: "",
              href: "/ru/scientists/kabylov-marat",
            },
            {
              scientistId: null,
              name: "Dr. Smith",
              affiliation: "Oxford",
              href: null,
            },
          ],
          works: [
            {
              id: "00000000-0000-4000-a000-000000000003",
              kind: "research" as const,
              title: "Диабет у молодёжи",
              href: "/ru/research/diabet-molodezhi",
            },
          ],
        },
      ],
      pagination: { total: 1, page: 1, pageSize: 12, items: [] },
    });
    mocks.listPublic.mockResolvedValue([
      {
        ...publication,
        scientistName: "Кабылов Марат",
        scientistHref: "/ru/scientists/kabylov-marat",
        authors: [
          {
            scientistId: scientist.entityId,
            name: "Кабылов Марат",
            affiliation: "",
            href: "/ru/scientists/kabylov-marat",
          },
        ],
        works: [
          {
            id: "00000000-0000-4000-a000-000000000003",
            kind: "research" as const,
            title: "Диабет у молодёжи",
            href: "/ru/research/diabet-molodezhi",
          },
        ],
      },
    ]);
  });

  it("renders PublicationAdminList with breadcrumbs, media-toolbar and articles-table", async () => {
    const html = renderToStaticMarkup(
      await PublicationAdminList({ searchParams: Promise.resolve({}) })
    );

    expect(html).toContain("Научные публикации");
    expect(html).toContain("breadcrumbs");
    expect(html).toContain("media-toolbar");
    expect(html).toContain("articles-table");
    expect(html).toContain("Clinical and genetic markers");
    expect(html).toContain("Kazakhstan Medical Journal");
    expect(html).toContain("Кабылов Марат");
    expect(html).toContain("Опубликована");
  });

  it("renders empty state in PublicationAdminList when no records match filter", async () => {
    mocks.list.mockResolvedValueOnce([]);
    const html = renderToStaticMarkup(
      await PublicationAdminList({ searchParams: Promise.resolve({ q: "nonexistent" }) })
    );

    expect(html).toContain("Публикации не найдены");
    expect(html).toContain("0 записей");
  });

  it("guards PublicationAdminList if user lacks permissions", async () => {
    mocks.access.mockResolvedValueOnce({
      state: "allowed",
      access: { roles: [], permissions: new Set() },
    });

    await expect(
      PublicationAdminList({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("not_found");
  });

  it("renders PublicationAdminEditor for existing publication", async () => {
    const html = renderToStaticMarkup(
      await PublicationAdminEditor({
        id: publication.id,
        searchParams: Promise.resolve({ saved: "1" }),
      })
    );

    expect(html).toContain("Публикация сохранена.");
    expect(html).toContain("Clinical and genetic markers");
    expect(html).toContain("wp-editor-workspace");
    expect(html).toContain("wp-lang-tabs");
    expect(html).toContain("Русский");
    expect(html).toContain("Қазақша");
    expect(html).toContain("English");
    expect(html).toContain("Полный текст публикации (PDF-документ)");
    expect(html).toContain("Kazakhstan Medical Journal");
    expect(html).toContain("10.1234/kmj.2026.01");
  });

  it("renders Public Publications catalog page with hero and cards", async () => {
    const html = renderToStaticMarkup(
      await PublicPublicationsPage({
        params: Promise.resolve({ locale: "ru" }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(html).toContain("journal-hero");
    expect(html).toContain("Научные публикации");
    expect(html).toContain("science-filters");
    expect(html).toContain("publication-public-card");
    expect(html).toContain("Clinical and genetic markers");
    expect(html).toContain("Kazakhstan Medical Journal");
  });

  it("renders Public Publication detail page with metadata, authors and links", async () => {
    const html = renderToStaticMarkup(
      await PublicPublicationDetailPage({
        params: Promise.resolve({ locale: "ru", id: publication.id }),
      })
    );

    expect(html).toContain("Clinical and genetic markers");
    expect(html).toContain("Kazakhstan Medical Journal");
    expect(html).toContain("Кабылов Марат");
    expect(html).toContain("DOI: 10.1234/kmj.2026.01");
  });
});
