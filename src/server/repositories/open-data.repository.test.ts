import { describe, expect, it, vi, beforeEach } from "vitest";
import { OpenDataRepository } from "./open-data.repository";

describe("OpenDataRepository", () => {
  let mockFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFrom = vi.fn();
  });

  it("calculates relative shares and filters empty metrics in getPublicOverview", async () => {
    const mockSettings = {
      is_published: true,
      show_on_homepage: true,
      title_ru: "Данные RU",
      title_kk: "Деректер KZ",
      subtitle_ru: "Подзаголовок RU",
      subtitle_kk: "Подзаголовок KZ",
      short_description_ru: "Кратко RU",
      short_description_kk: "Кратко KZ",
      description_ru: "Описание RU",
      description_kk: "Описание KZ",
      status: "collecting",
      status_text_ru: "Сбор RU",
      status_text_kk: "Сбор KZ",
      collaboration_text_ru: "Сотрудничество RU",
      collaboration_text_kk: "Сотрудничество KZ",
      data_updated_at: "2026-11-24",
    };

    const mockMetrics = [
      {
        id: "m1",
        code: "datasets",
        title_ru: "Наборы RU",
        title_kk: "Наборы KZ",
        value_numeric: 25,
        value_text_ru: null,
        value_text_kk: null,
        unit_ru: "шт.",
        unit_kk: "дана",
        icon: "database",
        sort_order: 1,
      },
      {
        id: "m2",
        code: "empty_metric",
        title_ru: "Пустой показатель",
        title_kk: "Бос көрсеткіш",
        value_numeric: null,
        value_text_ru: null,
        value_text_kk: null,
        unit_ru: "",
        unit_kk: "",
        icon: "sparkles",
        sort_order: 2,
      },
      {
        id: "m3",
        code: "geo",
        title_ru: "Охват RU",
        title_kk: "Қамту KZ",
        value_numeric: null,
        value_text_ru: "Актобе",
        value_text_kk: "Ақтөбе",
        unit_ru: "",
        unit_kk: "",
        icon: "map-pin",
        sort_order: 3,
      },
    ];

    const mockCategories = [
      {
        id: "c1",
        slug: "ecology",
        title_ru: "Экология RU",
        title_kk: "Экология KZ",
        description_ru: "Описание RU",
        description_kk: "Сипаттама KZ",
        icon: "leaf",
        dataset_count: 50,
        status: "collected" as const,
        sort_order: 1,
      },
      {
        id: "c2",
        slug: "water",
        title_ru: "Вода RU",
        title_kk: "Су KZ",
        description_ru: "",
        description_kk: "",
        icon: "droplet",
        dataset_count: 25,
        status: "collecting" as const,
        sort_order: 2,
      },
    ];

    const mockUpdates = [
      {
        id: "u1",
        category_id: "c1",
        title_ru: "Новые замеры",
        title_kk: "Жаңа өлшемдер",
        description_ru: "Описание замеров",
        description_kk: "Өлшемдер сипаттамасы",
        source_name: "Гидромет",
        source_url: "https://example.org",
        period_start: "2024",
        period_end: "2026",
        received_at: "2026-11-20",
        open_data_categories: {
          id: "c1",
          slug: "ecology",
          title_ru: "Экология RU",
          title_kk: "Экология KZ",
          icon: "leaf",
        },
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "open_data_settings") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockSettings, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "open_data_metrics") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockMetrics, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "open_data_categories") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockCategories, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "open_data_updates") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockUpdates, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const repo = new OpenDataRepository({ from: mockFrom } as never);
    const ru = await repo.getPublicOverview("ru");

    expect(ru).not.toBeNull();
    expect(ru?.title).toBe("Данные RU");
    // m2 is filtered out because it has no filled value
    expect(ru?.metrics).toHaveLength(2);
    expect(ru?.metrics[0].code).toBe("datasets");
    expect(ru?.metrics[0].valueNumeric).toBe(25);
    expect(ru?.metrics[1].code).toBe("geo");
    expect(ru?.metrics[1].valueText).toBe("Актобе");

    // Relative shares: max dataset count is 50. c1 has 50 -> 100%, c2 has 25 -> 50%
    expect(ru?.categories[0].relativeShare).toBe(100);
    expect(ru?.categories[1].relativeShare).toBe(50);
    expect(ru?.categories[0].statusLabel).toBe("Данные собраны");
    expect(ru?.categories[1].statusLabel).toBe("Ведётся сбор");

    // Updates
    expect(ru?.latestUpdates).toHaveLength(1);
    expect(ru?.latestUpdates[0].title).toBe("Новые замеры");
    expect(ru?.latestUpdates[0].categoryTitle).toBe("Экология RU");

    // Check Kazakh localization
    const kk = await repo.getPublicOverview("kk");
    expect(kk?.title).toBe("Деректер KZ");
    expect(kk?.metrics[0].title).toBe("Наборы KZ");
    expect(kk?.metrics[1].valueText).toBe("Ақтөбе");
    expect(kk?.categories[0].title).toBe("Экология KZ");
    expect(kk?.categories[0].statusLabel).toBe("Деректер жиналды");
    expect(kk?.latestUpdates[0].title).toBe("Жаңа өлшемдер");
  });

  it("returns null when settings are unpublished", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { is_published: false },
              error: null,
            }),
          }),
        }),
      }),
    });

    const repo = new OpenDataRepository({ from: mockFrom } as never);
    expect(await repo.getPublicOverview("ru")).toBeNull();
  });
});
