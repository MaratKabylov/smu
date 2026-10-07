import { z } from "zod";
import { appendPublicQuery, type Locale, type PublicQuery } from "@/lib/i18n/locales";

export const searchSections = ["journal", "scientists", "research", "projects", "publications", "mentorship", "research-program", "events", "organizations", "users", "media", "mentorship-applications", "program-applications"] as const;
export type SearchSection = typeof searchSections[number];
export const searchPageSchema = z.object({
  total: z.number().int().nonnegative(), page: z.number().int().positive(), pageSize: z.number().int().positive(),
  items: z.array(z.object({
    id: z.uuid(), section: z.enum(searchSections), locale: z.enum(["ru", "kk", "en"]),
    title: z.string(), summary: z.string(), href: z.string().startsWith("/").refine(value => !value.startsWith("//")).nullable(),
  })),
});
export type SearchPage = z.infer<typeof searchPageSchema>;

export function readPage(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,6}$/.test(value)) return 1;
  const page = Number(value);
  return page <= 1_000_000 ? page : 1;
}
export function readSearch(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}
export function pageHref(path: string, query: PublicQuery, page: number) {
  return appendPublicQuery(path, { ...query, page: page === 1 ? undefined : String(page) });
}
export function emptySearchPage(page = 1, pageSize = 12): SearchPage {
  return { items: [], total: 0, page, pageSize };
}
export function orderBySearch<T extends { id: string }>(items: T[], page: SearchPage): T[] {
  const byId = new Map(items.map(item => [item.id, item]));
  return page.items.flatMap(item => { const value = byId.get(item.id); return value ? [value] : []; });
}

export const searchCopy = {
  ru: { title: "Поиск по платформе", input: "Что вы ищете?", find: "Найти", all: "Все разделы", empty: "Ничего не найдено", hint: "Введите слова для поиска по платформе.", previous: "Назад", next: "Далее", pagination: "Страницы результатов", results: "Найдено", page: "Страница" },
  kk: { title: "Платформа бойынша іздеу", input: "Не іздеп жатырсыз?", find: "Іздеу", all: "Барлық бөлімдер", empty: "Ештеңе табылмады", hint: "Платформада іздеу үшін сөздерді енгізіңіз.", previous: "Артқа", next: "Келесі", pagination: "Нәтиже беттері", results: "Табылды", page: "Бет" },
  en: { title: "Search the platform", input: "What are you looking for?", find: "Search", all: "All sections", empty: "No results found", hint: "Enter words to search the platform.", previous: "Previous", next: "Next", pagination: "Result pages", results: "Results", page: "Page" },
} satisfies Record<Locale, Record<string, string>>;
export const searchSectionLabels: Record<Locale, Record<SearchSection, string>> = {
  ru: { journal: "Статьи", scientists: "Учёные", research: "Исследования", projects: "Проекты", publications: "Научные публикации", mentorship: "Наставничество", "research-program": "Research Program", events: "События", organizations: "Организации", users: "Пользователи", media: "Медиа", "mentorship-applications": "Заявки на наставничество", "program-applications": "Заявки Research Program" },
  kk: { journal: "Мақалалар", scientists: "Ғалымдар", research: "Зерттеулер", projects: "Жобалар", publications: "Ғылыми жарияланымдар", mentorship: "Тәлімгерлік", "research-program": "Зерттеу бағдарламасы", events: "Іс-шаралар", organizations: "Ұйымдар", users: "Пайдаланушылар", media: "Медиа", "mentorship-applications": "Тәлімгерлік өтінімдері", "program-applications": "Бағдарлама өтінімдері" },
  en: { journal: "Articles", scientists: "Scientists", research: "Research", projects: "Projects", publications: "Scientific publications", mentorship: "Mentorship", "research-program": "Research Program", events: "Events", organizations: "Organizations", users: "Users", media: "Media", "mentorship-applications": "Mentorship applications", "program-applications": "Program applications" },
};
