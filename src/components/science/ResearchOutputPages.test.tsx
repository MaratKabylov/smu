import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  workOptions: vi.fn(),
  uploads: vi.fn(),
  save: vi.fn(),
  listPublicPage: vi.fn(),
  listPublic: vi.fn(),
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

vi.mock("@/server/services/access.service", () => ({
  getAdminAccess: mocks.access,
}));

vi.mock("@/server/services/research-output.service", () => ({
  canEditOutputs: (access: any) =>
    access?.permissions?.includes("outputs.manage") || access?.permissions?.includes("outputs.create"),
  ResearchOutputService: class {
    list = mocks.list;
    get = mocks.get;
    workOptions = mocks.workOptions;
    uploads = mocks.uploads;
    save = mocks.save;
    listPublicPage = mocks.listPublicPage;
    listPublic = mocks.listPublic;
  },
}));

vi.mock("@/server/actions/research-output.actions", () => ({
  saveResearchOutput: mocks.save,
  searchOutputWorks: vi.fn().mockResolvedValue({ ok: true, options: [] }),
}));

vi.mock("@/components/i18n/PublicHeader", () => ({
  PublicHeader: () => <header data-testid="public-header" />,
}));

import {
  ResearchOutputAdminList,
  ResearchOutputAdminEditor,
} from "./ResearchOutputAdmin";
import PublicResultsPage from "@/app/[locale]/results/page";
import PublicResultDetailPage from "@/app/[locale]/results/[id]/page";
import type { PublicResearchOutputItem } from "@/types/domain/research-output";

const outputItem = {
  id: "00000000-0000-4000-a000-000000000010",
  ownerId: "00000000-0000-4000-a000-000000000002",
  kind: "dataset" as const,
  status: "published" as const,
  version: 1,
  updatedAt: "2026-11-20T12:00:00Z",
  input: {
    kind: "dataset" as const,
    status: "published" as const,
    versionLabel: "1.0",
    license: "CC BY 4.0",
    changeNote: "Первый релиз",
    externalUrl: "https://data.example.kz",
    workIds: ["00000000-0000-4000-a000-000000000003"],
    files: [{ id: "00000000-0000-4000-a000-000000000004", isPublic: true }],
    ru: {
      title: "База данных качества питьевой воды",
      description: "Комплексные замеры минерализации и химического состава воды в регионе.",
    },
    kk: {
      title: "Ауыз су сапасының деректер базасы",
      description: "Өңірдегі судың минералдануы мен химиялық құрамын кешенді өлшеу.",
    },
  },
};

const publicItem: PublicResearchOutputItem = {
  id: "00000000-0000-4000-a000-000000000010",
  kind: "dataset",
  version: 1,
  versionLabel: "1.0",
  license: "CC BY 4.0",
  title: "База данных качества питьевой воды",
  description: "Комплексные замеры минерализации и химического состава воды в регионе.",
  externalUrl: "https://data.example.kz",
  publishedAt: "2026-11-20T12:00:00Z",
  updatedAt: "2026-11-20T12:00:00Z",
  works: [
    {
      id: "00000000-0000-4000-a000-000000000003",
      kind: "research",
      title: "Экология водных ресурсов Актобе",
    },
  ],
  files: [
    {
      id: "00000000-0000-4000-a000-000000000004",
      name: "water_quality_2026.csv",
      size: 1048576,
      mimeType: "text/csv",
    },
  ],
};

const workOption = {
  id: "00000000-0000-4000-a000-000000000003",
  title: "Экология водных ресурсов Актобе",
  kind: "research" as const,
  status: "published" as const,
};

const uploadOption = {
  id: "00000000-0000-4000-a000-000000000004",
  file_name: "water_quality_2026.csv",
  file_size: 1048576,
};

