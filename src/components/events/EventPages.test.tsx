import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  save: vi.fn(),
  changeStatus: vi.fn(),
  softDelete: vi.fn(),
  listPage: vi.fn(),
  listPublic: vi.fn(),
  getBySlug: vi.fn(),
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

vi.mock("@/lib/permissions/permissions", () => ({
  canManageEvents: () => true,
  canViewMedia: () => true,
  canAccessAdmin: () => true,
}));

vi.mock("@/server/services/event.service", () => ({
  EventService: class {
    list = mocks.list;
    getById = mocks.getById;
    save = mocks.save;
    changeStatus = mocks.changeStatus;
    softDelete = mocks.softDelete;
  },
  PublicEventService: class {
    listPage = mocks.listPage;
    list = mocks.listPublic;
    getBySlug = mocks.getBySlug;
  },
  getPublicEvent: (locale: string, slug: string) => mocks.getBySlug(locale, slug),
}));

vi.mock("@/server/services/media.service", () => ({
  MediaService: class {
    list = vi.fn().mockResolvedValue([]);
    getById = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock("@/server/actions/event.actions", () => ({
  saveEvent: mocks.save,
  changeEventStatus: mocks.changeStatus,
  deleteEvent: mocks.softDelete,
}));

vi.mock("@/components/i18n/PublicHeader", () => ({
  PublicHeader: () => <header data-testid="public-header" />,
}));

vi.mock("@/components/articles/PublicArticleRelations", () => ({
  RelatedArticles: () => <div data-testid="related-articles" />,
}));

vi.mock("@/components/search/Pagination", () => ({
  Pagination: () => <nav data-testid="pagination" />,
}));

import { EventAdminList, EventAdminEditor } from "./EventAdmin";
import { EventForm } from "./EventForm";
import { PublicEventCatalog, PublicEventDetail } from "./PublicEvents";
import type { ScienceEvent } from "@/types/domain/event";

const testEvent: ScienceEvent = {
  id: "00000000-0000-4000-a000-000000000010",
  kind: "conference",
  format: "offline",
  startsAt: "2026-12-15T09:00:00+05:00",
  endsAt: "2026-12-15T18:00:00+05:00",
  registrationDeadline: "2026-12-10T23:59:00+05:00",
  registrationUrl: "https://example.com/register",
  externalUrl: "https://example.com/conference",
  coverMediaId: "00000000-0000-4000-a000-000000000050",
  coverUrl: "https://example.com/cover.jpg",
  status: "published",
  updatedAt: "2026-11-20T12:00:00Z",
  translations: [
    {
      locale: "ru",
      title: "Международная научная конференция молодых исследователей",
      slug: "young-researchers-conference-2026",
      summary:
        "Ежегодная конференция по актуальным вопросам естественных и технических наук в Актюбинской области.",
      description:
        "Конференция включает пленарные заседания, постерные доклады и круглые столы по приоритетным направлениям науки региона.",
      organizer: "Совет молодых учёных Актюбинской области",
      location: "г. Актобе, ул. Абулхаир-хана 56, Конференц-зал",
    },
    {
      locale: "kk",
      title: "Жас зерттеушілердің халықаралық ғылыми конференциясы",
      slug: "zhas-zertteushiler-konferentsiyasy-2026",
      summary:
        "Ақтөбе облысындағы жаратылыстану және техникалық ғылымдардың өзекті мәселелері бойынша жыл сайынғы конференция.",
      description:
        "Конференция пленарлық отырыстарды, постерлік баяндамаларды және дөңгелек үстелдерді қамтиды.",
      organizer: "Ақтөбе облысының Жас ғалымдар кеңесі",
      location: "Ақтөбе қ., Әбілқайыр хан даңғылы 56, Конференц-зал",
    },
    {
      locale: "en",
      title: "International Scientific Conference of Young Researchers",
      slug: "young-researchers-conference-2026-en",
      summary:
        "Annual conference on current issues in natural and technical sciences in Aktobe region.",
      description:
        "The conference includes plenary sessions, poster presentations and round tables.",
      organizer: "Council of Young Scientists of Aktobe Region",
      location: "Aktobe, Abulkhair-khan Ave 56, Conference Hall",
    },
  ],
};

describe("Event Pages & Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({
      state: "allowed",
      access: {
        userId: "00000000-0000-4000-a000-000000000001",
        role: "admin",
        permissions: new Set(["events.manage", "media.view"]),
      },
    });
    mocks.list.mockResolvedValue([testEvent]);
    mocks.getById.mockResolvedValue(testEvent);
    mocks.listPage.mockResolvedValue({
      events: [testEvent],
      pagination: { page: 1, limit: 12, total: 1, pages: 1, items: [] },
    });
    mocks.getBySlug.mockResolvedValue(testEvent);
  });

  it("renders EventForm with language tabs, counters and form controls", () => {
    const html = renderToStaticMarkup(
      <EventForm
        action={vi.fn().mockResolvedValue(undefined)}
        event={testEvent}
        media={[]}
      />
    );

    // Language tabs
    expect(html).toContain("wp-lang-tabs");
    expect(html).toContain("Русский");
    expect(html).toContain("Қазақша");
    expect(html).toContain("English");
    expect(html).toContain("необяз.");

    // Form inputs and values
    expect(html).toContain("titleRu");
    expect(html).toContain("Международная научная конференция");
    expect(html).toContain("titleKk");
    expect(html).toContain("titleEn");
    expect(html).toContain("slugRu");
    expect(html).toContain("organizerRu");
    expect(html).toContain("locationRu");
    expect(html).toContain("summaryRu");
    expect(html).toContain("descriptionRu");

    // Sidebar parameters
    expect(html).toContain("Параметры события");
    expect(html).toContain("Тип события");
    expect(html).toContain("Формат проведения");
    expect(html).toContain("Дата и время");
    expect(html).toContain("startsAt");
    expect(html).toContain("endsAt");
    expect(html).toContain("registrationDeadline");
    expect(html).toContain("registrationUrl");
    expect(html).toContain("externalUrl");

    // Cover thumbnail and buttons (testEvent has coverUrl)
    expect(html).toContain("Обложка события");
    expect(html).toContain("wp-cover-preview-card");
    expect(html).toContain("wp-cover-thumbnail-box");
    expect(html).toContain("Заменить");
    expect(html).toContain("Загрузить");
    expect(html).toContain("Удалить");

    // Submit button
    expect(html).toContain("Сохранить событие");
  });

  it("renders EventForm empty cover dropzone when no cover is set", () => {
    const noCoverEvent: ScienceEvent = {
      ...testEvent,
      coverMediaId: null,
      coverUrl: null,
    };
    const html = renderToStaticMarkup(
      <EventForm
        action={vi.fn().mockResolvedValue(undefined)}
        event={noCoverEvent}
        media={[]}
      />
    );

    expect(html).toContain("wp-cover-empty-dropzone");
    expect(html).toContain("Обложка не выбрана");
    expect(html).toContain("Медиатека");
    expect(html).toContain("Загрузить");
  });

  it("renders EventAdminList with breadcrumbs, filter toolbar and table", async () => {
    const html = renderToStaticMarkup(
      await EventAdminList({ searchParams: Promise.resolve({}) })
    );

    expect(html).toContain("Панель управления");
    expect(html).toContain("События");
    expect(html).toContain("Добавить событие");
    expect(html).toContain("Поиск по названию или организатору");
    expect(html).toContain("Все статусы");
    expect(html).toContain("Международная научная конференция молодых исследователей");
    expect(html).toContain("Конференция");
    expect(html).toContain("Очно");
    expect(html).toContain("Опубликовано");
    expect(html).toContain("/ru/events/young-researchers-conference-2026");
  });

  it("renders EventAdminList empty state when no events exist", async () => {
    mocks.list.mockResolvedValueOnce([]);
    const html = renderToStaticMarkup(
      await EventAdminList({ searchParams: Promise.resolve({ q: "non-existent" }) })
    );

    expect(html).toContain("События не найдены");
    expect(html).toContain("Сбросить фильтры");
  });

  it("renders EventAdminEditor with breadcrumbs, workflow actions, and danger zone", async () => {
    const html = renderToStaticMarkup(
      await EventAdminEditor({
        id: testEvent.id,
        searchParams: Promise.resolve({ saved: "1" }),
      })
    );

    expect(html).toContain("Черновик сохранён.");
    expect(html).toContain("Все события");
    expect(html).toContain("Текущий статус: Опубликовано");
    expect(html).toContain("Вернуть в черновики");
    expect(html).toContain("Отменить событие");
    expect(html).toContain("В архив");
    expect(html).toContain("Открыть RU");
    expect(html).toContain("Перенести в удалённые");
    expect(html).toContain("Подтверждаю безвозвратное удаление события");
    expect(html).toContain("Удалить событие");
  });

  it("renders PublicEventCatalog with hero, filter bar and event cards", async () => {
    const html = renderToStaticMarkup(
      await PublicEventCatalog({
        params: Promise.resolve({ locale: "ru" }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(html).toContain("Календарь научного сообщества");
    expect(html).toContain("События");
    expect(html).toContain("Международная научная конференция молодых исследователей");
    expect(html).toContain("г. Актобе, ул. Абулхаир-хана 56, Конференц-зал");
    expect(html).toContain("Подробнее");
  });

  it("renders PublicEventDetail with full details, dates and registration link", async () => {
    const html = renderToStaticMarkup(
      await PublicEventDetail({
        params: Promise.resolve({
          locale: "ru",
          slug: "young-researchers-conference-2026",
        }),
      })
    );

    expect(html).toContain("Международная научная конференция молодых исследователей");
    expect(html).toContain("Совет молодых учёных Актюбинской области");
    expect(html).toContain("г. Актобе, ул. Абулхаир-хана 56, Конференц-зал");
    expect(html).toContain("Зарегистрироваться");
    expect(html).toContain("https://example.com/register");
    expect(html).toContain("Сайт события / трансляция");
    expect(html).toContain("https://example.com/conference");
  });
});
