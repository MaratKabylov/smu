import { z } from "zod";
import type { Locale } from "@/lib/i18n/locales";
import type { PublicSiteContent, sectionKeys } from "@/lib/validation/site-content";
export const homeCardSchema = z.object({ id: z.uuid(), title: z.string(), summary: z.string(),
  href: z.string().startsWith("/").refine(value => !value.startsWith("//")) });
export type HomeCard = z.infer<typeof homeCardSchema>;
export type HomeSection = PublicSiteContent["sections"][number] & { items: HomeCard[] };
export type Homepage = { settings: PublicSiteContent["settings"]; sections: HomeSection[] };
type SectionKey = typeof sectionKeys[number];
export const homeCopy = {
  ru: { home: "Главная", intro: "Наука начинается с людей и совместных идей. Исследования, наставничество и поддержка научного сообщества.", all: "Все материалы", empty: "Опубликованных материалов пока нет.",
    sections: { hero: "Сообщество молодых учёных", featured_research: "Исследования", featured_scientists: "Учёные", research_program: "Research Program", mentorship: "Наставничество", scientist_support: "Поддержка учёных", latest_articles: "Последние статьи", opportunities: "Возможности", events: "Ближайшие события", results: "Научные результаты", partners: "Партнёры" } },
  kk: { home: "Басты бет", intro: "Ғылым адамдар мен ортақ идеялардан басталады. Ғылыми қауымдастыққа арналған зерттеулер, тәлімгерлік және қолдау.", all: "Барлық материалдар", empty: "Жарияланған материалдар әзірге жоқ.",
    sections: { hero: "Жас ғалымдар қауымдастығы", featured_research: "Зерттеулер", featured_scientists: "Ғалымдар", research_program: "Зерттеу бағдарламасы", mentorship: "Тәлімгерлік", scientist_support: "Ғалымдарды қолдау", latest_articles: "Соңғы мақалалар", opportunities: "Мүмкіндіктер", events: "Алдағы іс-шаралар", results: "Ғылыми нәтижелер", partners: "Серіктестер" } },
  en: { home: "Home", intro: "Science starts with people and shared ideas. Research, mentorship and support for the scientific community.", all: "All materials", empty: "No published materials yet.",
    sections: { hero: "Young scientists community", featured_research: "Research", featured_scientists: "Scientists", research_program: "Research Program", mentorship: "Mentorship", scientist_support: "Support for scientists", latest_articles: "Latest articles", opportunities: "Opportunities", events: "Upcoming events", results: "Research outputs", partners: "Partners" } },
} satisfies Record<Locale, { home: string; intro: string; all: string; empty: string; sections: Record<SectionKey, string> }>;
export const homeCatalogs: Partial<Record<SectionKey, string>> = {
  featured_research: "research", featured_scientists: "scientists", research_program: "research-program", mentorship: "mentorship",
  latest_articles: "journal", opportunities: "opportunities", events: "events",
};
