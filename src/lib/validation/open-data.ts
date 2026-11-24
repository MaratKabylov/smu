import { z } from "zod";

export const openDataCategoryStatusSchema = z.enum([
  "planned",
  "collecting",
  "processing",
  "collected",
]);

export const openDataCategoryStatusLabels = {
  ru: {
    planned: "Запланировано",
    collecting: "Ведётся сбор",
    processing: "Ведётся обработка",
    collected: "Данные собраны",
  },
  kk: {
    planned: "Жоспарланған",
    collecting: "Деректер жиналуда",
    processing: "Өңделуде",
    collected: "Деректер жиналды",
  },
  en: {
    planned: "Planned",
    collecting: "Collecting data",
    processing: "Processing data",
    collected: "Data collected",
  },
} as const;

export const openDataSettingsInputSchema = z.object({
  title_ru: z.string().trim().min(1).max(200),
  title_kk: z.string().trim().min(1).max(200),
  subtitle_ru: z.string().trim().min(1).max(300),
  subtitle_kk: z.string().trim().min(1).max(300),
  short_description_ru: z.string().trim().min(1).max(2000),
  short_description_kk: z.string().trim().min(1).max(2000),
  description_ru: z.string().trim().min(1).max(10000),
  description_kk: z.string().trim().min(1).max(10000),
  status: z.string().trim().min(1).max(100),
  status_text_ru: z.string().trim().min(1).max(300),
  status_text_kk: z.string().trim().min(1).max(300),
  collaboration_text_ru: z.string().trim().min(1).max(5000),
  collaboration_text_kk: z.string().trim().min(1).max(5000),
  is_published: z.boolean(),
  show_on_homepage: z.boolean(),
  data_updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type OpenDataSettingsInput = z.infer<typeof openDataSettingsInputSchema>;

export const openDataMetricInputSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_-]+$/i),
  title_ru: z.string().trim().min(1).max(200),
  title_kk: z.string().trim().min(1).max(200),
  value_numeric: z.union([z.number().min(0), z.null(), z.literal("")]).optional().transform(v => (v === "" || v === undefined || v === null ? null : Number(v))),
  value_text_ru: z.string().trim().max(200).nullish().transform(v => (v && v.length > 0 ? v : null)),
  value_text_kk: z.string().trim().max(200).nullish().transform(v => (v && v.length > 0 ? v : null)),
  unit_ru: z.string().trim().max(50).default(""),
  unit_kk: z.string().trim().max(50).default(""),
  icon: z.string().trim().min(1).max(50).default("database"),
  sort_order: z.coerce.number().int().default(0),
  is_visible: z.boolean().default(true),
  show_on_homepage: z.boolean().default(false),
});
export type OpenDataMetricInput = z.infer<typeof openDataMetricInputSchema>;

export const openDataCategoryInputSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title_ru: z.string().trim().min(1).max(200),
  title_kk: z.string().trim().min(1).max(200),
  description_ru: z.string().trim().max(1000).default(""),
  description_kk: z.string().trim().max(1000).default(""),
  icon: z.string().trim().min(1).max(50).default("folder"),
  dataset_count: z.union([z.number().int().min(0), z.null(), z.literal("")]).optional().transform(v => (v === "" || v === undefined || v === null ? null : Math.floor(Number(v)))),
  status: openDataCategoryStatusSchema.default("collecting"),
  sort_order: z.coerce.number().int().default(0),
  is_visible: z.boolean().default(true),
  show_on_homepage: z.boolean().default(false),
});
export type OpenDataCategoryInput = z.infer<typeof openDataCategoryInputSchema>;

export const openDataUpdateInputSchema = z.object({
  id: z.string().uuid().optional(),
  category_id: z.string().uuid(),
  title_ru: z.string().trim().min(1).max(300),
  title_kk: z.string().trim().min(1).max(300),
  description_ru: z.string().trim().max(2000).default(""),
  description_kk: z.string().trim().max(2000).default(""),
  source_name: z.string().trim().min(1).max(200),
  source_url: z.union([z.string().trim().url(), z.literal("")]).nullish().transform(v => (v && v.length > 0 ? v : null)),
  period_start: z.string().trim().max(50).nullish().transform(v => (v && v.length > 0 ? v : null)),
  period_end: z.string().trim().max(50).nullish().transform(v => (v && v.length > 0 ? v : null)),
  received_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_published: z.boolean().default(true),
});
export type OpenDataUpdateInput = z.infer<typeof openDataUpdateInputSchema>;