describe("ResearchOutputAdmin and Public Results Pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({
      state: "allowed",
      access: {
        userId: "00000000-0000-4000-a000-000000000001",
        permissions: ["outputs.manage"],
      },
    });
    mocks.list.mockResolvedValue([outputItem]);
    mocks.get.mockResolvedValue({
      ...outputItem,
      versions: [
        {
          version: 1,
          createdAt: "2026-11-20T12:00:00Z",
          input: outputItem.input,
        },
      ],
    });
    mocks.workOptions.mockResolvedValue([workOption]);
    mocks.uploads.mockResolvedValue([uploadOption]);
    mocks.listPublicPage.mockResolvedValue({
      outputs: [publicItem],
      pagination: {
        total: 1,
        page: 1,
        pageSize: 12,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
        items: [{ id: publicItem.id, score: 1 }],
      },
    });
    mocks.listPublic.mockResolvedValue([publicItem]);
  });

  describe("ResearchOutputAdminList", () => {
    it("renders the results admin list with breadcrumbs, heading, toolbar, and data table", async () => {
      const html = renderToStaticMarkup(
        await ResearchOutputAdminList({ searchParams: Promise.resolve({}) })
      );

      expect(html).toContain("Научные результаты");
      expect(html).toContain("Добавить результат");
      expect(html).toContain("Каталог научных результатов");
      expect(html).toContain("База данных качества питьевой воды");
      expect(html).toContain("Набор данных");
      expect(html).toContain("Экология водных ресурсов Актобе");
      expect(html).toContain("1 запись");
    });

    it("filters results by status and search query", async () => {
      const html = renderToStaticMarkup(
        await ResearchOutputAdminList({
          searchParams: Promise.resolve({ q: "воды", status: "published" }),
        })
      );

      expect(html).toContain("База данных качества питьевой воды");

      const emptyHtml = renderToStaticMarkup(
        await ResearchOutputAdminList({
          searchParams: Promise.resolve({ q: "несуществующий" }),
        })
      );

      expect(emptyHtml).toContain("Научные результаты не найдены");
      expect(emptyHtml).toContain("0 записей");
    });

    it("throws not_found if user lacks permission", async () => {
      mocks.access.mockResolvedValueOnce({
        state: "allowed",
        access: { userId: "00000000-0000-4000-a000-000000000001", permissions: [] },
      });

      await expect(
        ResearchOutputAdminList({ searchParams: Promise.resolve({}) })
      ).rejects.toThrow("not_found");
    });
  });

  describe("ResearchOutputAdminEditor", () => {
    it("renders creation form when id is not provided", async () => {
      const html = renderToStaticMarkup(
        await ResearchOutputAdminEditor({ searchParams: Promise.resolve({}) })
      );

      expect(html).toContain("Новый результат");
      expect(html).toContain("Создание");
      expect(html).toContain("Название результата (RU)");
      expect(html).toContain("Подробное описание (RU)");
      expect(html).toContain("Связанные исследования и проекты");
      expect(html).toContain("Прикреплённые файлы и данные");
    });

    it("renders editing form with populated fields when id is provided", async () => {
      const html = renderToStaticMarkup(
        await ResearchOutputAdminEditor({
          id: outputItem.id,
          searchParams: Promise.resolve({}),
        })
      );

      expect(html).toContain("База данных качества питьевой воды");
      expect(html).toContain("Редактирование · v1");
      expect(html).toContain("water_quality_2026.csv");
      expect(html).toContain("Экология водных ресурсов Актобе");
      expect(html).toContain("История версий (1)");
    });

    it("throws not_found if id is invalid", async () => {
      await expect(
        ResearchOutputAdminEditor({
          id: "invalid-id",
          searchParams: Promise.resolve({}),
        })
      ).rejects.toThrow("not_found");
    });
  });

  describe("PublicResultsPage", () => {
    it("renders public results catalog with hero, search, and cards", async () => {
      const html = renderToStaticMarkup(
        await PublicResultsPage({
          params: Promise.resolve({ locale: "ru" }),
          searchParams: Promise.resolve({}),
        })
      );

      expect(html).toContain("Научные результаты");
      expect(html).toContain("1 результатов в каталоге");
      expect(html).toContain("База данных качества питьевой воды");
      expect(html).toContain("Набор данных");
      expect(html).toContain("v1.0");
      expect(html).toContain("1 файл");
      expect(html).toContain("Экология водных ресурсов Актобе");
    });

    it("renders empty state when no outputs are found", async () => {
      mocks.listPublicPage.mockResolvedValueOnce({
        outputs: [],
        pagination: {
          total: 0,
          page: 1,
          pageSize: 12,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
          items: [],
        },
      });

      const html = renderToStaticMarkup(
        await PublicResultsPage({
          params: Promise.resolve({ locale: "ru" }),
          searchParams: Promise.resolve({ q: "nonexistent" }),
        })
      );

      expect(html).toContain("Научные результаты не найдены");
      expect(html).toContain("Сбросить поиск");
    });
  });

  describe("PublicResultDetailPage", () => {
    it("renders public detail page with title, description, files, and return button", async () => {
      const html = renderToStaticMarkup(
        await PublicResultDetailPage({
          params: Promise.resolve({ locale: "ru", id: publicItem.id }),
        })
      );

      expect(html).toContain("База данных качества питьевой воды");
      expect(html).toContain("Комплексные замеры минерализации и химического состава воды");
      expect(html).toContain("water_quality_2026.csv");
      expect(html).toContain("Скачать");
      expect(html).toContain("Экология водных ресурсов Актобе");
      expect(html).toContain("Условия использования и лицензия");
      expect(html).toContain("CC BY 4.0");
      expect(html).toContain("Вернуться в каталог результатов");
    });

    it("throws not_found if id is invalid", async () => {
      await expect(
        PublicResultDetailPage({
          params: Promise.resolve({ locale: "ru", id: "not-a-uuid" }),
        })
      ).rejects.toThrow("not_found");
    });
  });
});
