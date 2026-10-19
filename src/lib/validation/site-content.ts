import { z } from "zod";

export const pageKeys = ["about", "foundation", "team", "partners", "documents", "contacts", "research_program", "it_support", "publication_support"] as const;
export const sectionKeys = ["hero", "featured_research", "featured_scientists", "research_program", "mentorship", "scientist_support", "latest_articles", "opportunities", "events", "results", "partners"] as const;
export const settingKeys = ["site_name", "contact_email", "social_links"] as const;
export const contentLabels: Record<string, string> = {
  about: "О СМУ", foundation: "Фонд", team: "Команда", partners: "Партнёры", documents: "Документы", contacts: "Контакты",
  research_program: "Research Program", it_support: "IT для учёных", publication_support: "Поддержка публикаций",
  hero: "Главный блок", featured_research: "Исследования", featured_scientists: "Учёные", mentorship: "Наставничество",
  scientist_support: "Поддержка учёных", latest_articles: "Последние статьи", opportunities: "Возможности", events: "События", results: "Результаты",
  site_name: "Название сайта", contact_email: "Контактный email", social_links: "Социальные ссылки",
};
export const contentHrefSchema = z.string().max(500).refine(value => {
  if (/^\/[A-Za-z0-9/_?=&.#-]*$/.test(value) && !value.startsWith("//")) return true;
  if (!/^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^\s\\<>]*)?$/.test(value)) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Укажите HTTPS-ссылку или путь внутри сайта.");
const localeSchema = z.enum(["ru", "kk", "en"]);
export const contentTranslationSchema = z.object({
  locale: localeSchema, title: z.string().trim().min(1).max(200), summary: z.string().max(600),
  body: z.string().trim().min(1).max(30000), cta_label: z.string().max(80), cta_href: z.union([z.literal(""), contentHrefSchema]),
}).strict().refine(t => Boolean(t.cta_label) === Boolean(t.cta_href));
export const pageDataSchema = z.object({
  status: z.enum(["draft", "published"]), translations: z.array(contentTranslationSchema).min(1).max(3),
}).strict().refine(data => new Set(data.translations.map(t => t.locale)).size === data.translations.length)
  .refine(data => data.status !== "published" || ["ru", "kk"].every(locale => data.translations.some(t => t.locale === locale)));
export const sectionDataSchema = z.object({
  enabled: z.boolean(), sort_order: z.number().int().min(0).max(100), display_limit: z.number().int().min(1).max(12),
  titles: z.object({ ru: z.string().max(200).optional(), kk: z.string().max(200).optional(), en: z.string().max(200).optional() }).strict(),
}).strict();
const settingValueSchemas = {
  site_name: z.string().trim().min(1).max(120),
  contact_email: z.union([z.literal(""), z.string().max(254).regex(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)]),
  social_links: z.array(z.object({ label: z.string().trim().min(1).max(80), href: contentHrefSchema }).strict()).max(10),
};
const version = z.number().int().min(0).max(2147483646);
export const saveSiteContentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("page"), key: z.enum(pageKeys), version, data: pageDataSchema }).strict(),
  z.object({ kind: z.literal("section"), key: z.enum(sectionKeys), version, data: sectionDataSchema }).strict(),
  z.object({ kind: z.literal("setting"), key: z.enum(settingKeys), version, data: z.object({ value: z.unknown() }).strict() }).strict(),
]).superRefine((input, context) => {
  if (input.kind === "setting" && !settingValueSchemas[input.key].safeParse(input.data.value).success)
    context.addIssue({ code: "custom", message: "Проверьте значение настройки.", path: ["data", "value"] });
});
export type SaveSiteContent = z.infer<typeof saveSiteContentSchema>;
export const contentPageSchema = z.object({
  key: z.enum(pageKeys), template: z.enum(["standard", "landing", "program", "support"]),
  status: z.enum(["draft", "published"]), version, updated_at: z.string(), translations: z.array(contentTranslationSchema),
});
export const homepageSectionSchema = sectionDataSchema.extend({ key: z.enum(sectionKeys), version, updated_at: z.string() });
export const appSettingSchema = z.object({ key: z.enum(settingKeys), value: z.unknown(), version, updated_at: z.string() })
  .refine(setting => settingValueSchemas[setting.key].safeParse(setting.value).success);
export const siteContentCatalogSchema = z.object({ pages: z.array(contentPageSchema), sections: z.array(homepageSectionSchema), settings: z.array(appSettingSchema) });
export type SiteContentCatalog = z.infer<typeof siteContentCatalogSchema>;
export type ContentPage = z.infer<typeof contentPageSchema>;
export const publicSiteContentSchema = z.object({
  page: z.object({ key: z.enum(pageKeys), template: z.enum(["standard", "landing", "program", "support"]), updated_at: z.string(),
    title: z.string(), summary: z.string(), body: z.string(), cta_label: z.string(), cta_href: z.union([z.literal(""), contentHrefSchema]), locales: z.array(localeSchema) }).nullable(),
  sections: z.array(z.object({ key: z.enum(sectionKeys), sort_order: z.number(), display_limit: z.number(), title: z.string() })),
  settings: z.object(settingValueSchemas),
});
export type PublicSiteContent = z.infer<typeof publicSiteContentSchema>;
export const publicContentPathsSchema = z.array(z.object({ page_key: z.enum(pageKeys), locale: localeSchema, updated_at: z.string() }));
