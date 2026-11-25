import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OpenDataHomepageBlock } from "./OpenDataHomepageBlock";
import { PublicOpenData } from "./PublicOpenData";
import { OpenDataAdmin } from "@/components/admin/open-data/OpenDataAdmin";
import type { HomepageOpenDataPayload, PublicOpenDataPayload } from "@/types/domain/open-data";

describe("OpenData Components", () => {
  it("renders homepage block in Russian with filled metrics and categories", () => {
    const data: HomepageOpenDataPayload = {
      isPublished: true,
      showOnHomepage: true,
      title: "Open Data Aktobe",
      subtitle: "Данные сегодня — открытия завтра.",
      shortDescription: "Мы формируем единую базу научных данных Актюбинской области.",
      statusText: "Ведётся сбор и систематизация данных.",
      metrics: [
        {
          id: "m1",
          code: "datasets_count",
          title: "Количество наборов данных",
          valueNumeric: 14,
          valueText: null,
          unit: "шт.",
          icon: "database",
          sortOrder: 1,
        },
        {
          id: "m2",
          code: "geo_coverage",
          title: "Географический охват",
          valueNumeric: null,
          valueText: "Актюбинская область",
          unit: "",
          icon: "map-pin",
          sortOrder: 2,
        },
      ],
      categories: [
        {
          id: "c1",
          slug: "ecology",
          title: "Экология",
          description: "Мониторинг окружающей среды",
          icon: "leaf",
          datasetCount: 8,
          status: "collecting",
          statusLabel: "Ведётся сбор",
          relativeShare: 100,
          sortOrder: 1,
        },
      ],
      hasFilledMetrics: true,
    };

    const html = renderToStaticMarkup(<OpenDataHomepageBlock data={data} locale="ru" />);

    expect(html).toContain("Open Data Aktobe");
    expect(html).toContain("Данные сегодня — открытия завтра.");
    expect(html).toContain("Ведётся сбор и систематизация данных.");
    expect(html).toContain("Количество наборов данных");
    expect(html).toContain("14");
    expect(html).toContain("шт.");
    expect(html).toContain("Актюбинская область");
    expect(html).toContain("Экология");
    expect(html).toContain('href="/ru/open-data"');
    expect(html).toContain("Подробнее о платформе");
  });

  it("renders homepage block in Kazakh with fallback notice when no metrics are filled", () => {
    const data: HomepageOpenDataPayload = {
      isPublished: true,
      showOnHomepage: true,
      title: "Open Data Aktobe",
      subtitle: "Бүгінгі деректер — ертеңгі жаңалықтар.",
      shortDescription: "Біз бірыңғай ғылыми деректер қорын қалыптастырып жатырмыз.",
      statusText: "Деректерді жинау және жүйелеу жұмыстары жүргізілуде.",
      metrics: [],
      categories: [],
      hasFilledMetrics: false,
    };

    const html = renderToStaticMarkup(<OpenDataHomepageBlock data={data} locale="kk" />);

    expect(html).toContain("Бүгінгі деректер — ертеңгі жаңалықтар.");
    expect(html).toContain("Қазіргі уақытта ғылыми деректерді бастапқы жинау және жүйелеу жұмыстары жүргізілуде.");
    expect(html).toContain('href="/kk/open-data"');
    expect(html).toContain("Платформа туралы толығырақ");
  });

  it("hides homepage block completely when showOnHomepage is false or isPublished is false", () => {
    const disabled: HomepageOpenDataPayload = {
      isPublished: true,
      showOnHomepage: false,
      title: "Open Data Aktobe",
      subtitle: "Sub",
      shortDescription: "Desc",
      statusText: "Status",
      metrics: [],
      categories: [],
      hasFilledMetrics: false,
    };

    expect(renderToStaticMarkup(<OpenDataHomepageBlock data={disabled} locale="ru" />)).toBe("");
    expect(renderToStaticMarkup(<OpenDataHomepageBlock data={null} locale="ru" />)).toBe("");
  });

  it("renders public /open-data page with hero, metrics, categories, updates, and collaboration", () => {
    const data: PublicOpenDataPayload = {
      isPublished: true,
      showOnHomepage: true,
      title: "Open Data Aktobe",
      subtitle: "Данные сегодня — открытия завтра.",
      shortDescription: "Краткое описание",
      description: "Подробное описание инициативы Open Data Aktobe.",
      status: "collecting",
      statusText: "Ведётся сбор и систематизация данных.",
      collaborationText: "Располагаете научными данными об Актюбинской области? Помогите нам сформировать единую базу.",
      dataUpdatedAt: "2026-11-24",
      metrics: [
        {
          id: "m1",
          code: "records_count",
          title: "Количество записей",
          valueNumeric: 150000,
          valueText: null,
          unit: "записей",
          icon: "file-text",
          sortOrder: 1,
        },
      ],
      categories: [
        {
          id: "c1",
          slug: "climate",
          title: "Климат и метеорология",
          description: "Температурные режимы и осадки",
          icon: "cloud-sun",
          datasetCount: 5,
          status: "collecting",
          statusLabel: "Ведётся сбор",
          relativeShare: 100,
          sortOrder: 1,
        },
      ],
      latestUpdates: [
        {
          id: "u1",
          categoryId: "c1",
          categoryTitle: "Климат и метеорология",
          categoryIcon: "cloud-sun",
          title: "Температурный мониторинг 2020-2025",
          description: "Данные региональных метеостанций",
          sourceName: "Казгидромет",
          sourceUrl: "https://kazhydromet.kz",
          periodStart: "2020",
          periodEnd: "2025",
          receivedAt: "2026-11-15",
        },
      ],
      hasFilledMetrics: true,
    };

    const html = renderToStaticMarkup(
      <PublicOpenData data={data} locale="ru" siteName="СМУ Актюбинской области" />
    );

    // Hero
    expect(html).toContain("Open Data Aktobe");
    expect(html).toContain("Подробное описание инициативы Open Data Aktobe.");
    expect(html).toContain("24 ноября 2026");

    // Metrics
    expect(html).toContain("Количество записей");
    expect(html).toContain("150");
    expect(html).toContain("записей");

    // Categories with relative indicator
    expect(html).toContain("Климат и метеорология");
    expect(html).toContain("Ведётся сбор");
    expect(html).toContain('style="width:100%"');

    // Updates
    expect(html).toContain("Температурный мониторинг 2020-2025");
    expect(html).toContain("Казгидромет");
    expect(html).toContain("2020 — 2025");

    // Collaboration buttons
    expect(html).toContain('href="/ru/support/open_data_offer"');
    expect(html).toContain("Предложить данные");
    expect(html).toContain('href="/ru/support/open_data_request"');
    expect(html).toContain("Запросить данные");
  });

  it("renders admin panel tabs and content", () => {
    const html = renderToStaticMarkup(
      <OpenDataAdmin
        tab="settings"
        settings={{
          id: "00000000-0000-4000-a000-000000000901",
          title_ru: "Open Data Aktobe",
          title_kk: "Open Data Aktobe",
          subtitle_ru: "Данные сегодня — открытия завтра.",
          subtitle_kk: "Бүгінгі деректер — ертеңгі жаңалықтар.",
          short_description_ru: "Коротко RU",
          short_description_kk: "Коротко KZ",
          description_ru: "Описание RU",
          description_kk: "Описание KZ",
          status: "collecting",
          status_text_ru: "Статус RU",
          status_text_kk: "Статус KZ",
          collaboration_text_ru: "Сотрудничество RU",
          collaboration_text_kk: "Сотрудничество KZ",
          is_published: true,
          show_on_homepage: true,
          data_updated_at: "2026-11-24",
          created_at: "2026-11-24T00:00:00Z",
          updated_at: "2026-11-24T00:00:00Z",
        }}
        metrics={[]}
        categories={[]}
        updates={[]}
      />
    );

    expect(html).toContain("Open Data Aktobe");
    expect(html).toContain('href="/admin/science/open-data?tab=settings"');
    expect(html).toContain('href="/admin/science/open-data?tab=metrics"');
    expect(html).toContain('href="/admin/science/open-data?tab=categories"');
    expect(html).toContain('href="/admin/science/open-data?tab=updates"');
    expect(html).toContain("Публикация страницы /open-data");
    expect(html).toContain("Отображать блок на главной странице");
  });
});
