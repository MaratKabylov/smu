import { describe, expect, it } from "vitest";
import {
  openDataSettingsInputSchema,
  openDataMetricInputSchema,
  openDataCategoryInputSchema,
  openDataUpdateInputSchema,
} from "./open-data";

describe("open-data validation", () => {
  it("validates correct settings and rejects invalid inputs", () => {
    const valid = {
      title_ru: "Open Data Aktobe",
      title_kk: "Open Data Aktobe",
      subtitle_ru: "Данные сегодня — открытия завтра.",
      subtitle_kk: "Бүгінгі деректер — ертеңгі жаңалықтар.",
      short_description_ru: "Мы формируем единую базу научных данных.",
      short_description_kk: "Біз бірыңғай деректер қорын қалыптастырып жатырмыз.",
      description_ru: "Полное описание инициативы...",
      description_kk: "Бастаманың толық сипаттамасы...",
      status: "collecting",
      status_text_ru: "Ведётся сбор и систематизация данных.",
      status_text_kk: "Деректерді жинау және жүйелеу жұмыстары жүргізілуде.",
      collaboration_text_ru: "Располагаете научными данными?",
      collaboration_text_kk: "Ғылыми деректеріңіз бар ма?",
      is_published: true,
      show_on_homepage: true,
      data_updated_at: "2026-11-24",
    };

    expect(openDataSettingsInputSchema.safeParse(valid).success).toBe(true);

    // Empty titles rejected
    expect(openDataSettingsInputSchema.safeParse({ ...valid, title_ru: "" }).success).toBe(false);
    // Invalid date rejected
    expect(openDataSettingsInputSchema.safeParse({ ...valid, data_updated_at: "invalid-date" }).success).toBe(false);
  });

  it("handles metrics: allows real zero, null, and rejects negative values", () => {
    const base = {
      code: "datasets_count",
      title_ru: "Количество наборов",
      title_kk: "Жиынтықтар саны",
      unit_ru: "шт.",
      unit_kk: "дана",
      icon: "database",
      sort_order: 1,
      is_visible: true,
      show_on_homepage: true,
    };

    // Real zero is allowed
    const withZero = openDataMetricInputSchema.parse({ ...base, value_numeric: 0 });
    expect(withZero.value_numeric).toBe(0);

    // Null is allowed
    const withNull = openDataMetricInputSchema.parse({ ...base, value_numeric: null });
    expect(withNull.value_numeric).toBeNull();

    // Negative numbers rejected
    expect(openDataMetricInputSchema.safeParse({ ...base, value_numeric: -5 }).success).toBe(false);

    // Text values
    const withText = openDataMetricInputSchema.parse({
      ...base,
      value_numeric: null,
      value_text_ru: "Актюбинская область",
      value_text_kk: "Ақтөбе облысы",
    });
    expect(withText.value_text_ru).toBe("Актюбинская область");
    expect(withText.value_text_kk).toBe("Ақтөбе облысы");
  });

  it("handles categories and enforces statuses and non-negative dataset count", () => {
    const base = {
      slug: "ecology-water",
      title_ru: "Экология",
      title_kk: "Экология",
      description_ru: "Описание",
      description_kk: "Сипаттама",
      icon: "leaf",
      status: "collecting" as const,
      sort_order: 1,
      is_visible: true,
      show_on_homepage: true,
    };

    // Real zero is allowed
    expect(openDataCategoryInputSchema.parse({ ...base, dataset_count: 0 }).dataset_count).toBe(0);
    // Null is allowed
    expect(openDataCategoryInputSchema.parse({ ...base, dataset_count: null }).dataset_count).toBeNull();
    // Negative rejected
    expect(openDataCategoryInputSchema.safeParse({ ...base, dataset_count: -1 }).success).toBe(false);
    // Invalid slug rejected
    expect(openDataCategoryInputSchema.safeParse({ ...base, slug: "Invalid Slug!" }).success).toBe(false);
    // Invalid status rejected
    expect(openDataCategoryInputSchema.safeParse({ ...base, status: "unknown_status" }).success).toBe(false);
  });

  it("handles updates and validates dates, categories, and urls", () => {
    const valid = {
      category_id: "00000000-0000-4000-a000-000000000101",
      title_ru: "Мониторинг качества воздуха",
      title_kk: "Ауа сапасының мониторингі",
      description_ru: "Ежедневные замеры концентрации пыли",
      description_kk: "Шаң концентрациясын күнделікті өлшеу",
      source_name: "Казгидромет",
      source_url: "https://kazhydromet.kz",
      period_start: "2024",
      period_end: "2026",
      received_at: "2026-11-20",
      is_published: true,
    };

    expect(openDataUpdateInputSchema.safeParse(valid).success).toBe(true);

    // Empty URL becomes null
    const noUrl = openDataUpdateInputSchema.parse({ ...valid, source_url: "" });
    expect(noUrl.source_url).toBeNull();

    // Invalid URL rejected
    expect(openDataUpdateInputSchema.safeParse({ ...valid, source_url: "not-a-url" }).success).toBe(false);
  });
});
